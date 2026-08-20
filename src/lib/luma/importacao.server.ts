/**
 * Importação de relatórios exportados dos painéis de anúncios.
 *
 * O usuário exporta (ou copia) a tabela de campanhas do Gerenciador de Anúncios
 * ou do Google Ads e cola aqui. O GPT normaliza cabeçalhos em português e
 * inglês, números no formato brasileiro e colunas com nomes diferentes, e
 * devolve campanhas prontas para gravar. Não há navegador na nuvem envolvido,
 * portanto não há custo de infraestrutura por coleta.
 */
import type { Sb } from "../luma.server";
import { chamarIa, MODELO_PADRAO } from "./ia.server";
import { gravarCampanhas, type CampanhaExterna } from "./sync.server";

export type Plataforma = "META" | "GOOGLE_ADS";
export const CONTA_IMPORTACAO = "importacao";

/** Teto de segurança: acima disso o texto é dividido em lotes. */
const LINHAS_POR_LOTE = 60;
const MAX_CARACTERES = 200_000;

const INSTRUCAO = `Você converte relatórios de campanhas de anúncios em JSON.

Receberá o texto bruto de um relatório exportado (CSV, TSV ou tabela copiada da tela) do Meta Ads ou do Google Ads, em português ou inglês.

Regras:
- Cada campanha vira um item. Ignore linhas de total, subtotal, cabeçalho repetido, filtros e rodapé.
- Reconheça sinônimos de coluna:
  nome: Campanha, Nome da campanha, Campaign, Campaign name
  status: Situação, Veiculação, Status, Campaign status (ATIVA/ACTIVE/Em veiculação => ACTIVE; PAUSADA/PAUSED => PAUSED; demais => o texto em maiúsculas)
  objetivo: Objetivo, Objective, Tipo de campanha, Campaign type
  orçamento diário: Orçamento, Orçamento diário, Budget, Daily budget (se for orçamento total, divida pelo número de dias do período informado)
  gasto: Valor usado, Valor gasto, Gasto, Custo, Amount spent, Cost
  receita: Valor de conversão, Valor de conversão da compra, Receita, Conv. value, Purchase conversion value, Total conv. value
  impressões: Impressões, Impressions, Impr.
  cliques: Cliques, Cliques no link, Clicks
  conversões: Compras, Resultados, Conversões, Conversions, Purchases
  frequência: Frequência, Frequency
- Números em formato brasileiro (1.234,56) viram 1234.56. Remova R$, %, espaços e separadores de milhar. Traço, "--", "-" ou vazio viram 0.
- Se o relatório trouxer CPA/ROAS mas não receita, calcule receita = ROAS x gasto quando ambos existirem; caso contrário use 0.
- Nunca invente campanhas nem números que não estejam no texto.

Responda SOMENTE com JSON válido no formato:
{"campanhas":[{"name":string,"status":string,"objective":string|null,"budget_daily":number,"spend":number,"revenue":number,"impressions":number,"clicks":number,"conversions":number,"frequency":number}],"avisos":[string]}`;

/** Id estável por plataforma + nome, para reimportar substituindo em vez de duplicar. */
function idEstavel(plataforma: Plataforma, nome: string): string {
  let h = 0;
  const base = nome.trim().toLowerCase();
  for (let i = 0; i < base.length; i += 1) h = (h * 31 + base.charCodeAt(i)) % 2147483647;
  return `import-${plataforma === "META" ? "meta" : "google"}-${h.toString(36)}`;
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor !== "string") return 0;
  const limpo = valor
    .replace(/[R$\s%]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function extrairJson(texto: string): { campanhas?: unknown[]; avisos?: unknown[] } {
  const bruto = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim < 0) throw new Error("A IA não conseguiu interpretar este relatório. Confira o conteúdo colado.");
  try {
    return JSON.parse(bruto.slice(inicio, fim + 1)) as { campanhas?: unknown[]; avisos?: unknown[] };
  } catch {
    throw new Error("A leitura do relatório voltou incompleta. Tente importar um período menor.");
  }
}

/** Divide o texto em lotes de linhas, mantendo o cabeçalho em todos. */
function lotes(texto: string): string[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length <= LINHAS_POR_LOTE) return [linhas.join("\n")];
  const cabecalho = linhas[0] ?? "";
  const partes: string[] = [];
  for (let i = 1; i < linhas.length; i += LINHAS_POR_LOTE) {
    partes.push([cabecalho, ...linhas.slice(i, i + LINHAS_POR_LOTE)].join("\n"));
  }
  return partes;
}

export type PreviaImportacao = {
  campanhas: CampanhaExterna[];
  avisos: string[];
  totais: { gasto: number; receita: number; conversoes: number; roas: number };
};

/** Lê o relatório e devolve a prévia — nada é gravado aqui. */
export async function analisarRelatorio(entrada: {
  plataforma: Plataforma;
  conteudo: string;
  dias: number;
  modelo?: string;
}): Promise<PreviaImportacao> {
  const conteudo = entrada.conteudo.trim();
  if (conteudo.length < 20) throw new Error("Cole o relatório exportado ou o conteúdo da tabela de campanhas.");
  if (conteudo.length > MAX_CARACTERES) {
    throw new Error("O relatório é muito grande. Exporte um período menor ou divida o arquivo.");
  }

  const campanhas: CampanhaExterna[] = [];
  const avisos: string[] = [];
  const vistos = new Set<string>();

  for (const parte of lotes(conteudo)) {
    const resposta = await chamarIa(
      [
        { role: "system", content: INSTRUCAO },
        {
          role: "user",
          content: `Plataforma: ${entrada.plataforma === "META" ? "Meta Ads" : "Google Ads"}\nPeríodo do relatório: últimos ${entrada.dias} dias\n\nRelatório:\n${parte}`,
        },
      ],
      { modelo: entrada.modelo ?? MODELO_PADRAO },
    );

    const dados = extrairJson(resposta.content ?? "");
    for (const item of (dados.campanhas ?? []) as Record<string, unknown>[]) {
      const nome = String(item["name"] ?? "").trim();
      if (!nome) continue;
      const id = idEstavel(entrada.plataforma, nome);
      if (vistos.has(id)) continue;
      vistos.add(id);
      campanhas.push({
        id,
        name: nome,
        status: String(item["status"] ?? "ACTIVE").toUpperCase(),
        objective: item["objective"] ? String(item["objective"]) : null,
        budget_daily: numero(item["budget_daily"]),
        spend: numero(item["spend"]),
        revenue: numero(item["revenue"]),
        impressions: Math.round(numero(item["impressions"])),
        clicks: Math.round(numero(item["clicks"])),
        conversions: numero(item["conversions"]),
        frequency: numero(item["frequency"]),
      });
    }
    for (const aviso of (dados.avisos ?? []) as unknown[]) {
      const texto = String(aviso).trim();
      if (texto && !avisos.includes(texto)) avisos.push(texto);
    }
  }

  if (campanhas.length === 0) {
    throw new Error(
      "Nenhuma campanha foi reconhecida no conteúdo enviado. Confira se o relatório traz uma linha por campanha com as colunas de gasto e resultados.",
    );
  }

  const gasto = campanhas.reduce((t, c) => t + c.spend, 0);
  const receita = campanhas.reduce((t, c) => t + c.revenue, 0);
  const conversoes = campanhas.reduce((t, c) => t + c.conversions, 0);

  return {
    campanhas,
    avisos,
    totais: { gasto, receita, conversoes, roas: gasto > 0 ? receita / gasto : 0 },
  };
}

/** Grava a prévia confirmada como dados reais do workspace. */
export async function confirmarRelatorio(
  sb: Sb,
  ws: string,
  entrada: { plataforma: Plataforma; dias: number; campanhas: CampanhaExterna[]; rotulo?: string },
) {
  if (entrada.campanhas.length === 0) throw new Error("Não há campanhas para importar.");

  const total = await gravarCampanhas(sb, ws, entrada.plataforma, CONTA_IMPORTACAO, entrada.campanhas);
  const gasto = entrada.campanhas.reduce((t, c) => t + c.spend, 0);
  const receita = entrada.campanhas.reduce((t, c) => t + c.revenue, 0);

  await sb.from("import_batches").insert({
    workspace_id: ws,
    platform: entrada.plataforma,
    lookback_days: entrada.dias,
    campaigns: total,
    spend: gasto,
    revenue: receita,
    source_label: entrada.rotulo ?? null,
    summary: `${total} campanhas importadas do relatório (${entrada.dias} dias).`,
  });

  await sb.from("sync_runs").insert({
    workspace_id: ws,
    platform: entrada.plataforma,
    status: "SUCCESS",
    accounts: 1,
    campaigns: total,
    message: `${total} campanhas importadas de relatório exportado.`,
    finished_at: new Date().toISOString(),
  });

  // A origem passa a valer como fonte real e a plataforma aparece como conectada.
  await sb.from("browser_collections").upsert(
    {
      workspace_id: ws,
      platform: entrada.plataforma,
      mode: "IMPORT",
      lookback_days: entrada.dias,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,platform" },
  );

  await registrarIntegracao(sb, ws, entrada.plataforma);
  return { campanhas: total, gasto, receita };
}

/** Marca a plataforma como conta conectada por importação. */
async function registrarIntegracao(sb: Sb, ws: string, plataforma: Plataforma) {
  const nome = plataforma === "META" ? "Meta Ads (importação)" : "Google Ads (importação)";
  const { data: existente } = await sb
    .from("integrations")
    .select("id, metadata_json")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();

  const origem = (existente?.metadata_json as { origem?: string } | null)?.origem;
  if (existente && origem && origem !== "IMPORTACAO") return; // não sobrescreve conexão por API

  const dados = {
    workspace_id: ws,
    platform: plataforma as "META" | "GOOGLE_ADS",
    account_id: CONTA_IMPORTACAO,
    name: nome,
    status: "CONNECTED" as const,
    metadata_json: { origem: "IMPORTACAO" },
    updated_at: new Date().toISOString(),
  };
  if (existente) await sb.from("integrations").update(dados).eq("id", existente.id);
  else await sb.from("integrations").insert(dados);
}

/** Últimas importações, para o histórico da tela. */
export async function listarImportacoes(sb: Sb, ws: string) {
  const { data } = await sb
    .from("import_batches")
    .select("*")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}
