/**
 * Recriação dos dados de demonstração.
 *
 * A rotina `seed_demo_workspace` roda no banco com privilégio elevado e é
 * idempotente: só insere o conjunto fictício quando ele não está mais lá, e
 * nunca toca nos dados reais (importados, coletados por API ou navegador).
 */
export async function garantirDemonstracao(ws: string): Promise<{ recriado: boolean; campanhas: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const antes = await supabaseAdmin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .like("id", "demo-%");

  const { error } = await supabaseAdmin.rpc("seed_demo_workspace", { _ws: ws });
  if (error) throw new Error(`Não foi possível recriar os dados de demonstração: ${error.message}`);

  const depois = await supabaseAdmin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .like("id", "demo-%");

  return { recriado: (antes.count ?? 0) === 0, campanhas: depois.count ?? 0 };
}
