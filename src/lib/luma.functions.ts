import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
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
      .update({ [data.campo]: data.valor })
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
    const ws = await obterWorkspaceId(context.supabase);
    const sb = context.supabase;

    const { data: workspace } = await sb
      .from("workspaces")
      .select("agent_stopped, demo_mode")
      .eq("id", ws)
      .maybeSingle();
    if (workspace?.agent_stopped) {
      throw new Error("O agente está parado. Reative o agente para executar decisões.");
    }

    const { data: decisao, error: erroLeitura } = await sb
      .from("decisions")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (erroLeitura) throw new Error(erroLeitura.message);
    if (!decisao) throw new Error("Decisão não encontrada.");
    if (decisao.status !== "APPROVED") {
      throw new Error("Somente decisões aprovadas e ainda válidas podem ser executadas.");
    }
    if (new Date(decisao.expires_at).getTime() <= Date.now()) {
      await sb.from("decisions").update({ status: "EXPIRED" }).eq("id", decisao.id).eq("workspace_id", ws);
      throw new Error("A aprovação expirou antes da execução. Rode uma nova análise.");
    }

    const canal = "SIMULATED" as const;
    const endpointBase = decisao.platform === "META" ? "/graph/v20.0" : "/v17/customers";
    const registrar = async (
      endpoint: string,
      method: string,
      req: Record<string, unknown>,
      res: Record<string, unknown>,
      success: boolean,
      erro?: string,
    ) => {
      await sb.from("action_logs").insert({
        workspace_id: ws,
        decision_id: decisao.id,
        platform: decisao.platform,
        endpoint,
        method,
        request_json: req as Json,
        response_json: res as Json,
        success,
        error_message: erro ?? null,
      });
    };

    // 1. Reler estado atual e comparar com o valor anterior registrado
    const { data: campanha } = await sb
      .from("campaigns")
      .select("*")
      .eq("workspace_id", ws)
      .eq("id", decisao.campaign_id ?? "")
      .maybeSingle();
    if (!campanha) throw new Error("Campanha da decisão não foi encontrada na base sincronizada.");

    const anterior = (decisao.previous_value_json ?? {}) as Record<string, unknown>;
    const proposto = (decisao.proposed_value_json ?? {}) as Record<string, unknown>;

    let divergencia: string | null = null;
    if (typeof anterior["budgetDaily"] === "number") {
      const atual = Number(campanha.budget_daily);
      if (Math.abs(atual - Number(anterior["budgetDaily"])) > 0.009) {
        divergencia = `O orçamento diário mudou de ${anterior["budgetDaily"]} para ${atual} desde a análise.`;
      }
    }
    if (!divergencia && typeof anterior["status"] === "string" && campanha.status !== anterior["status"]) {
      divergencia = `O status da campanha mudou de ${anterior["status"]} para ${campanha.status} desde a análise.`;
    }

    await registrar(
      `${endpointBase}/${decisao.campaign_id}?fields=status,daily_budget`,
      "GET",
      { campaignId: decisao.campaign_id, mode: canal },
      { status: campanha.status, budgetDaily: Number(campanha.budget_daily) },
      true,
    );

    if (divergencia) {
      await sb
        .from("decisions")
        .update({
          status: "EXPIRED",
          result_json: { blocked: true, reason: divergencia },
        })
        .eq("id", decisao.id)
        .eq("workspace_id", ws);
      await registrar(
        `${endpointBase}/${decisao.campaign_id}`,
        "POST",
        { mode: canal },
        { blocked: true, reason: divergencia },
        false,
        divergencia,
      );
      return { ok: false, bloqueado: true, motivo: divergencia };
    }

    // 2. Aplicar a alteração
    const alteracao: { budget_daily?: number; status?: string } = {};
    if (typeof proposto["budgetDaily"] === "number") alteracao.budget_daily = proposto["budgetDaily"];
    if (typeof proposto["status"] === "string") alteracao.status = proposto["status"];

    if (Object.keys(alteracao).length > 0) {
      const { error } = await sb
        .from("campaigns")
        .update(alteracao)
        .eq("workspace_id", ws)
        .eq("id", campanha.id);
      if (error) {
        await sb
          .from("decisions")
          .update({ status: "FAILED", result_json: { error: error.message } })
          .eq("id", decisao.id)
          .eq("workspace_id", ws);
        await registrar(`${endpointBase}/${campanha.id}`, "POST", alteracao, {}, false, error.message);
        throw new Error(error.message);
      }
    }

    await registrar(`${endpointBase}/${campanha.id}`, "POST", { ...alteracao, mode: canal }, { accepted: true }, true);

    // 3. Verificar o estado final na própria origem
    const { data: final } = await sb
      .from("campaigns")
      .select("status, budget_daily")
      .eq("workspace_id", ws)
      .eq("id", campanha.id)
      .maybeSingle();

    const confirmado =
      final !== null &&
      final !== undefined &&
      (typeof proposto["budgetDaily"] !== "number" ||
        Math.abs(Number(final.budget_daily) - Number(proposto["budgetDaily"])) < 0.009) &&
      (typeof proposto["status"] !== "string" || final.status === proposto["status"]);

    await registrar(
      `${endpointBase}/${campanha.id}?fields=status,daily_budget`,
      "GET",
      { verificacao: "estado final" },
      { status: final?.status ?? null, budgetDaily: Number(final?.budget_daily ?? 0), verified: confirmado },
      confirmado,
      confirmado ? undefined : "Estado final não confere com o valor proposto.",
    );

    if (!confirmado) {
      await sb
        .from("decisions")
        .update({
          status: "FAILED",
          result_json: { verified: false, reason: "Estado final não confere com o valor proposto." },
        })
        .eq("id", decisao.id)
        .eq("workspace_id", ws);
      return { ok: false, bloqueado: false, motivo: "A verificação final falhou. Nada foi registrado como sucesso." };
    }

    await sb
      .from("decisions")
      .update({
        status: "EXECUTED",
        executed_at: new Date().toISOString(),
        executed_via: canal,
        result_json: { verified: true, ...proposto },
      })
      .eq("id", decisao.id)
      .eq("workspace_id", ws);

    return { ok: true, bloqueado: false, motivo: null };
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
