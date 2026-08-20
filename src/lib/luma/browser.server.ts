/**
 * Coleta de métricas por navegador na nuvem (Browser Use Cloud).
 *
 * Um agente abre o Gerenciador de Anúncios da Meta ou o Google Ads em um
 * navegador hospedado, navega até o relatório de campanhas e devolve os números
 * em JSON. O login fica salvo em um "perfil" do serviço, então a pessoa só
 * precisa entrar uma vez, acompanhando a sessão ao vivo.
 *
 * A coleta é sempre de LEITURA: o agente nunca altera contas de anúncio.
 */
import type { CampanhaExterna } from "./sync.server";

const BASE = "https://api.browser-use.com/api/v2";

export type StatusTarefa = "RUNNING" | "FINISHED" | "FAILED" | "STOPPED";

export type EstadoTarefa = {
  status: StatusTarefa;
  passo: string | null;
  liveUrl: string | null;
  erro: string | null;
  campanhas: CampanhaExterna[];
};

export function chaveNavegadorConfigurada(): boolean {
  return Boolean(process.env["BROWSER_USE_API_KEY"]);
}

function chave(): string {
  const valor = process.env["BROWSER_USE_API_KEY"];
  if (!valor) {
    throw new Error("A chave do serviço de navegador (Browser Use) não está configurada neste projeto.");
  }
  return valor;
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      "X-Browser-Use-API-Key": chave(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const texto = await resposta.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!resposta.ok) {
    const detalhe =
      (json as { detail?: string; message?: string } | null)?.detail ??
      (json as { message?: string } | null)?.message ??
      texto.slice(0, 300);
    if (resposta.status === 401) {
      throw new Error("A chave do serviço de navegador é inválida ou expirou.");
    }
    if (resposta.status === 403) {
      throw new Error(detalhe || "O serviço de navegador recusou a solicitação.");
    }
    if (resposta.status === 402) {
      throw new Error(
        "A conta do serviço de navegador (Browser Use) está sem saldo: é preciso ao menos US$ 0,10 em créditos para iniciar uma coleta. Adicione créditos em cloud.browser-use.com e tente de novo. Enquanto isso, use a origem \"API oficial\" ou \"Demonstração\".",
      );
    }
    throw new Error(`Serviço de navegador respondeu ${resposta.status}: ${detalhe}`);
  }
  return json as T;
}

const esquemaSaida = {
  type: "object",
  properties: {
    campaigns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          objective: { type: "string" },
          budget_daily: { type: "number" },
          spend: { type: "number" },
          revenue: { type: "number" },
          impressions: { type: "number" },
          clicks: { type: "number" },
          conversions: { type: "number" },
          frequency: { type: "number" },
        },
        required: ["name", "spend", "impressions", "clicks", "conversions"],
      },
    },
  },
  required: ["campaigns"],
};

/** Aceita "act_123", "123", "123-456-7890" ou o nome da conta. */
function contaLegivel(conta: string) {
  return conta.trim();
}

/** Só vira parâmetro de URL quando parece um ID numérico da Meta. */
function idNumericoMeta(conta: string): string | null {
  const limpo = conta.trim().replace(/^act_/i, "");
  return /^\d{5,}$/.test(limpo) ? limpo : null;
}

function alvoConta(conta: string) {
  const nome = contaLegivel(conta);
  return nome
    ? `na conta "${nome}" (se houver seletor de contas, escolha essa)`
    : "na conta de anúncios já ativa na sessão (não troque de conta)";
}

function instrucao(plataforma: "META" | "GOOGLE_ADS", conta: string, dias: number) {
  const periodo = `últimos ${dias} dias`;
  if (plataforma === "META") {
    return [
      `Abra o Gerenciador de Anúncios da Meta ${alvoConta(conta)}.`,
      "Se aparecer tela de login, PARE e aguarde a pessoa entrar manualmente na sessão ao vivo; depois continue.",
      `Vá para a aba Campanhas e ajuste o período para os ${periodo}.`,
      "Garanta que as colunas mostrem: orçamento diário, valor gasto, impressões, cliques, resultados/conversões, valor de conversão de compras e frequência.",
      "Leia TODAS as campanhas listadas (role a tabela até o fim).",
      "NUNCA edite, pause, ative ou altere qualquer campanha, orçamento ou configuração. A tarefa é somente leitura.",
      "Devolva os números em JSON: budget_daily, spend e revenue em reais (número puro, sem R$ nem pontos de milhar);",
      "revenue é o valor de conversão de compras (0 se não houver); conversions é o total de resultados; frequency a frequência média (0 se não existir).",
    ].join(" ");
  }
  return [
    `Abra o Google Ads ${alvoConta(conta)}.`,
    "Se aparecer tela de login, PARE e aguarde a pessoa entrar manualmente na sessão ao vivo; depois continue.",
    `Vá para Campanhas e ajuste o período para os ${periodo}.`,
    "Garanta que as colunas mostrem: orçamento, custo, impressões, cliques, conversões e valor de conversão.",
    "Leia TODAS as campanhas listadas (role a tabela até o fim).",
    "NUNCA edite, pause, ative ou altere qualquer campanha, orçamento ou configuração. A tarefa é somente leitura.",
    "Devolva os números em JSON: budget_daily, spend e revenue em reais (número puro); revenue é o valor de conversão; frequency sempre 0.",
  ].join(" ");
}

function urlInicial(plataforma: "META" | "GOOGLE_ADS", conta: string) {
  if (plataforma !== "META") return "https://ads.google.com/aw/campaigns";
  const id = idNumericoMeta(conta);
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns${id ? `?act=${id}` : ""}`;
}


/** Cria (ou reaproveita) um perfil de navegador para manter o login salvo. */
export async function garantirPerfil(perfilAtual: string | null): Promise<string> {
  if (perfilAtual) return perfilAtual;
  const criado = await pedir<{ id?: string; profileId?: string }>("/profiles", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const id = criado?.id ?? criado?.profileId;
  if (!id) throw new Error("Não foi possível criar o perfil de navegador.");
  return id;
}

/** Dispara a coleta e devolve o identificador da tarefa na nuvem. */
export async function iniciarColeta(entrada: {
  plataforma: "META" | "GOOGLE_ADS";
  conta: string;
  dias: number;
  perfilId: string;
  modelo: string;
}): Promise<{ taskId: string; liveUrl: string | null }> {
  const criada = await pedir<{ id?: string; taskId?: string; sessionId?: string; session?: { liveUrl?: string }; liveUrl?: string }>(
    "/tasks",
    {
      method: "POST",
      body: JSON.stringify({
        task: instrucao(entrada.plataforma, entrada.conta, entrada.dias),
        llm: entrada.modelo,
        startUrl: urlInicial(entrada.plataforma, entrada.conta),
        profileId: entrada.perfilId,
        maxSteps: 60,
        structuredOutput: JSON.stringify(esquemaSaida),
      }),
    },
  );
  const taskId = criada?.id ?? criada?.taskId;
  if (!taskId) throw new Error("O serviço de navegador não devolveu o identificador da tarefa.");
  return { taskId, liveUrl: criada?.session?.liveUrl ?? criada?.liveUrl ?? null };
}

function normalizarStatus(bruto: string | undefined): StatusTarefa {
  const s = (bruto ?? "").toLowerCase();
  if (s === "finished" || s === "completed" || s === "success") return "FINISHED";
  if (s === "failed" || s === "error") return "FAILED";
  if (s === "stopped" || s === "cancelled" || s === "canceled") return "STOPPED";
  return "RUNNING";
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const texto = String(valor ?? "").replace(/[^\d,.-]/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function converter(saida: unknown, plataforma: string): CampanhaExterna[] {
  let dados = saida;
  if (typeof dados === "string") {
    try {
      dados = JSON.parse(dados);
    } catch {
      return [];
    }
  }
  const lista = (dados as { campaigns?: unknown[] } | null)?.campaigns;
  if (!Array.isArray(lista)) return [];
  return lista.map((item, indice) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const nome = String(c["name"] ?? `Campanha ${indice + 1}`);
    return {
      id: `${plataforma.toLowerCase()}-nav-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
      name: nome,
      status: String(c["status"] ?? "ACTIVE").toUpperCase().includes("PAUS") ? "PAUSED" : "ACTIVE",
      objective: c["objective"] ? String(c["objective"]) : null,
      budget_daily: numero(c["budget_daily"]),
      spend: numero(c["spend"]),
      revenue: numero(c["revenue"]),
      impressions: Math.round(numero(c["impressions"])),
      clicks: Math.round(numero(c["clicks"])),
      conversions: numero(c["conversions"]),
      frequency: numero(c["frequency"]),
    };
  });
}

/** Consulta o andamento de uma coleta em curso. */
export async function consultarColeta(taskId: string, plataforma: string): Promise<EstadoTarefa> {
  const tarefa = await pedir<{
    status?: string;
    output?: unknown;
    doneOutput?: unknown;
    steps?: { nextGoal?: string; next_goal?: string }[];
    session?: { liveUrl?: string };
    liveUrl?: string;
    error?: string;
  }>(`/tasks/${encodeURIComponent(taskId)}`);

  const status = normalizarStatus(tarefa?.status);
  const passos = tarefa?.steps ?? [];
  const ultimo = passos[passos.length - 1];
  return {
    status,
    passo: ultimo?.nextGoal ?? ultimo?.next_goal ?? null,
    liveUrl: tarefa?.session?.liveUrl ?? tarefa?.liveUrl ?? null,
    erro: tarefa?.error ?? null,
    campanhas: status === "FINISHED" ? converter(tarefa?.output ?? tarefa?.doneOutput, plataforma) : [],
  };
}

/** Interrompe uma coleta em andamento. */
export async function pararColeta(taskId: string): Promise<void> {
  await pedir(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "stop" }),
  });
}
