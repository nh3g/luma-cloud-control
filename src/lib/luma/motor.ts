/**
 * Motor de regras determinístico da LUMA.
 * Função pura: recebe métricas de campanhas + parâmetros do workspace e devolve
 * as decisões propostas. Sem acesso a banco, para poder ser reaproveitada pela
 * IA estrategista e pelo MCP nas fases seguintes.
 */

export type CampanhaMetricas = {
  id: string;
  platform: string;
  account_id: string;
  name: string;
  status: string;
  budget_daily: number | string;
  spend: number | string;
  conversions: number | string;
  cpa: number | string;
  roas: number | string;
  ctr: number | string;
  frequency: number | string;
};

export type ParametrosMotor = {
  target_cpa: number | string;
  roas_scale_threshold: number | string;
  roas_reduce_threshold: number | string;
  min_spend_no_conversion: number | string;
  high_frequency_threshold: number | string;
  low_ctr_threshold: number | string;
  budget_scale_percent: number | string;
  budget_reduce_percent: number | string;
};

export type AcaoProposta =
  | "PAUSE_CAMPAIGN"
  | "RESUME_CAMPAIGN"
  | "INCREASE_BUDGET"
  | "DECREASE_BUDGET"
  | "ROTATE_CREATIVE";

export type DecisaoProposta = {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  account_id: string;
  action_type: AcaoProposta;
  reason: string;
  previous_value_json: Record<string, unknown>;
  proposed_value_json: Record<string, unknown>;
  confidence: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
};

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const dec = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Confiança entre 0,5 e 0,95 conforme a distância entre a métrica e o limite. */
function confianca(valor: number, limite: number): number {
  if (limite <= 0) return 0.7;
  const razao = Math.abs(valor - limite) / limite;
  return Math.min(0.95, Math.max(0.5, 0.6 + razao * 0.6));
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

export function avaliarCampanha(
  c: CampanhaMetricas,
  p: ParametrosMotor,
): DecisaoProposta | null {
  if (c.status !== "ACTIVE") return null;

  const base = {
    campaign_id: c.id,
    campaign_name: c.name,
    platform: c.platform,
    account_id: c.account_id,
  };

  const spend = n(c.spend);
  const conversions = n(c.conversions);
  const roas = n(c.roas);
  const cpa = n(c.cpa);
  const ctr = n(c.ctr);
  const freq = n(c.frequency);
  const orcamento = n(c.budget_daily);

  const alvoCpa = n(p.target_cpa);
  const escala = n(p.roas_scale_threshold);
  const reducao = n(p.roas_reduce_threshold);
  const gastoMin = n(p.min_spend_no_conversion);
  const freqAlta = n(p.high_frequency_threshold);
  const ctrBaixo = n(p.low_ctr_threshold);
  const pctSobe = n(p.budget_scale_percent);
  const pctDesce = n(p.budget_reduce_percent);

  // 1. Gasto relevante sem nenhuma conversão → pausar (prioridade máxima)
  if (spend >= gastoMin && conversions <= 0) {
    return {
      ...base,
      action_type: "PAUSE_CAMPAIGN",
      reason: `Gasto de ${brl(spend)} acima do mínimo de ${brl(gastoMin)} sem nenhuma conversão registrada. Sugerido pausar a campanha.`,
      previous_value_json: { status: "ACTIVE" },
      proposed_value_json: { status: "PAUSED" },
      confidence: confianca(spend, gastoMin),
      risk_level: "HIGH",
    };
  }

  // 2. ROAS acima do limite de escala → aumentar orçamento
  if (roas >= escala && escala > 0) {
    const novo = arredondar(orcamento * (1 + pctSobe / 100));
    return {
      ...base,
      action_type: "INCREASE_BUDGET",
      reason: `ROAS de ${dec(roas)} acima do limite de escala (${dec(escala)}). Sugerido aumentar o orçamento diário em ${dec(pctSobe)}%.`,
      previous_value_json: { budgetDaily: orcamento },
      proposed_value_json: { budgetDaily: novo },
      confidence: confianca(roas, escala),
      risk_level: "LOW",
    };
  }

  // 3. ROAS baixo ou CPA acima do alvo → reduzir orçamento
  if ((roas > 0 && roas <= reducao) || (alvoCpa > 0 && cpa > alvoCpa && conversions > 0)) {
    const novo = arredondar(orcamento * (1 - pctDesce / 100));
    const motivos: string[] = [];
    if (roas > 0 && roas <= reducao) {
      motivos.push(`ROAS de ${dec(roas)} abaixo do limite de redução (${dec(reducao)})`);
    }
    if (alvoCpa > 0 && cpa > alvoCpa && conversions > 0) {
      motivos.push(`CPA de ${brl(cpa)} acima do alvo de ${brl(alvoCpa)}`);
    }
    return {
      ...base,
      action_type: "DECREASE_BUDGET",
      reason: `${motivos.join(" e ")}. Sugerido reduzir o orçamento diário em ${dec(pctDesce)}%.`,
      previous_value_json: { budgetDaily: orcamento },
      proposed_value_json: { budgetDaily: novo },
      confidence: confianca(roas > 0 ? roas : cpa, roas > 0 ? reducao : alvoCpa),
      risk_level: "MEDIUM",
    };
  }

  // 4. Frequência alta com CTR baixo → girar criativo (alerta)
  if (freq >= freqAlta && freqAlta > 0 && ctr <= ctrBaixo) {
    return {
      ...base,
      action_type: "ROTATE_CREATIVE",
      reason: `Frequência de ${dec(freq)} acima do limite de ${dec(freqAlta)} com CTR de ${dec(ctr)}% abaixo de ${dec(ctrBaixo)}%. Sugerido girar os criativos.`,
      previous_value_json: { frequency: freq, ctr },
      proposed_value_json: { action: "novo criativo" },
      confidence: confianca(freq, freqAlta),
      risk_level: "LOW",
    };
  }

  return null;
}

export function avaliarCampanhas(
  campanhas: CampanhaMetricas[],
  parametros: ParametrosMotor,
): DecisaoProposta[] {
  return campanhas
    .map((c) => avaliarCampanha(c, parametros))
    .filter((d): d is DecisaoProposta => d !== null);
}
