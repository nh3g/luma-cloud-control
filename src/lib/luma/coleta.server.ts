/**
 * Orquestra a coleta de métricas por navegador: guarda a configuração por
 * plataforma, dispara a tarefa na nuvem, acompanha o andamento e grava as
 * campanhas lidas no banco quando a coleta termina.
 */
import type { Sb } from "../luma.server";
import { chaveNavegadorConfigurada, consultarColeta, garantirPerfil, iniciarColeta, pararColeta } from "./browser.server";
import { gravarCampanhas } from "./sync.server";

export type Plataforma = "META" | "GOOGLE_ADS";

export async function listarColeta(sb: Sb, ws: string) {
  const [configs, execucoes] = await Promise.all([
    sb.from("browser_collections").select("*").eq("workspace_id", ws),
    sb
      .from("browser_collection_runs")
      .select("*")
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  return {
    configuracoes: configs.data ?? [],
    execucoes: execucoes.data ?? [],
    servicoConfigurado: chaveNavegadorConfigurada(),
  };
}

export async function salvarColeta(
  sb: Sb,
  ws: string,
  entrada: { plataforma: Plataforma; modo: "DEMO" | "API" | "BROWSER"; conta: string; dias: 7 | 14 | 30 },
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
  modo: "DEMO" | "API" | "BROWSER",
  conta: string,
) {
  const { data: existente } = await sb
    .from("integrations")
    .select("id, metadata_json, status")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();

  const nome = plataforma === "META" ? "Meta Ads (navegador)" : "Google Ads (navegador)";

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


/** Dispara uma coleta por navegador para a plataforma escolhida. */
export async function dispararColeta(sb: Sb, ws: string, plataforma: Plataforma) {
  if (!chaveNavegadorConfigurada()) {
    throw new Error("O serviço de navegador não está configurado neste projeto.");
  }
  const { data: workspace } = await sb
    .from("workspaces")
    .select("agent_stopped, ai_model")
    .eq("id", ws)
    .maybeSingle();
  if (workspace?.agent_stopped) {
    throw new Error(
      'O agente está parado. Clique em "PARAR AGENTE" no topo da tela para reativá-lo e tente coletar de novo.',
    );
  }

  const { data: config } = await sb
    .from("browser_collections")
    .select("*")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();
  if (!config || config.mode !== "BROWSER") {
    throw new Error("Ative o modo navegador para esta plataforma antes de coletar.");
  }

  const { data: emCurso } = await sb
    .from("browser_collection_runs")
    .select("id")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .eq("status", "RUNNING")
    .limit(1);
  if ((emCurso ?? []).length > 0) throw new Error("Já existe uma coleta em andamento para esta plataforma.");

  const perfilId = await garantirPerfil(config.profile_id);
  if (perfilId !== config.profile_id) {
    await sb.from("browser_collections").update({ profile_id: perfilId }).eq("id", config.id);
  }

  const { taskId, liveUrl } = await iniciarColeta({
    plataforma,
    conta: config.external_account_id ?? "",
    dias: config.lookback_days,
    perfilId,
    // O navegador na nuvem só aceita os modelos do próprio serviço (o modelo da
    // estrategista é da OpenAI e não vale aqui).
    modelo: process.env["BROWSER_USE_MODEL"] || "browser-use-2.0",
  });

  const { data: run, error } = await sb
    .from("browser_collection_runs")
    .insert({ workspace_id: ws, platform: plataforma, task_id: taskId, live_url: liveUrl, status: "RUNNING" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return run;
}

/** Consulta a nuvem, atualiza o registro e grava as campanhas quando concluir. */
export async function acompanharColeta(sb: Sb, ws: string, runId: string) {
  const { data: run } = await sb
    .from("browser_collection_runs")
    .select("*")
    .eq("workspace_id", ws)
    .eq("id", runId)
    .maybeSingle();
  if (!run) throw new Error("Execução de coleta não encontrada.");
  if (run.status !== "RUNNING") return run;

  let estado;
  try {
    estado = await consultarColeta(run.task_id, run.platform);
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
      await pararColeta(run.task_id);
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
