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

async function pedir<T>(chave: string, caminho: string, init?: RequestInit): Promise<T> {
  if (!chave) {
    throw new Error("Cadastre a chave do serviço de navegador (Browser Use) em Integrações antes de coletar.");
  }
  const resposta = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      "X-Browser-Use-API-Key": chave,
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
  const id = idNumericoMeta(conta);
  return nome
    ? `na conta "${nome}"${id ? ` (ID ${id})` : ""} — no seletor de contas, escolha essa conta`
    : "na conta de anúncios já ativa na sessão (não troque de conta)";
}

const ESPERA_LOGIN =
  "Se a página pedir login/entrada, NÃO digite nada e NÃO recarregue a página: a pessoa vai entrar manualmente pela janela ao vivo. Apenas aguarde de forma passiva, verificando a cada poucos segundos, até o painel logado aparecer; então continue a tarefa.";

function instrucao(plataforma: "META" | "GOOGLE_ADS", conta: string, dias: number) {
  const periodo = `últimos ${dias} dias`;
  if (plataforma === "META") {
    return [
      ESPERA_LOGIN,
      "Se a sessão já estiver logada no Gerenciador de Anúncios (adsmanager.facebook.com/adsmanager/manage/campaigns), siga a partir dessa tela mesmo, sem voltar para a página institucional.",
      "Se você estiver na página institucional do Gerenciador de Anúncios, clique no botão de acesso ao Gerenciador para abrir o painel.",
      `Trabalhe ${alvoConta(conta)}.`,
      `Vá para a aba Campanhas e ajuste o período para os ${periodo}.`,
      "Garanta que as colunas mostrem: orçamento diário, valor gasto, impressões, cliques, resultados/conversões, valor de conversão de compras e frequência.",
      "Leia TODAS as campanhas listadas (role a tabela até o fim).",
      "NUNCA edite, pause, ative ou altere qualquer campanha, orçamento ou configuração. A tarefa é somente leitura.",
      "Devolva os números em JSON: budget_daily, spend e revenue em reais (número puro, sem R$ nem pontos de milhar);",
      "revenue é o valor de conversão de compras (0 se não houver); conversions é o total de resultados; frequency a frequência média (0 se não existir).",
    ].join(" ");
  }
  return [
    ESPERA_LOGIN,
    `Abra o Google Ads ${alvoConta(conta)}.`,
    `Vá para Campanhas e ajuste o período para os ${periodo}.`,
    "Garanta que as colunas mostrem: orçamento, custo, impressões, cliques, conversões e valor de conversão.",
    "Leia TODAS as campanhas listadas (role a tabela até o fim).",
    "NUNCA edite, pause, ative ou altere qualquer campanha, orçamento ou configuração. A tarefa é somente leitura.",
    "Devolva os números em JSON: budget_daily, spend e revenue em reais (número puro); revenue é o valor de conversão; frequency sempre 0.",
  ].join(" ");
}


const URL_META = "https://pt-br.facebook.com/business/tools/ads-manager";

function urlInicial(plataforma: "META" | "GOOGLE_ADS") {
  return plataforma === "META" ? URL_META : "https://ads.google.com/aw/campaigns";
}


/** Endereço da janela ao vivo da sessão (para a pessoa fazer login). */
export async function obterSessao(chave: string, sessionId: string): Promise<string | null> {
  try {
    const s = await pedir<{ liveUrl?: string; publicShareUrl?: string; live_url?: string }>(
      chave,
      `/sessions/${encodeURIComponent(sessionId)}`,
    );
    return s?.liveUrl ?? s?.live_url ?? s?.publicShareUrl ?? null;
  } catch {
    return null;
  }
}

/** Cria (ou reaproveita) um perfil de navegador para manter o login salvo. */
export async function garantirPerfil(chave: string, perfilAtual: string | null): Promise<string> {
  if (perfilAtual) return perfilAtual;
  const criado = await pedir<{ id?: string; profileId?: string }>(chave, "/profiles", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const id = criado?.id ?? criado?.profileId;
  if (!id) throw new Error("Não foi possível criar o perfil de navegador.");
  return id;
}

/** Apaga o perfil salvo (usado ao desconectar a conta). */
export async function excluirPerfil(chave: string, perfilId: string): Promise<void> {
  try {
    await pedir(chave, `/profiles/${encodeURIComponent(perfilId)}`, { method: "DELETE" });
  } catch {
    /* o perfil pode já ter sido removido no serviço */
  }
}

type RespostaTarefa = {
  id?: string;
  taskId?: string;
  sessionId?: string;
  session?: { id?: string; liveUrl?: string };
  liveUrl?: string;
};

async function criarTarefa(
  chave: string,
  corpo: Record<string, unknown>,
): Promise<{ taskId: string; sessionId: string | null; liveUrl: string | null }> {
  const criada = await pedir<RespostaTarefa>(chave, "/tasks", { method: "POST", body: JSON.stringify(corpo) });
  const taskId = criada?.id ?? criada?.taskId;
  if (!taskId) throw new Error("O serviço de navegador não devolveu o identificador da tarefa.");
  const sessionId = criada?.sessionId ?? criada?.session?.id ?? null;
  let liveUrl = criada?.session?.liveUrl ?? criada?.liveUrl ?? null;
  if (!liveUrl && sessionId) liveUrl = await obterSessao(chave, sessionId);
  return { taskId, sessionId, liveUrl };
}

/**
 * Abre uma sessão para a pessoa entrar na conta (Meta/Google). O agente só
 * espera o login acontecer e confirma que o painel carregou — nada é lido nem
 * alterado aqui. O login fica salvo no perfil do serviço.
 */
export async function iniciarLogin(entrada: {
  chave: string;
  plataforma: "META" | "GOOGLE_ADS";
  perfilId: string;
  modelo: string;
}): Promise<{ taskId: string; sessionId: string | null; liveUrl: string | null }> {
  const meta = entrada.plataforma === "META";
  const task = (
    meta
      ? [
          `Você começa em ${URL_META}, a página do Gerenciador de Anúncios da Meta.`,
          "Clique no botão de acesso ao Gerenciador de Anúncios para abrir o painel.",
          ESPERA_LOGIN,
          "Quando o painel de campanhas logado carregar, finalize a tarefa respondendo apenas: LOGADO.",
          "Não altere nenhuma configuração, campanha ou orçamento.",
        ]
      : [
          "Abra o Google Ads (ads.google.com) e verifique se a sessão já está logada.",
          ESPERA_LOGIN,
          "Quando a lista de campanhas logada carregar, finalize a tarefa respondendo apenas: LOGADO.",
          "Não altere nenhuma configuração, campanha ou orçamento.",
        ]
  ).join(" ");
  return criarTarefa(entrada.chave, {
    task,
    llm: entrada.modelo,
    startUrl: urlInicial(entrada.plataforma),
    profileId: entrada.perfilId,
    maxSteps: 40,
  });
}

/** Dispara a coleta e devolve o identificador da tarefa na nuvem. */
export async function iniciarColeta(entrada: {
  chave: string;
  plataforma: "META" | "GOOGLE_ADS";
  conta: string;
  dias: number;
  perfilId: string;
  modelo: string;
}): Promise<{ taskId: string; sessionId: string | null; liveUrl: string | null }> {
  return criarTarefa(entrada.chave, {
    task: instrucao(entrada.plataforma, entrada.conta, entrada.dias),
    llm: entrada.modelo,
    startUrl: urlInicial(entrada.plataforma),
    profileId: entrada.perfilId,
    maxSteps: 120,

    structuredOutput: JSON.stringify(esquemaSaida),
  });
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

/** Procura o array de campanhas em qualquer nível razoável da resposta. */
function acharLista(valor: unknown, profundidade = 0): unknown[] | null {
  if (valor == null || profundidade > 4) return null;
  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto.startsWith("{") && !texto.startsWith("[")) return null;
    try {
      return acharLista(JSON.parse(texto), profundidade + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    for (const chave of ["campaigns", "campanhas", "data", "result", "output", "doneOutput"]) {
      const achado = acharLista(objeto[chave], profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

function converter(saida: unknown, plataforma: string): CampanhaExterna[] {
  const lista = acharLista(saida);
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

/** Consulta o andamento de uma tarefa (login ou coleta). */
export async function consultarColeta(chave: string, taskId: string, plataforma: string): Promise<EstadoTarefa> {
  const tarefa = await pedir<{
    status?: string;
    output?: unknown;
    doneOutput?: unknown;
    steps?: { nextGoal?: string; next_goal?: string }[];
    sessionId?: string;
    session?: { id?: string; liveUrl?: string };
    liveUrl?: string;
    error?: string;
  }>(chave, `/tasks/${encodeURIComponent(taskId)}`);

  const status = normalizarStatus(tarefa?.status);
  const passos = tarefa?.steps ?? [];
  const ultimo = passos[passos.length - 1];
  const sessionId = tarefa?.sessionId ?? tarefa?.session?.id ?? null;
  let liveUrl = tarefa?.session?.liveUrl ?? tarefa?.liveUrl ?? null;
  if (!liveUrl && sessionId && status === "RUNNING") liveUrl = await obterSessao(chave, sessionId);
  const campanhas =
    status === "FINISHED" ? converter(tarefa?.output ?? tarefa?.doneOutput ?? null, plataforma) : [];
  return {
    status,
    passo: ultimo?.nextGoal ?? ultimo?.next_goal ?? null,
    liveUrl,
    erro:
      tarefa?.error ??
      (status === "FINISHED" && campanhas.length === 0
        ? "A sessão terminou sem devolver a tabela de campanhas. Verifique se o painel estava logado e tente de novo."
        : null),
    campanhas,
  };
}


/** Interrompe uma coleta em andamento. */
export async function pararColeta(chave: string, taskId: string): Promise<void> {
  await pedir(chave, `/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "stop" }),
  });
}
