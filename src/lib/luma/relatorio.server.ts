import type { Sb } from "../luma.server";

export type LinhaDia = {
  dia: string;
  investimento: number;
  receita: number;
  conversoes: number;
  cliques: number;
  impressoes: number;
};

export type Totais = {
  investimento: number;
  receita: number;
  conversoes: number;
  cliques: number;
  impressoes: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
};

export type Relatorio = {
  dias: number;
  inicio: string;
  fim: string;
  serie: LinhaDia[];
  atual: Totais;
  anterior: Totais;
  decisoes: {
    total: number;
    porStatus: Record<string, number>;
    impactoOrcamento: number;
    itens: {
      id: string;
      created_at: string;
      status: string;
      action_type: string;
      platform: string;
      campaign_name: string | null;
      reason: string;
      confidence: number;
      delta: number | null;
    }[];
  };
};

const vazio = (): Totais => ({
  investimento: 0,
  receita: 0,
  conversoes: 0,
  cliques: 0,
  impressoes: 0,
  roas: 0,
  cpa: 0,
  ctr: 0,
  cpc: 0,
});

function finalizar(t: Totais): Totais {
  return {
    ...t,
    roas: t.investimento > 0 ? t.receita / t.investimento : 0,
    cpa: t.conversoes > 0 ? t.investimento / t.conversoes : 0,
    ctr: t.impressoes > 0 ? (t.cliques / t.impressoes) * 100 : 0,
    cpc: t.cliques > 0 ? t.investimento / t.cliques : 0,
  };
}

function somar(t: Totais, s: Record<string, unknown>): Totais {
  t.investimento += Number(s['spend'] ?? 0);
  t.receita += Number(s['revenue'] ?? 0);
  t.conversoes += Number(s['conversions'] ?? 0);
  t.cliques += Number(s['clicks'] ?? 0);
  t.impressoes += Number(s['impressions'] ?? 0);
  return t;
}

function orcamento(valor: unknown): number | null {
  if (!valor || typeof valor !== "object") return null;
  const registro = valor as Record<string, unknown>;
  const bruto = registro['budget_daily'] ?? registro['budget'] ?? registro['daily_budget'];
  if (bruto === undefined || bruto === null) return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}

/** Monta o relatório do período escolhido e o comparativo com o período imediatamente anterior. */
export async function montarRelatorio(sb: Sb, ws: string, dias: number): Promise<Relatorio> {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86400000);
  const inicioAnterior = new Date(inicio.getTime() - dias * 86400000);

  const [snapsAtual, snapsAnterior, decisoes] = await Promise.all([
    sb
      .from("metric_snapshots")
      .select("captured_at, spend, revenue, conversions, clicks, impressions")
      .eq("workspace_id", ws)
      .gte("captured_at", inicio.toISOString())
      .order("captured_at", { ascending: true }),
    sb
      .from("metric_snapshots")
      .select("spend, revenue, conversions, clicks, impressions")
      .eq("workspace_id", ws)
      .gte("captured_at", inicioAnterior.toISOString())
      .lt("captured_at", inicio.toISOString()),
    sb
      .from("decisions")
      .select(
        "id, created_at, status, action_type, platform, campaign_name, reason, confidence, previous_value_json, proposed_value_json",
      )
      .eq("workspace_id", ws)
      .gte("created_at", inicio.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const mapa = new Map<string, LinhaDia>();
  const atual = vazio();
  for (const s of snapsAtual.data ?? []) {
    somar(atual, s as unknown as Record<string, unknown>);
    const dia = String(s.captured_at).slice(0, 10);
    const linha =
      mapa.get(dia) ??
      { dia, investimento: 0, receita: 0, conversoes: 0, cliques: 0, impressoes: 0 };
    linha.investimento += Number(s.spend ?? 0);
    linha.receita += Number(s.revenue ?? 0);
    linha.conversoes += Number(s.conversions ?? 0);
    linha.cliques += Number(s.clicks ?? 0);
    linha.impressoes += Number(s.impressions ?? 0);
    mapa.set(dia, linha);
  }

  const anterior = vazio();
  for (const s of snapsAnterior.data ?? []) somar(anterior, s as unknown as Record<string, unknown>);

  const porStatus: Record<string, number> = {};
  let impactoOrcamento = 0;
  const itens = (decisoes.data ?? []).map((d) => {
    porStatus[d.status] = (porStatus[d.status] ?? 0) + 1;
    const de = orcamento(d.previous_value_json);
    const para = orcamento(d.proposed_value_json);
    const delta = de !== null && para !== null ? para - de : null;
    if (delta !== null && d.status === "EXECUTED") impactoOrcamento += delta;
    return {
      id: d.id,
      created_at: d.created_at,
      status: d.status as string,
      action_type: d.action_type as string,
      platform: d.platform as string,
      campaign_name: d.campaign_name,
      reason: d.reason,
      confidence: Number(d.confidence ?? 0),
      delta,
    };
  });

  return {
    dias,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    serie: [...mapa.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
    atual: finalizar(atual),
    anterior: finalizar(anterior),
    decisoes: { total: itens.length, porStatus, impactoOrcamento, itens },
  };
}

function celula(valor: string | number): string {
  const texto = String(valor).replace(/"/g, '""');
  return `"${texto}"`;
}

function numeroBr(valor: number, casas = 2): string {
  return valor.toFixed(casas).replace(".", ",");
}

/** Gera o CSV (separador ponto e vírgula, padrão pt-BR) do relatório do período. */
export function gerarCsv(relatorio: Relatorio): string {
  const linhas: string[] = [];
  linhas.push(
    ["Dia", "Investimento", "Receita", "ROAS", "Conversoes", "CPA", "Cliques", "Impressoes"]
      .map(celula)
      .join(";"),
  );
  for (const l of relatorio.serie) {
    const roas = l.investimento > 0 ? l.receita / l.investimento : 0;
    const cpa = l.conversoes > 0 ? l.investimento / l.conversoes : 0;
    linhas.push(
      [
        l.dia.split("-").reverse().join("/"),
        numeroBr(l.investimento),
        numeroBr(l.receita),
        numeroBr(roas),
        numeroBr(l.conversoes),
        numeroBr(cpa),
        String(l.cliques),
        String(l.impressoes),
      ]
        .map(celula)
        .join(";"),
    );
  }
  linhas.push("");
  linhas.push(["Decisoes", "Data", "Status", "Acao", "Plataforma", "Campanha", "Motivo"].map(celula).join(";"));
  for (const d of relatorio.decisoes.itens) {
    linhas.push(
      [
        "",
        new Date(d.created_at).toLocaleString("pt-BR"),
        d.status,
        d.action_type,
        d.platform,
        d.campaign_name ?? "",
        d.reason,
      ]
        .map(celula)
        .join(";"),
    );
  }
  return `\uFEFF${linhas.join("\r\n")}`;
}
