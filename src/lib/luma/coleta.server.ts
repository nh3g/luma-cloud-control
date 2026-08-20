/**
 * Orquestra a coleta de métricas por navegador: guarda a configuração por
 * plataforma, dispara a tarefa na nuvem, acompanha o andamento e grava as
 * campanhas lidas no banco quando a coleta termina.
 */
import type { Sb } from "../luma.server";
import {
  consultarColeta,
  excluirPerfil,
  garantirPerfil,
  iniciarColeta,
  iniciarLogin,
  pararColeta,
} from "./browser.server";
import { gravarCampanhas } from "./sync.server";

/** Modelo do serviço de navegador (a OpenAI da estrategista não vale aqui). */
const MODELO_NAVEGADOR = () => process.env["BROWSER_USE_MODEL"] || "browser-use-2.0";

/** Tempo máximo de cada tipo de sessão, em minutos. */
const LIMITE_MIN = { LOGIN: 10, COLLECT: 25 } as const;


export type Plataforma = "META" | "GOOGLE_ADS";

/** Chave do serviço de navegador do workspace (ou a do projeto). */
async function chaveDoWorkspace(ws: string): Promise<{ chave: string; origem: "workspace" | "projeto" } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { obterChaveNavegador } = await import("./credenciais.server");
  return obterChaveNavegador(supabaseAdmin, ws);
}

export async function listarColeta(sb: Sb, ws: string) {
  const [configs, execucoes, chave] = await Promise.all([
    sb.from("browser_collections").select("*").eq("workspace_id", ws),
    sb
      .from("browser_collection_runs")
      .select("*")
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(10),
    chaveDoWorkspace(ws),
  ]);
  return {
    configuracoes: configs.data ?? [],
    execucoes: execucoes.data ?? [],
    servicoConfigurado: Boolean(chave),
    chaveServico: chave
      ? { configurada: true, origem: chave.origem, prefixo: chave.chave.slice(0, 6) }
      : { configurada: false as const },
  };
}

export async function salvarColeta(
  sb: Sb,
  ws: string,
  entrada: { plataforma: Plataforma; modo: "DEMO" | "API" | "BROWSER" | "IMPORT"; conta: string; dias: 7 | 14 | 30 },
) {
  const { error } = await sb.from("browser_collections").upsert(
    {
      workspace_id: ws,
      platform: entrada.plataforma,
      mode: entrada.modo,
      external_account_id: entrada.conta || null,
      lookback_days: entrada.dias,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,platform" },
  );
  if (error) throw new Error(error.message);
  await refletirIntegracao(sb, ws, entrada.plataforma, entrada.modo, entrada.conta);
  return { ok: true };
}

/**
 * Mantém a lista de contas conectadas coerente com a origem escolhida: no modo
 * navegador a plataforma conta como conta real conectada; ao sair desse modo a
 * conexão criada pelo navegador volta a ficar desconectada.
 */
async function refletirIntegracao(
  sb: Sb,
  ws: string,
  plataforma: Plataforma,
  modo: "DEMO" | "API" | "BROWSER" | "IMPORT",
  conta: string,
) {
  const { data: existente } = await sb
    .from("integrations")
    .select("id, metadata_json, status")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();

  const nome = plataforma === "META" ? "Meta Ads (navegador)" : "Google Ads (navegador)";

  if (modo === "IMPORT") return; // a importação cuida da própria integração
  if (modo === "BROWSER") {
    const dados = {
      workspace_id: ws,
      platform: plataforma as "META" | "GOOGLE_ADS",
      account_id: conta || null,
      name: nome,
      status: "CONNECTED" as const,
      metadata_json: { origem: "NAVEGADOR" },
      updated_at: new Date().toISOString(),
    };
    if (existente) await sb.from("integrations").update(dados).eq("id", existente.id);
    else await sb.from("integrations").insert(dados);
    return;
  }

  const origem = (existente?.metadata_json as { origem?: string } | null)?.origem;
  if (existente && origem === "NAVEGADOR") {
    await sb
      .from("integrations")
      .update({ status: "DISCONNECTED", updated_at: new Date().toISOString() })
      .eq("id", existente.id);
  }
}

/** Checagens comuns antes de abrir qualquer sessão de navegador. */
async function prepararSessao(sb: Sb, ws: string, plataforma: Plataforma) {
  const servico = await chaveDoWorkspace(ws);
  if (!servico) {
    throw new Error("Cadastre a chave do serviço de navegador (Browser Use) em Integrações antes de continuar.");
  }
  const { data: workspace } = await sb.from("workspaces").select("agent_stopped").eq("id", ws).maybeSingle();
  if (workspace?.agent_stopped) {
    throw new Error(
      'O agente está parado. Clique em "PARAR AGENTE" no topo da tela para reativá-lo e tente de novo.',
    );
  }

  const { data: config } = await sb
    .from("browser_collections")
    .select("*")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();
  if (!config || config.mode !== "BROWSER") {
    throw new Error('Escolha a origem "Navegador na nuvem" para esta plataforma antes de continuar.');
  }

  const { data: emCurso } = await sb
    .from("browser_collection_runs")
    .select("id")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .eq("status", "RUNNING")
    .limit(1);
  if ((emCurso ?? []).length > 0) throw new Error("Já existe uma sessão em andamento para esta plataforma.");

  const perfilId = await garantirPerfil(servico.chave, config.profile_id);
  if (perfilId !== config.profile_id) {
    await sb.from("browser_collections").update({ profile_id: perfilId }).eq("id", config.id);
  }
  return { servico, config, perfilId };
}

/** Abre a sessão em que a pessoa entra na conta do Meta/Google. */
export async function dispararLogin(sb: Sb, ws: string, plataforma: Plataforma) {
  const { servico, perfilId } = await prepararSessao(sb, ws, plataforma);
  const { taskId, sessionId, liveUrl } = await iniciarLogin({
    chave: servico.chave,
    plataforma,
    perfilId,
    modelo: MODELO_NAVEGADOR(),
  });
  const { data: run, error } = await sb
    .from("browser_collection_runs")
    .insert({
      workspace_id: ws,
      platform: plataforma,
      task_id: taskId,
      session_id: sessionId,
      live_url: liveUrl,
      status: "RUNNING",
      kind: "LOGIN",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return run;
}

/** Desfaz a conexão: apaga o perfil salvo no serviço e zera o estado. */
export async function desconectarConta(sb: Sb, ws: string, plataforma: Plataforma) {
  const { data: config } = await sb
    .from("browser_collections")
    .select("id, profile_id")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();
  if (!config) return { ok: true };
  if (config.profile_id) {
    const servico = await chaveDoWorkspace(ws);
    if (servico) await excluirPerfil(servico.chave, config.profile_id);
  }
  await sb
    .from("browser_collections")
    .update({ profile_id: null, connected_at: null, session_id: null })
    .eq("id", config.id);
  return { ok: true };
}

/** Dispara uma coleta por navegador para a plataforma escolhida. */
export async function dispararColeta(sb: Sb, ws: string, plataforma: Plataforma) {
  const { servico, config, perfilId } = await prepararSessao(sb, ws, plataforma);
  if (!config.connected_at) {
    throw new Error('Conecte a conta primeiro: clique em "Conectar conta" e faça o login na janela ao vivo.');
  }

  const { taskId, sessionId, liveUrl } = await iniciarColeta({
    chave: servico.chave,
    plataforma,
    conta: config.external_account_id ?? "",
    dias: config.lookback_days,
    perfilId,
    modelo: MODELO_NAVEGADOR(),
  });

  const { data: run, error } = await sb
    .from("browser_collection_runs")
    .insert({
      workspace_id: ws,
      platform: plataforma,
      task_id: taskId,
      session_id: sessionId,
      live_url: liveUrl,
      status: "RUNNING",
      kind: "COLLECT",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return run;
}


/**
 * Consulta a nuvem e atualiza o registro. Em sessões de login, marca a conta
 * como conectada; em coletas, grava as campanhas lidas. Sessões que passam do
 * tempo limite viram falha com explicação, em vez de rodar para sempre.
 */
export async function acompanharColeta(sb: Sb, ws: string, runId: string) {
  const { data: run } = await sb
    .from("browser_collection_runs")
    .select("*")
    .eq("workspace_id", ws)
    .eq("id", runId)
    .maybeSingle();
  if (!run) throw new Error("Execução de coleta não encontrada.");
  if (run.status !== "RUNNING") return run;

  const login = run.kind === "LOGIN";
  const servico = await chaveDoWorkspace(ws);
  if (!servico) throw new Error("A chave do serviço de navegador não está cadastrada.");

  const minutos = (Date.now() - new Date(run.started_at).getTime()) / 60000;
  if (minutos > (login ? LIMITE_MIN.LOGIN : LIMITE_MIN.COLLECT)) {
    try {
      await pararColeta(servico.chave, run.task_id);
    } catch {
      /* pode já ter terminado na nuvem */
    }
    const { data } = await sb
      .from("browser_collection_runs")
      .update({
        status: "FAILED",
        finished_at: new Date().toISOString(),
        error: login
          ? "O login não foi concluído a tempo. Clique em Conectar conta de novo e entre pela janela ao vivo."
          : "A coleta passou do tempo limite. Tente de novo; se a conta pedir login, reconecte primeiro.",
      })
      .eq("id", run.id)
      .select("*")
      .single();
    return data ?? run;
  }

  let estado;
  try {
    estado = await consultarColeta(servico.chave, run.task_id, run.platform);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao consultar a coleta.";
    const { data } = await sb
      .from("browser_collection_runs")
      .update({ status: "FAILED", error: mensagem, finished_at: new Date().toISOString() })
      .eq("id", run.id)
      .select("*")
      .single();
    return data ?? run;
  }

  const atualizacao: {
    status: "RUNNING" | "FINISHED" | "FAILED" | "STOPPED";
    step: string | null;
    live_url: string | null;
    error: string | null;
    campaigns?: number;
    finished_at?: string;
  } = {
    status: estado.status,
    step: estado.passo,
    live_url: estado.liveUrl ?? run.live_url,
    error: estado.erro,
  };

  if (login) {
    if (estado.status === "FINISHED") {
      atualizacao["finished_at"] = new Date().toISOString();
      await sb
        .from("browser_collections")
        .update({ connected_at: new Date().toISOString() })
        .eq("workspace_id", ws)
        .eq("platform", run.platform);
    } else if (estado.status === "FAILED" || estado.status === "STOPPED") {
      atualizacao["finished_at"] = new Date().toISOString();
    }
    const { data } = await sb
      .from("browser_collection_runs")
      .update(atualizacao)
      .eq("id", run.id)
      .select("*")
      .single();
    return data ?? run;
  }

  if (estado.status === "FINISHED") {
    let total = 0;
    try {
      total = await gravarCampanhas(sb, ws, run.platform, "navegador", estado.campanhas);
      atualizacao["campaigns"] = total;
      if (total === 0) atualizacao["error"] = "A coleta terminou sem campanhas legíveis. Confira a conta e o período.";
    } catch (erro) {
      atualizacao["status"] = "FAILED";
      atualizacao["error"] = erro instanceof Error ? erro.message : "Falha ao gravar as campanhas coletadas.";
    }
    atualizacao["finished_at"] = new Date().toISOString();

    await sb.from("sync_runs").insert({
      workspace_id: ws,
      platform: run.platform,
      status: atualizacao["status"] === "FAILED" ? "FAILED" : "SUCCESS",
      accounts: 1,
      campaigns: total,
      message:
        atualizacao["status"] === "FAILED"
          ? String(atualizacao["error"])
          : `${total} campanhas coletadas pelo navegador.`,
      finished_at: new Date().toISOString(),
    });
  } else if (estado.status === "FAILED" || estado.status === "STOPPED") {
    atualizacao["finished_at"] = new Date().toISOString();
  }

  const { data } = await sb
    .from("browser_collection_runs")
    .update(atualizacao)
    .eq("id", run.id)
    .select("*")
    .single();
  return data ?? run;
}

/** Interrompe uma coleta em andamento. */
export async function interromperColeta(sb: Sb, ws: string, runId: string) {
  const { data: run } = await sb
    .from("browser_collection_runs")
    .select("*")
    .eq("workspace_id", ws)
    .eq("id", runId)
    .maybeSingle();
  if (!run) throw new Error("Execução de coleta não encontrada.");
  if (run.status === "RUNNING") {
    try {
      const servico = await chaveDoWorkspace(ws);
      if (servico) await pararColeta(servico.chave, run.task_id);
    } catch {
      /* a tarefa pode já ter terminado na nuvem */
    }
    await sb
      .from("browser_collection_runs")
      .update({ status: "STOPPED", finished_at: new Date().toISOString() })
      .eq("id", run.id);
  }
  return { ok: true };
}
