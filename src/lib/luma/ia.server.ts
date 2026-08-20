/**
 * Cliente único de IA da LUMA (OpenAI).
 *
 * A chave fica em `OPENAI_API_KEY` e é lida sempre dentro do handler — nunca
 * no escopo do módulo, porque o ambiente só injeta os segredos por requisição.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export const MODELO_PADRAO = "gpt-4.1";

export const MODELOS_DISPONIVEIS = [
  { id: "gpt-4.1", rotulo: "GPT-4.1 — equilíbrio entre custo e qualidade" },
  { id: "gpt-4.1-mini", rotulo: "GPT-4.1 mini — mais rápido e barato" },
  { id: "gpt-4o", rotulo: "GPT-4o — multimodal" },
  { id: "gpt-4o-mini", rotulo: "GPT-4o mini — econômico" },
] as const;

export type MensagemChat = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};

export type FerramentaChat = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export function chaveIaConfigurada(): boolean {
  return Boolean(process.env["OPENAI_API_KEY"]);
}

function traduzErro(status: number, mensagem: string): string {
  if (status === 401) return "A chave da OpenAI é inválida ou foi revogada. Cadastre uma chave válida.";
  if (status === 429) return "A OpenAI está limitando os pedidos agora. Tente de novo em alguns instantes.";
  if (status === 402 || /quota|billing/i.test(mensagem)) {
    return "A conta da OpenAI está sem créditos disponíveis para este modelo.";
  }
  if (status === 404) return `Modelo indisponível para esta chave: ${mensagem}`;
  return `Falha na IA (${status}): ${mensagem}`;
}

type RespostaOpenAi = {
  choices?: { message: MensagemChat }[];
  error?: { message?: string };
};

/** Uma volta de chat completions com suporte a ferramentas. */
export async function chamarIa(
  mensagens: MensagemChat[],
  opcoes: { modelo?: string; ferramentas?: FerramentaChat[]; maxTokens?: number } = {},
): Promise<MensagemChat> {
  const chave = process.env["OPENAI_API_KEY"];
  if (!chave) throw new Error("A chave da OpenAI não está configurada neste projeto.");

  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opcoes.modelo || MODELO_PADRAO,
      messages: mensagens,
      ...(opcoes.ferramentas && opcoes.ferramentas.length > 0 ? { tools: opcoes.ferramentas } : {}),
      ...(opcoes.maxTokens ? { max_tokens: opcoes.maxTokens } : {}),
    }),
  });

  const corpo = await resposta.text();
  let json: RespostaOpenAi = {};
  try {
    json = JSON.parse(corpo) as RespostaOpenAi;
  } catch {
    /* resposta não-JSON */
  }
  if (!resposta.ok) throw new Error(traduzErro(resposta.status, json.error?.message ?? corpo.slice(0, 300)));

  const mensagem = json.choices?.[0]?.message;
  if (!mensagem) throw new Error("A IA não devolveu resposta.");
  return mensagem;
}

/** Teste rápido de chave/modelo usado na tela de Configurações. */
export async function testarIa(modelo: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!chaveIaConfigurada()) {
    return { ok: false, mensagem: "A chave da OpenAI não está configurada neste projeto." };
  }
  try {
    const resposta = await chamarIa(
      [{ role: "user", content: "Responda apenas com a palavra: pronto." }],
      { modelo, maxTokens: 10 },
    );
    return { ok: true, mensagem: `Conexão funcionando (${modelo}): ${(resposta.content ?? "").trim() || "resposta vazia"}` };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Falha ao falar com a OpenAI." };
  }
}
