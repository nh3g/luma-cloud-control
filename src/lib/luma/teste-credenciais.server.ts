import type { CredenciaisPlataforma, Plataforma } from "./credenciais.server";

/**
 * Teste de credenciais do app (não da conta de anúncio).
 * Faz uma chamada mínima em cada provedor e traduz a resposta,
 * para separar "chave errada" de "aplicação sem permissão".
 */

export type ResultadoTeste = { ok: boolean; mensagem: string };

async function testarMeta(c: CredenciaisPlataforma): Promise<ResultadoTeste> {
  const url = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("client_secret", c.clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const resposta = await fetch(url, { method: "GET" });
  const corpo = (await resposta.json().catch(() => null)) as
    | { access_token?: string; error?: { message?: string; code?: number } }
    | null;

  if (resposta.ok && corpo?.access_token) {
    return { ok: true, mensagem: "Credenciais do Meta válidas. Agora conecte a conta de anúncios." };
  }
  const codigo = corpo?.error?.code;
  if (codigo === 101) return { ok: false, mensagem: "ID do app não encontrado. Confira o App ID no painel da Meta." };
  if (codigo === 1) return { ok: false, mensagem: "Chave secreta do app incorreta." };
  return {
    ok: false,
    mensagem: corpo?.error?.message
      ? `A Meta recusou as chaves: ${corpo.error.message}`
      : "A Meta recusou as chaves. Confira o App ID e a chave secreta.",
  };
}

async function testarGoogle(c: CredenciaisPlataforma): Promise<ResultadoTeste> {
  if (!c.developerToken) {
    return { ok: false, mensagem: "Falta o token de desenvolvedor do Google Ads." };
  }
  // Uma troca propositalmente inválida: se as chaves do app estiverem certas,
  // o Google reclama do código (invalid_grant), não da aplicação (invalid_client).
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "refresh_token",
      refresh_token: "teste-de-credencial-luma",
    }),
  });
  const corpo = (await resposta.json().catch(() => null)) as
    | { error?: string; error_description?: string }
    | null;

  if (corpo?.error === "invalid_grant") {
    return { ok: true, mensagem: "Credenciais do Google válidas. Agora conecte a conta do Google Ads." };
  }
  if (corpo?.error === "invalid_client") {
    return { ok: false, mensagem: "ID do cliente ou chave secreta incorretos no Google Cloud." };
  }
  if (!corpo?.error) {
    return { ok: true, mensagem: "Credenciais do Google aceitas." };
  }
  return {
    ok: false,
    mensagem: `O Google recusou as chaves: ${corpo.error_description ?? corpo.error}`,
  };
}

export async function testarCredenciais(
  plataforma: Plataforma,
  credenciais: CredenciaisPlataforma,
): Promise<ResultadoTeste> {
  try {
    return plataforma === "META" ? await testarMeta(credenciais) : await testarGoogle(credenciais);
  } catch {
    return { ok: false, mensagem: "Não consegui falar com o provedor agora. Tente novamente em instantes." };
  }
}
