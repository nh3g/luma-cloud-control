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
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
