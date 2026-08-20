/** Execução do motor de regras sobre um workspace (reaproveitada pela tela e pelo agendador). */
import type { Json } from "@/integrations/supabase/types";
import type { Sb } from "../luma.server";
import { expirarDecisoesVencidas } from "../luma.server";
import { avaliarCampanhas } from "./motor";

export type ResumoAnalise = {
  analisadas: number;
  criadas: number;
  ignoradas: number;
  expiradas: number;
};

export async function analisarWorkspace(sb: Sb, ws: string): Promise<ResumoAnalise> {
  const { data: workspace } = await sb.from("workspaces").select("agent_stopped").eq("id", ws).maybeSingle();
  if (workspace?.agent_stopped) {
    throw new Error("O agente está parado. Reative o agente para rodar a análise.");
  }

  const expiradas = await expirarDecisoesVencidas(sb, ws);

  const [{ data: settings }, { data: campanhas }, { data: pendentes }] = await Promise.all([
    sb.from("engine_settings").select("*").eq("workspace_id", ws).maybeSingle(),
    sb.from("campaigns").select("*").eq("workspace_id", ws),
    sb.from("decisions").select("campaign_id, action_type").eq("workspace_id", ws).in("status", ["PENDING", "APPROVED"]),
  ]);

  if (!settings) throw new Error("Parâmetros do motor não encontrados.");

  const propostas = avaliarCampanhas(campanhas ?? [], settings);
  const jaExiste = new Set((pendentes ?? []).map((d) => `${d.campaign_id}|${d.action_type}`));
  const novas = propostas.filter((p) => !jaExiste.has(`${p.campaign_id}|${p.action_type}`));

  if (novas.length > 0) {
    const expires = new Date(Date.now() + settings.decision_ttl_minutes * 60000).toISOString();
    const { error } = await sb.from("decisions").insert(
      novas.map((p) => ({
        workspace_id: ws,
        platform: p.platform as "META" | "GOOGLE_ADS" | "GA4",
        account_id: p.account_id,
        campaign_id: p.campaign_id,
        campaign_name: p.campaign_name,
        action_type: p.action_type,
        reason: p.reason,
        previous_value_json: p.previous_value_json as Json,
        proposed_value_json: p.proposed_value_json as Json,
        confidence: p.confidence,
        risk_level: p.risk_level,
        status: "PENDING" as const,
        source: "RULE_ENGINE" as const,
        expires_at: expires,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return {
    analisadas: (campanhas ?? []).length,
    criadas: novas.length,
    ignoradas: propostas.length - novas.length,
    expiradas,
  };
}
