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
