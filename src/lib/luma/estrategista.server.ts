import type { Sb } from "../luma.server";
import { executarFerramenta, ferramentas } from "./mcp.server";

/**
 * Estrategista de tráfego pago da LUMA.
 * Lê os dados reais do workspace por ferramentas e pode PROPOR ações —
 * nunca aprova nem executa. Toda alteração continua passando pela fila
 * de aprovação humana.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const MODELO_PADRAO = "google/gemini-2.5-flash";
const MAX_VOLTAS = 5;

/** Ferramentas liberadas para a IA: leitura + proposta. Aprovar e executar ficam de fora. */
const PERMITIDAS = new Set([
  "ads_get_overview",
  "ads_list_campaigns",
  "ads_list_decisions",
  "ads_propose_action",
]);

export type MensagemChat = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};

export type ModoEstrategista = "RAPIDO" | "PRIME";

function instrucoes(modo: ModoEstrategista, demo: boolean, parado: boolean) {
  const base = [
    "Você é a estrategista de tráfego pago da LUMA, uma plataforma brasileira de gestão de Meta Ads e Google Ads.",
    "Responda SEMPRE em português do Brasil, com números em real (R$) e linguagem direta, sem jargão técnico desnecessário.",
    "Use as ferramentas para ler os dados reais antes de afirmar qualquer número — nunca invente métricas.",
    "Você pode PROPOR ações com ads_propose_action; elas nascem pendentes e só valem depois que a pessoa aprovar na tela de Decisões.",
    "Você não aprova, não executa e não altera contas de anúncio. Se pedirem isso, explique que a aprovação é sempre humana.",
    "Ao propor, justifique com a métrica que sustenta a decisão (ROAS, CPA, gasto sem conversão, frequência, CTR).",
  ];
  if (demo) base.push("O workspace está em modo demonstração: os números são fictícios; diga isso quando for relevante.");
  if (parado) base.push("O botão PARAR AGENTE está ativo: avise que nenhuma ação pode ser aprovada ou executada agora.");
  base.push(
    modo === "PRIME"
      ? "Modo LUMA PRIME: faça uma auditoria ampla antes de concluir — levante os dados de várias ferramentas, exponha a tese, os contrapontos e o risco de cada caminho, e só então recomende. Estruture a resposta em Auditoria, Tese, Contrapontos e Recomendação."
      : "Modo rápido: seja objetiva, no máximo alguns parágrafos curtos ou uma lista enxuta.",
  );
  return base.join("\n");
}

type RespostaGateway = {
  choices?: { message: MensagemChat }[];
  error?: { message?: string };
  message?: string;
};

async function chamarGateway(mensagens: MensagemChat[], modo: ModoEstrategista) {
  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave) throw new Error("A IA não está configurada neste projeto (chave ausente).");

  const resposta = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO_PADRAO,
      messages: mensagens,
      tools: ferramentas
        .filter((f) => PERMITIDAS.has(f.name))
        .map((f) => ({
          type: "function",
          function: { name: f.name, description: f.description, parameters: f.inputSchema },
        })),
      ...(modo === "PRIME" ? {} : { max_tokens: 1200 }),
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    let mensagem = corpo;
    try {
      const json = JSON.parse(corpo) as RespostaGateway;
      mensagem = json.error?.message ?? json.message ?? corpo;
    } catch {
      /* corpo não-JSON: mantém o texto cru */
    }
    if (resposta.status === 429) {
      throw new Error("A IA está recebendo muitos pedidos agora. Tente de novo em alguns instantes.");
    }
    if (resposta.status === 402) {
      throw new Error(`Créditos de IA insuficientes: ${mensagem}`);
    }
    if (resposta.status === 403) {
      throw new Error(`A IA está bloqueada para este projeto: ${mensagem}`);
    }
    throw new Error(`Falha na IA (${resposta.status}): ${mensagem}`);
  }

  const json = (await resposta.json()) as RespostaGateway;
  const mensagem = json.choices?.[0]?.message;
  if (!mensagem) throw new Error("A IA não devolveu resposta.");
  return mensagem;
}

export type ResultadoEstrategista = {
  resposta: string;
  ferramentasUsadas: { nome: string; resumo: string }[];
  propostas: string[];
};

/**
 * Executa uma volta de conversa com laço de ferramentas limitado.
 * Devolve o texto final e o que foi consultado/proposto no caminho.
 */
export async function conversar(
  sb: Sb,
  ws: string,
  historico: MensagemChat[],
  modo: ModoEstrategista,
  contexto: { demo: boolean; parado: boolean },
): Promise<ResultadoEstrategista> {
  const mensagens: MensagemChat[] = [
    { role: "system", content: instrucoes(modo, contexto.demo, contexto.parado) },
    ...historico,
  ];
  const usadas: { nome: string; resumo: string }[] = [];
  const propostas: string[] = [];

  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    const mensagem = await chamarGateway(mensagens, modo);
    mensagens.push(mensagem);

    const chamadas = mensagem.tool_calls ?? [];
    if (chamadas.length === 0) {
      return { resposta: mensagem.content ?? "", ferramentasUsadas: usadas, propostas };
    }

    for (const chamada of chamadas) {
      const nome = chamada.function.name;
      let saida: unknown;
      try {
        if (!PERMITIDAS.has(nome)) throw new Error("Ferramenta não permitida para a IA.");
        const args = chamada.function.arguments ? (JSON.parse(chamada.function.arguments) as Record<string, unknown>) : {};
        saida = await executarFerramenta(sb, ws, nome, args);
        if (nome === "ads_propose_action") {
          const id = (saida as { decision_id?: string }).decision_id;
          if (id) propostas.push(id);
        }
        usadas.push({ nome, resumo: "consulta concluída" });
      } catch (erro) {
        saida = { erro: erro instanceof Error ? erro.message : "Falha na ferramenta." };
        usadas.push({ nome, resumo: "falhou" });
      }
      mensagens.push({
        role: "tool",
        tool_call_id: chamada.id,
        content: JSON.stringify(saida).slice(0, 12000),
      });
    }
  }

  return {
    resposta:
      "Consultei bastante coisa e ainda não cheguei a uma conclusão fechada. Refaça a pergunta de forma mais específica (por exemplo, citando uma campanha ou uma métrica).",
    ferramentasUsadas: usadas,
    propostas,
  };
}
