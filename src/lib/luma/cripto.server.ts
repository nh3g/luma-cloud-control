/**
 * Utilitários criptográficos do servidor.
 * Chaves de acesso nunca são guardadas em claro: o banco recebe apenas o
 * resumo SHA-256 e o prefixo usado para identificação na interface.
 */

export async function resumo(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(valor);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function gerarSegredo(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
