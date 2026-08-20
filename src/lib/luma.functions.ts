import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { obterWorkspaceId } from "./luma.server";

export const obterVisaoGeral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const [campanhas, snapshots, decisoes, syncs, integracoes] = await Promise.all([
      context.supabase.from("campaigns").select("*").eq("workspace_id", ws).order("spend", { ascending: false }),
      context.supabase
        .from("metric_snapshots")
        .select("captured_at, spend, revenue, conversions, clicks, impressions")
        .eq("workspace_id", ws)
        .order("captured_at", { ascending: true }),
      context.supabase
        .from("decisions")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("sync_runs")
        .select("*")
        .eq("workspace_id", ws)
        .order("started_at", { ascending: false })
        .limit(5),
      context.supabase.from("integrations").select("*").eq("workspace_id", ws),
    ]);

    return {
      campanhas: campanhas.data ?? [],
      snapshots: snapshots.data ?? [],
      decisoes: decisoes.data ?? [],
      syncs: syncs.data ?? [],
      integracoes: integracoes.data ?? [],
    };
  });

export const listarCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("workspace_id", ws)
      .order("spend", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listarDecisoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { expirarDecisoesVencidas } = await import("./luma.server");
    const ws = await obterWorkspaceId(context.supabase);
    await expirarDecisoesVencidas(context.supabase, ws);
    const { data, error } = await context.supabase
      .from("decisions")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listarSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data, error } = await context.supabase
      .from("sync_runs")
      .select("*")
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const obterConfiguracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const [settings, workspace] = await Promise.all([
      context.supabase.from("engine_settings").select("*").eq("workspace_id", ws).maybeSingle(),
      context.supabase.from("workspaces").select("*").eq("id", ws).maybeSingle(),
    ]);
    if (settings.error) throw new Error(settings.error.message);
    if (workspace.error) throw new Error(workspace.error.message);
    return { settings: settings.data, workspace: workspace.data };
  });

export const salvarConfiguracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        target_cpa: z.number().min(0),
        roas_scale_threshold: z.number().min(0),
        roas_reduce_threshold: z.number().min(0),
        min_spend_no_conversion: z.number().min(0),
        high_frequency_threshold: z.number().min(0),
        low_ctr_threshold: z.number().min(0),
        budget_scale_percent: z.number().min(0).max(100),
        budget_reduce_percent: z.number().min(0).max(100),
        auto_analysis_enabled: z.boolean(),
        analysis_interval_minutes: z.number().int().min(15).max(10080),
        decision_ttl_minutes: z.number().int().min(15).max(10080),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase.from("engine_settings").update(data).eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        profile_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        profile_avatar: z.string().min(1).max(32),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase.from("workspaces").update(data).eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarNotas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data, error } = await context.supabase
      .from("notes")
      .select("*")
      .eq("workspace_id", ws)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ title: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { count } = await context.supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws);
    if ((count ?? 0) >= 20) throw new Error("Limite de 20 notas por workspace atingido.");
    const { data: nota, error } = await context.supabase
      .from("notes")
      .insert({ workspace_id: ws, title: data.title, position: count ?? 0 })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return nota;
  });

export const salvarNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(40).optional(),
        content: z.string().max(20000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const campos: { title?: string; content?: string } = {};
    if (data.title !== undefined) campos.title = data.title;
    if (data.content !== undefined) campos.content = data.content;
    const { error } = await context.supabase
      .from("notes")
      .update(campos)
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase.from("notes").delete().eq("id", data.id).eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decidirDecisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        acao: z.enum(["APROVAR", "RECUSAR"]),
        nota: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);

    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("agent_stopped")
      .eq("id", ws)
      .maybeSingle();
    if (workspace?.agent_stopped) {
      throw new Error("O agente está parado. Reative o agente para aprovar ou recusar decisões.");
    }

    const { data: decisao, error: erroLeitura } = await context.supabase
      .from("decisions")
      .select("id, status, expires_at")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (erroLeitura) throw new Error(erroLeitura.message);
    if (!decisao) throw new Error("Decisão não encontrada.");
    if (decisao.status !== "PENDING") throw new Error("Esta decisão já foi respondida.");

    if (new Date(decisao.expires_at).getTime() <= Date.now()) {
      await context.supabase
        .from("decisions")
        .update({ status: "EXPIRED" })
        .eq("id", data.id)
        .eq("workspace_id", ws);
      throw new Error("Esta decisão expirou. Uma nova análise precisa ser gerada.");
    }

    const agora = new Date().toISOString();
    const campos =
      data.acao === "APROVAR"
        ? {
            status: "APPROVED" as const,
            approved_at: agora,
            approved_by_user_id: context.userId,
            approval_note: data.nota ?? null,
          }
        : {
            status: "REJECTED" as const,
            rejected_at: agora,
            approved_by_user_id: context.userId,
            approval_note: data.nota ?? null,
          };

    const { error } = await context.supabase
      .from("decisions")
      .update(campos)
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .eq("status", "PENDING");
    if (error) throw new Error(error.message);
    return { ok: true, status: campos.status };
  });

export const rodarAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { analisarWorkspace } = await import("./luma/analise.server");
    const ws = await obterWorkspaceId(context.supabase);
    return analisarWorkspace(context.supabase, ws);
  });

export const listarIntegracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const [integracoes, syncs, workspace, campanhas] = await Promise.all([
      context.supabase.from("integrations").select("*").eq("workspace_id", ws).order("platform"),
      context.supabase
        .from("sync_runs")
        .select("*")
        .eq("workspace_id", ws)
        .order("started_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("workspaces")
        .select("demo_mode, auto_sync_enabled, agent_stopped, last_auto_run_at")
        .eq("id", ws)
        .maybeSingle(),
      context.supabase.from("campaigns").select("platform").eq("workspace_id", ws),
    ]);
    const contagem: Record<string, number> = {};
    for (const c of campanhas.data ?? []) contagem[c.platform] = (contagem[c.platform] ?? 0) + 1;
    return {
      integracoes: integracoes.data ?? [],
      syncs: syncs.data ?? [],
      workspace: workspace.data,
      contagemCampanhas: contagem,
      credenciais: {
        META: Boolean(process.env["META_APP_ID"] && process.env["META_APP_SECRET"]),
        GOOGLE_ADS: Boolean(
          process.env["GOOGLE_ADS_CLIENT_ID"] &&
            process.env["GOOGLE_ADS_CLIENT_SECRET"] &&
            process.env["GOOGLE_ADS_DEVELOPER_TOKEN"],
        ),
      },
    };
  });

export const sincronizarAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sincronizarWorkspace } = await import("./luma/sync.server");
    const ws = await obterWorkspaceId(context.supabase);
    return { resumos: await sincronizarWorkspace(context.supabase, ws) };
  });

export const alternarPreferenciaWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ campo: z.enum(["demo_mode", "auto_sync_enabled"]), valor: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    if (data.campo === "demo_mode" && data.valor === false) {
      const { count } = await context.supabase
        .from("integrations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws)
        .eq("status", "CONNECTED");
      if (!count) {
        throw new Error("Conecte uma conta real antes de sair do modo demonstração.");
      }
    }
    const { error } = await context.supabase
      .from("workspaces")
      .update(data.campo === "demo_mode" ? { demo_mode: data.valor } : { auto_sync_enabled: data.valor })
      .eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const desconectarIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase
      .from("integrations")
      .update({ status: "DISCONNECTED", access_token_vault_id: null, refresh_token_vault_id: null })
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_tokens").delete().eq("integration_id", data.id);
    return { ok: true };
  });

export const iniciarConexao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plataforma: z.enum(["META", "GOOGLE_ADS"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const origem = process.env["PUBLIC_APP_URL"] ?? "";
    const clientId =
      data.plataforma === "META" ? process.env["META_APP_ID"] : process.env["GOOGLE_ADS_CLIENT_ID"];
    if (!clientId) {
      throw new Error(
        data.plataforma === "META"
          ? "Credenciais do app Meta não configuradas. Adicione META_APP_ID e META_APP_SECRET nas chaves do projeto."
          : "Credenciais do Google Ads não configuradas. Adicione GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN nas chaves do projeto.",
      );
    }

    const state = crypto.randomUUID();
    const { error } = await context.supabase
      .from("oauth_states")
      .insert({ state, workspace_id: ws, platform: data.plataforma });
    if (error) throw new Error(error.message);

    const redirect = `${origem}/api/public/oauth/callback`;
    const url =
      data.plataforma === "META"
        ? `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}&scope=ads_read,ads_management`
        : `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&access_type=offline&prompt=consent&state=${state}&scope=${encodeURIComponent("https://www.googleapis.com/auth/adwords")}`;
    return { url };
  });


export const executarDecisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { executarDecisaoAprovada } = await import("./luma/execucao.server");
    const ws = await obterWorkspaceId(context.supabase);
    return executarDecisaoAprovada(context.supabase, ws, data.id);
  });


export const obterDiagnostico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { expirarDecisoesVencidas } = await import("./luma.server");
    const ws = await obterWorkspaceId(context.supabase);
    await expirarDecisoesVencidas(context.supabase, ws);

    const [workspace, settings, decisoes, logs, syncs, integracoes, companion] = await Promise.all([
      context.supabase.from("workspaces").select("*").eq("id", ws).maybeSingle(),
      context.supabase.from("engine_settings").select("*").eq("workspace_id", ws).maybeSingle(),
      context.supabase.from("decisions").select("status, created_at").eq("workspace_id", ws),
      context.supabase
        .from("action_logs")
        .select("*")
        .eq("workspace_id", ws)
        .order("executed_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("sync_runs")
        .select("*")
        .eq("workspace_id", ws)
        .order("started_at", { ascending: false })
        .limit(5),
      context.supabase.from("integrations").select("*").eq("workspace_id", ws),
      context.supabase.from("companion_devices").select("*").eq("workspace_id", ws),
    ]);

    const contagem: Record<string, number> = {};
    for (const d of decisoes.data ?? []) contagem[d.status] = (contagem[d.status] ?? 0) + 1;
    const ultimaDecisao = (decisoes.data ?? [])
      .map((d) => d.created_at)
      .sort()
      .at(-1);

    return {
      workspace: workspace.data,
      settings: settings.data,
      contagemDecisoes: contagem,
      ultimaAnalise: ultimaDecisao ?? null,
      logs: logs.data ?? [],
      syncs: syncs.data ?? [],
      integracoes: integracoes.data ?? [],
      companion: companion.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// Fase 6 — Agente de navegador (companion local) e acesso MCP
// ---------------------------------------------------------------------------

export const listarAgente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { estaOffline, expirarAprovacoesAgente } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);
    await expirarAprovacoesAgente(context.supabase, ws);

    const [dispositivos, runs, workspace] = await Promise.all([
      context.supabase
        .from("companion_devices")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("browser_agent_runs")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(20),
      context.supabase.from("workspaces").select("agent_stopped, demo_mode").eq("id", ws).maybeSingle(),
    ]);

    const ids = (runs.data ?? []).map((r) => r.id);
    const aprovacoes = ids.length
      ? (
          await context.supabase
            .from("browser_agent_approvals")
            .select("*")
            .in("run_id", ids)
            .order("requested_at", { ascending: false })
        ).data ?? []
      : [];

    return {
      dispositivos: (dispositivos.data ?? []).map((d) => ({
        ...d,
        offline: d.status === "OFFLINE" || estaOffline(d.last_heartbeat_at),
        pareado: Boolean(d.paired_at),
        aguardandoPareamento: Boolean(d.pairing_expires_at) && !d.paired_at,
      })),
      runs: runs.data ?? [],
      aprovacoes,
      workspace: workspace.data,
    };
  });

export const listarLogsExecucao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data: run } = await context.supabase
      .from("browser_agent_runs")
      .select("*")
      .eq("workspace_id", ws)
      .eq("id", data.runId)
      .maybeSingle();
    if (!run) throw new Error("Execução não encontrada.");
    const { data: logs } = await context.supabase
      .from("browser_agent_logs")
      .select("*")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: true })
      .limit(500);
    return { run, logs: logs ?? [] };
  });

export const criarDispositivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ nome: z.string().trim().min(2).max(60) }).parse(input))
  .handler(async ({ context, data }) => {
    const { criarPareamento } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);
    return criarPareamento(context.supabase, ws, data.nome);
  });

export const removerDispositivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase
      .from("companion_devices")
      .delete()
      .eq("workspace_id", ws)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const iniciarExecucaoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tarefa: z.string().trim().min(3).max(1000),
        modo: z.enum(["ANALYZE", "APPROVAL", "PRIME"]),
        companionId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { roteardorIntencao } = await import("./luma/roteador");
    const { estaOffline, registrarLog } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);

    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("agent_stopped")
      .eq("id", ws)
      .maybeSingle();
    if (workspace?.agent_stopped) {
      throw new Error("O agente está parado. Reative o agente para iniciar uma execução.");
    }

    const intencao = roteardorIntencao(data.tarefa, data.modo);

    // Ambiguidade: pede esclarecimento sem abrir navegador nem acionar IA.
    if (intencao.ambiguo) {
      return { ok: false, tipo: "AMBIGUO" as const, motivo: intencao.motivo, runId: null };
    }

    const { data: dispositivos } = await context.supabase
      .from("companion_devices")
      .select("id, last_heartbeat_at, paired_at")
      .eq("workspace_id", ws);
    const disponivel = (dispositivos ?? []).find(
      (d) => d.paired_at && (data.companionId ? d.id === data.companionId : !estaOffline(d.last_heartbeat_at)),
    );

    // Escrita em modo Análise é recusada antes de qualquer passo.
    if (intencao.escrita && data.modo === "ANALYZE") {
      const { data: run } = await context.supabase
        .from("browser_agent_runs")
        .insert({
          workspace_id: ws,
          companion_id: disponivel?.id ?? null,
          task: data.tarefa,
          mode: data.modo,
          intent: JSON.parse(JSON.stringify(intencao)),
          complexity: intencao.complexidade,
          max_steps: intencao.maxPassos,
          status: "MODE_MISMATCH",
          error_message: "Tarefa de escrita recusada no modo Análise.",
          finished_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (run) {
        await registrarLog(
          context.supabase,
          run.id,
          "Escrita bloqueada: o modo Análise só permite navegação e leitura.",
          "WARN",
        );
      }
      return {
        ok: false,
        tipo: "MODE_MISMATCH" as const,
        motivo: "Esta tarefa altera algo. Use o modo Aprovação para que cada alteração passe pela sua autorização.",
        runId: run?.id ?? null,
      };
    }

    if (!disponivel) {
      return {
        ok: false,
        tipo: "SEM_COMPANION" as const,
        motivo: "Nenhum dispositivo pareado e online. Pareie o companion na sua máquina para executar tarefas.",
        runId: null,
      };
    }

    const { data: run, error } = await context.supabase
      .from("browser_agent_runs")
      .insert({
        workspace_id: ws,
        companion_id: disponivel.id,
        task: data.tarefa,
        mode: data.modo,
        intent: JSON.parse(JSON.stringify(intencao)),
        complexity: intencao.complexidade,
        max_steps: intencao.maxPassos,
        status: "STARTING",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await registrarLog(context.supabase, run.id, `Tarefa enviada ao companion (limite de ${intencao.maxPassos} passos).`);
    return { ok: true, tipo: "ENVIADA" as const, motivo: null, runId: run.id };
  });

export const pararExecucaoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { registrarLog } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase
      .from("browser_agent_runs")
      .update({ status: "STOPPED", finished_at: new Date().toISOString() })
      .eq("workspace_id", ws)
      .eq("id", data.runId)
      .in("status", ["STARTING", "RUNNING", "WAITING_APPROVAL", "NEEDS_INPUT"]);
    if (error) throw new Error(error.message);
    await registrarLog(context.supabase, data.runId, "Execução interrompida pelo usuário.", "WARN");
    return { ok: true };
  });

export const responderAprovacaoAgente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        acao: z.enum(["APROVAR", "RECUSAR"]),
        nota: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { registrarLog } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);

    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("agent_stopped")
      .eq("id", ws)
      .maybeSingle();
    if (workspace?.agent_stopped) {
      throw new Error("O agente está parado. Reative o agente para responder aprovações.");
    }

    const { data: pedido } = await context.supabase
      .from("browser_agent_approvals")
      .select("*, browser_agent_runs!inner(workspace_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!pedido) throw new Error("Solicitação não encontrada.");
    if (pedido.status !== "PENDING") throw new Error("Esta solicitação já foi respondida.");
    if (pedido.expires_at && new Date(pedido.expires_at).getTime() <= Date.now()) {
      await context.supabase.from("browser_agent_approvals").update({ status: "EXPIRED" }).eq("id", data.id);
      throw new Error("A solicitação expirou. O agente precisa pedir novamente.");
    }

    const aprovar = data.acao === "APROVAR";
    const { error } = await context.supabase
      .from("browser_agent_approvals")
      .update({
        status: aprovar ? "APPROVED" : "REJECTED",
        responded_at: new Date().toISOString(),
        response_note: data.nota ?? null,
      })
      .eq("id", data.id)
      .eq("status", "PENDING");
    if (error) throw new Error(error.message);

    await registrarLog(
      context.supabase,
      pedido.run_id,
      aprovar
        ? `Aprovação concedida (uso único) para: ${pedido.title}`
        : `Aprovação recusada para: ${pedido.title}`,
      aprovar ? "INFO" : "WARN",
    );
    return { ok: true, status: aprovar ? "APPROVED" : "REJECTED" };
  });

export const listarChavesMcp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data } = await context.supabase
      .from("mcp_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    return { chaves: data ?? [] };
  });

export const gerarChaveMcp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ label: z.string().trim().min(2).max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const { gerarSegredo, resumo } = await import("./luma/companion.server");
    const ws = await obterWorkspaceId(context.supabase);
    const chave = `luma_${gerarSegredo(24)}`;
    const { error } = await context.supabase.from("mcp_keys").insert({
      workspace_id: ws,
      label: data.label,
      key_hash: await resumo(chave),
      key_prefix: chave.slice(0, 12),
    });
    if (error) throw new Error(error.message);
    return { chave };
  });

export const revogarChaveMcp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase
      .from("mcp_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("workspace_id", ws)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
