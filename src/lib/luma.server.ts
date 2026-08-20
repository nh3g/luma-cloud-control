import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type Sb = SupabaseClient<Database>;

/** Devolve o id do workspace do usuário autenticado (RLS garante o escopo). */
export async function obterWorkspaceId(supabase: Sb): Promise<string> {
  const { data, error } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workspace não encontrado para este usuário.");
  return data.id;
}

/** Marca como expiradas as decisões pendentes ou aprovadas cuja validade passou. */
export async function expirarDecisoesVencidas(supabase: Sb, workspaceId: string): Promise<number> {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("decisions")
    .update({ status: "EXPIRED" })
    .eq("workspace_id", workspaceId)
    .in("status", ["PENDING", "APPROVED"])
    .lt("expires_at", agora)
    .select("id, platform, action_type, campaign_name, expires_at");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return 0;

  // Registra no diagnóstico para que a expiração fique auditável.
  await supabase.from("action_logs").insert(
    data.map((d) => ({
      workspace_id: workspaceId,
      decision_id: d.id,
      platform: d.platform,
      endpoint: "interno:expiracao-automatica",
      method: "SYSTEM",
      request_json: { action_type: d.action_type, campaign_name: d.campaign_name },
      response_json: { expirou_em: d.expires_at },
      success: true,
      error_message: "Decisão expirou sem resposta humana.",
    })),
  );

  return data.length;
}

