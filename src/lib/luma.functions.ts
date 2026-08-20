import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { obterWorkspaceId } from "./luma.server";

export const obterVisaoGeral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { expirarDecisoesVencidas } = await import("./luma.server");
    const ws = await obterWorkspaceId(context.supabase);
    await expirarDecisoesVencidas(context.supabase, ws);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { situacaoCredenciais: situacao } = await import("./luma/credenciais.server");
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
      credenciais: await situacao(supabaseAdmin, ws),
    };
  });

export const salvarCredenciaisPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        plataforma: z.enum(["META", "GOOGLE_ADS"]),
        clientId: z.string().trim().min(4).max(200),
        clientSecret: z.string().trim().min(8).max(400),
        developerToken: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    if (data.plataforma === "GOOGLE_ADS" && !data.developerToken) {
      throw new Error("O Google Ads exige também o token de desenvolvedor.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_credentials").upsert(
      {
        workspace_id: ws,
        platform: data.plataforma,
        client_id: data.clientId,
        client_secret: data.clientSecret,
        developer_token: data.developerToken ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,platform" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerCredenciaisPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plataforma: z.enum(["META", "GOOGLE_ADS"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_credentials")
      .delete()
      .eq("workspace_id", ws)
      .eq("platform", data.plataforma);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Verifica com o provedor se as chaves do app cadastradas realmente funcionam. */
export const testarCredenciaisPlataforma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plataforma: z.enum(["META", "GOOGLE_ADS"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { obterCredenciais } = await import("./luma/credenciais.server");
    const credenciais = await obterCredenciais(supabaseAdmin, ws, data.plataforma);
    if (!credenciais) {
      return { ok: false, mensagem: "Cadastre as chaves do app antes de testar." };
    }
    const { testarCredenciais } = await import("./luma/teste-credenciais.server");
    return testarCredenciais(data.plataforma, credenciais);
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
      const [{ count }, { count: navegador }] = await Promise.all([
        context.supabase
          .from("integrations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", ws)
          .eq("status", "CONNECTED"),
        context.supabase
          .from("browser_collections")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", ws)
          .in("mode", ["BROWSER", "IMPORT"]),
      ]);
      if (!count && !navegador) {
        throw new Error(
          "Antes de sair do modo demonstração, traga dados reais em Integrações: importe um relatório exportado, conecte uma conta pela API oficial ou configure a coleta por navegador.",
        );
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { obterCredenciais } = await import("./luma/credenciais.server");
    const credenciais = await obterCredenciais(supabaseAdmin, ws, data.plataforma);
    const clientId = credenciais?.clientId;
    if (!clientId) {
      throw new Error(
        data.plataforma === "META"
          ? "Cadastre o ID e a chave secreta do app Meta antes de conectar a conta."
          : "Cadastre o ID do cliente, a chave secreta e o token de desenvolvedor do Google Ads antes de conectar a conta.",
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

    const [workspace, settings, decisoes, logs, syncs, integracoes] = await Promise.all([
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
    };
  });

// ---------------------------------------------------------------------------
// Acesso MCP (assistentes externos)
// ---------------------------------------------------------------------------

export const listarChavesMcp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data } = await context.supabase
      .from("mcp_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
      .eq("workspace_id", ws)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    return { chaves: data ?? [] };
  });

export const gerarChaveMcp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ label: z.string().trim().min(2).max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const { gerarSegredo, resumo } = await import("./luma/cripto.server");
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

const mensagemChat = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(6000),
});

/** Conversa com a estrategista de IA usando os dados reais do workspace. */
export const conversarEstrategista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((dados: unknown) =>
    z
      .object({
        historico: z.array(mensagemChat).min(1).max(24),
        modo: z.enum(["RAPIDO", "PRIME"]).default("RAPIDO"),
      })
      .parse(dados),
  )
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("demo_mode, agent_stopped, ai_model")
      .eq("id", ws)
      .maybeSingle();

    const { conversar } = await import("./luma/estrategista.server");
    return conversar(context.supabase, ws, data.historico, data.modo, {
      demo: workspace?.demo_mode !== false,
      parado: workspace?.agent_stopped === true,
      ...(workspace?.ai_model ? { modelo: workspace.ai_model } : {}),
    });
  });

/** Relatório agregado do período escolhido, com comparativo e decisões. */
export const obterRelatorio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dias: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { montarRelatorio } = await import("./luma/relatorio.server");
    const { expirarDecisoesVencidas } = await import("./luma.server");
    const ws = await obterWorkspaceId(context.supabase);
    await expirarDecisoesVencidas(context.supabase, ws);
    return montarRelatorio(context.supabase, ws, data.dias);
  });

/** Devolve o CSV do relatório do período, gerado no servidor. */
export const exportarRelatorioCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dias: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { montarRelatorio, gerarCsv } = await import("./luma/relatorio.server");
    const ws = await obterWorkspaceId(context.supabase);
    const relatorio = await montarRelatorio(context.supabase, ws, data.dias);
    return {
      nome: `luma-relatorio-${data.dias}d-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: gerarCsv(relatorio),
    };
  });

/** Marca o tour de boas-vindas como concluído para este workspace. */
export const concluirOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase
      .from("workspaces")
      .update({ onboarding_completed: true })
      .eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ── Coleta por navegador (browser-use na nuvem) ───────────────────────── */

const plataformaColeta = z.enum(["META", "GOOGLE_ADS"]);

export const obterColetaNavegador = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarColeta } = await import("./luma/coleta.server");
    const ws = await obterWorkspaceId(context.supabase);
    return listarColeta(context.supabase, ws);
  });

export const salvarColetaNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        plataforma: plataformaColeta,
        modo: z.enum(["DEMO", "API", "BROWSER", "IMPORT"]),
        conta: z.string().trim().max(120).default(""),
        dias: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { salvarColeta } = await import("./luma/coleta.server");
    const ws = await obterWorkspaceId(context.supabase);
    return salvarColeta(context.supabase, ws, data);
  });

export const iniciarColetaNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ plataforma: plataformaColeta }).parse(input))
  .handler(async ({ context, data }) => {
    const { dispararColeta } = await import("./luma/coleta.server");
    const ws = await obterWorkspaceId(context.supabase);
    return dispararColeta(context.supabase, ws, data.plataforma);
  });

export const acompanharColetaNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { acompanharColeta } = await import("./luma/coleta.server");
    const ws = await obterWorkspaceId(context.supabase);
    return acompanharColeta(context.supabase, ws, data.id);
  });

export const pararColetaNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { interromperColeta } = await import("./luma/coleta.server");
    const ws = await obterWorkspaceId(context.supabase);
    return interromperColeta(context.supabase, ws, data.id);
  });

/* ── Modelo de IA ──────────────────────────────────────────────────────── */

export const obterConfigIa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chaveIaConfigurada, MODELOS_DISPONIVEIS, MODELO_PADRAO } = await import("./luma/ia.server");
    const ws = await obterWorkspaceId(context.supabase);
    const { data } = await context.supabase.from("workspaces").select("ai_model").eq("id", ws).maybeSingle();
    return {
      modelo: data?.ai_model ?? MODELO_PADRAO,
      modelos: MODELOS_DISPONIVEIS.map((m) => ({ id: m.id, rotulo: m.rotulo })),
      configurada: chaveIaConfigurada(),
    };
  });

export const salvarModeloIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ modelo: z.string().trim().min(2).max(60) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { error } = await context.supabase.from("workspaces").update({ ai_model: data.modelo }).eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testarModeloIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ modelo: z.string().trim().min(2).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const { testarIa } = await import("./luma/ia.server");
    return testarIa(data.modelo);
  });

/* ── Chave do serviço de navegador e limpeza de dados ──────────────────── */

export const salvarChaveNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ chave: z.string().trim().min(10).max(300) }).parse(input))
  .handler(async ({ context, data }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("service_credentials").upsert(
      { workspace_id: ws, service: "BROWSER_USE", api_key: data.chave, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,service" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerChaveNavegador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await obterWorkspaceId(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("service_credentials")
      .delete()
      .eq("workspace_id", ws)
      .eq("service", "BROWSER_USE");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const limparDadosWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        escopo: z.enum(["DEMO", "REAIS"]),
        plataforma: z.enum(["TODAS", "META", "GOOGLE_ADS"]).default("TODAS"),
        periodo: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(30)]).default(0),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { limparDados } = await import("./luma/limpeza.server");
    const ws = await obterWorkspaceId(context.supabase);
    return limparDados(context.supabase, ws, data);
  });

/* ── Importação de relatórios exportados (sem custo de navegador) ──────── */

const campanhaImportada = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  objective: z.string().nullable(),
  budget_daily: z.number(),
  spend: z.number(),
  revenue: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  frequency: z.number(),
});

export const analisarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        plataforma: z.enum(["META", "GOOGLE_ADS"]),
        conteudo: z.string().min(20).max(200_000),
        dias: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { analisarRelatorio } = await import("./luma/importacao.server");
    const ws = await obterWorkspaceId(context.supabase);
    const { data: workspace } = await context.supabase
      .from("workspaces")
      .select("ai_model")
      .eq("id", ws)
      .maybeSingle();
    return analisarRelatorio({
      plataforma: data.plataforma,
      conteudo: data.conteudo,
      dias: data.dias,
      modelo: workspace?.ai_model,
    });
  });

export const confirmarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        plataforma: z.enum(["META", "GOOGLE_ADS"]),
        dias: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7),
        campanhas: z.array(campanhaImportada).min(1).max(500),
        rotulo: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { confirmarRelatorio } = await import("./luma/importacao.server");
    const ws = await obterWorkspaceId(context.supabase);
    return confirmarRelatorio(context.supabase, ws, data);
  });

export const listarImportacoesRelatorio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listarImportacoes } = await import("./luma/importacao.server");
    const ws = await obterWorkspaceId(context.supabase);
    return listarImportacoes(context.supabase, ws);
  });
