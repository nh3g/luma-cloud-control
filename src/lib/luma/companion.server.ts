import type { Sb } from "../luma.server";

/**
 * Camada de servidor do companion (agente de navegador local).
 * Nenhum código de pareamento nem token de dispositivo é guardado em claro:
 * o banco recebe apenas o resumo criptográfico (SHA-256).
 */

const MINUTOS_PAREAMENTO = 10;
const SEGUNDOS_OFFLINE = 120;
export const MINUTOS_APROVACAO_AGENTE = 10;

export async function resumo(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(valor);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function gerarCodigoPareamento(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return String(((bytes[0] ?? 0) % 10000)).padStart(4, "0") + String(((bytes[1] ?? 0) % 10000)).padStart(4, "0");
}

export function gerarSegredo(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function estaOffline(ultimoSinal: string | null | undefined): boolean {
  if (!ultimoSinal) return true;
  return Date.now() - new Date(ultimoSinal).getTime() > SEGUNDOS_OFFLINE * 1000;
}

/** Cria um dispositivo pendente e devolve o código de pareamento (mostrado uma única vez). */
export async function criarPareamento(sb: Sb, ws: string, nome: string) {
  const codigo = gerarCodigoPareamento();
  const { data, error } = await sb
    .from("companion_devices")
    .insert({
      workspace_id: ws,
      name: nome,
      status: "OFFLINE",
      pairing_code_hash: await resumo(codigo),
      pairing_expires_at: new Date(Date.now() + MINUTOS_PAREAMENTO * 60000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, codigo, expiraEm: MINUTOS_PAREAMENTO };
}

/** Troca o código de pareamento por um token de dispositivo (chamado pelo companion). */
export async function trocarCodigoPorToken(
  sb: Sb,
  codigo: string,
  info: { appVersion?: string; browserLabel?: string; nome?: string },
) {
  const hash = await resumo(codigo);
  const { data: dispositivo } = await sb
    .from("companion_devices")
    .select("id, workspace_id, pairing_expires_at")
    .eq("pairing_code_hash", hash)
    .maybeSingle();

  if (!dispositivo) throw new Error("Código de pareamento inválido.");
  if (!dispositivo.pairing_expires_at || new Date(dispositivo.pairing_expires_at).getTime() < Date.now()) {
    throw new Error("Código de pareamento expirado. Gere um novo código no painel.");
  }

  const token = gerarSegredo();
  const { error } = await sb
    .from("companion_devices")
    .update({
      device_token_hash: await resumo(token),
      pairing_code_hash: null,
      pairing_expires_at: null,
      paired_at: new Date().toISOString(),
      status: "ONLINE",
      last_heartbeat_at: new Date().toISOString(),
      app_version: info.appVersion ?? null,
      browser_label: info.browserLabel ?? null,
      ...(info.nome ? { name: info.nome } : {}),
    })
    .eq("id", dispositivo.id);
  if (error) throw new Error(error.message);

  return { token, dispositivoId: dispositivo.id, workspaceId: dispositivo.workspace_id };
}

export async function dispositivoPorToken(sb: Sb, token: string | null) {
  if (!token) return null;
  const { data } = await sb
    .from("companion_devices")
    .select("id, workspace_id, name, status")
    .eq("device_token_hash", await resumo(token))
    .maybeSingle();
  return data;
}

export async function agenteParado(sb: Sb, ws: string): Promise<boolean> {
  const { data } = await sb.from("workspaces").select("agent_stopped").eq("id", ws).maybeSingle();
  return data?.agent_stopped === true;
}

/** Marca como expiradas as aprovações do agente cuja validade passou. */
export async function expirarAprovacoesAgente(sb: Sb, ws: string) {
  const { data: runs } = await sb.from("browser_agent_runs").select("id").eq("workspace_id", ws);
  const ids = (runs ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  await sb
    .from("browser_agent_approvals")
    .update({ status: "EXPIRED" })
    .in("run_id", ids)
    .eq("status", "PENDING")
    .lt("expires_at", new Date().toISOString());
}

export async function registrarLog(sb: Sb, runId: string, mensagem: string, nivel = "INFO") {
  await sb.from("browser_agent_logs").insert({ run_id: runId, message: mensagem, level: nivel });
}
