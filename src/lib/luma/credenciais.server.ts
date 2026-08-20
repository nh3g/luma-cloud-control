import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;
export type Plataforma = "META" | "GOOGLE_ADS";

export type CredenciaisPlataforma = {
  clientId: string;
  clientSecret: string;
  developerToken?: string;
  origem: "workspace" | "projeto";
};

function doProjeto(plataforma: Plataforma): CredenciaisPlataforma | null {
  if (plataforma === "META") {
    const clientId = process.env["META_APP_ID"];
    const clientSecret = process.env["META_APP_SECRET"];
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, origem: "projeto" };
  }
  const clientId = process.env["GOOGLE_ADS_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_ADS_CLIENT_SECRET"];
  const developerToken = process.env["GOOGLE_ADS_DEVELOPER_TOKEN"];
  if (!clientId || !clientSecret || !developerToken) return null;
  return { clientId, clientSecret, developerToken, origem: "projeto" };
}

/**
 * Resolve as chaves do app: primeiro as cadastradas pelo dono na tela de
 * Integrações, depois as chaves do projeto (variáveis de ambiente).
 * Só roda no servidor — a chave de serviço é obrigatória.
 */
export async function obterCredenciais(
  admin: Sb,
  ws: string,
  plataforma: Plataforma,
): Promise<CredenciaisPlataforma | null> {
  const { data } = await admin
    .from("platform_credentials")
    .select("client_id, client_secret, developer_token")
    .eq("workspace_id", ws)
    .eq("platform", plataforma)
    .maybeSingle();

  if (data?.client_id && data.client_secret) {
    if (plataforma === "GOOGLE_ADS" && !data.developer_token) return doProjeto(plataforma);
    return {
      clientId: data.client_id,
      clientSecret: data.client_secret,
      ...(data.developer_token ? { developerToken: data.developer_token } : {}),
      origem: "workspace",
    };
  }
  return doProjeto(plataforma);
}

/** Situação das chaves para exibir na interface — nunca devolve valores. */
export async function situacaoCredenciais(admin: Sb, ws: string) {
  const [meta, google] = await Promise.all([
    obterCredenciais(admin, ws, "META"),
    obterCredenciais(admin, ws, "GOOGLE_ADS"),
  ]);
  return {
    META: meta ? { configurada: true, origem: meta.origem, prefixo: meta.clientId.slice(0, 6) } : { configurada: false },
    GOOGLE_ADS: google
      ? { configurada: true, origem: google.origem, prefixo: google.clientId.slice(0, 6) }
      : { configurada: false },
  } as Record<Plataforma, { configurada: boolean; origem?: "workspace" | "projeto"; prefixo?: string }>;
}
