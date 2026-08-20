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
    const ws = await obterWorkspaceId(context.supabase);
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
