import type { Json } from "@/integrations/supabase/types";
import type { Sb } from "../luma.server";

/**
 * Execução verificada de uma decisão aprovada.
 * Relê o estado atual, bloqueia se houver divergência, aplica a mudança,
 * confere o estado final e só então registra sucesso — cada passo vira action_log.
 */
export async function executarDecisaoAprovada(sb: Sb, ws: string, id: string) {
  const { data: workspace } = await sb.from("workspaces").select("agent_stopped, demo_mode").eq("id", ws).maybeSingle();
  if (workspace?.agent_stopped) {
    throw new Error("O agente está parado. Reative o agente para executar decisões.");
  }

  const { data: decisao, error: erroLeitura } = await sb
    .from("decisions")
    .select("*")
    .eq("id", id)
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
      .update({ status: "EXPIRED", result_json: { blocked: true, reason: divergencia } })
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
    const { error } = await sb.from("campaigns").update(alteracao).eq("workspace_id", ws).eq("id", campanha.id);
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
}
