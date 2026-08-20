import { createFileRoute } from "@tanstack/react-router";

/**
 * Servidor MCP da LUMA (JSON-RPC sobre HTTP).
 * Autenticado pela chave de acesso do workspace (cabeçalho Authorization: Bearer
 * luma_... ou x-luma-key). Agentes externos podem ler e propor; nenhuma escrita
 * em conta de anúncio acontece sem uma decisão aprovada por uma pessoa.
 */
export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ferramentas, executarFerramenta, workspacePorChaveMcp } = await import("@/lib/luma/mcp.server");

        const cabecalho = request.headers.get("authorization");
        const chave = cabecalho?.toLowerCase().startsWith("bearer ")
          ? cabecalho.slice(7).trim()
          : request.headers.get("x-luma-key");

        let corpo: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
        try {
          corpo = (await request.json()) as typeof corpo;
        } catch {
          return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } });
        }

        const id = corpo.id ?? null;
        const responder = (result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
        const falhar = (code: number, message: string, status = 200) =>
          Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

        if (corpo.method === "initialize") {
          return responder({
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "luma-cloud-control", version: "3.0.0" },
            instructions:
              "Ferramentas da LUMA para tráfego pago (Meta e Google Ads). Leitura e propostas são livres; qualquer alteração exige uma decisão aprovada por uma pessoa no painel.",
          });
        }
        if (corpo.method === "notifications/initialized" || corpo.method === "ping") {
          return responder({});
        }
        if (corpo.method === "tools/list") {
          return responder({ tools: ferramentas });
        }
        if (corpo.method !== "tools/call") {
          return falhar(-32601, `Método não suportado: ${corpo.method ?? "desconhecido"}`);
        }

        const ws = await workspacePorChaveMcp(supabaseAdmin, chave);
        if (!ws) {
          return falhar(-32001, "Chave MCP inválida ou revogada. Gere uma nova chave em Configurações.", 401);
        }

        const nome = String(corpo.params?.["name"] ?? "");
        const args = (corpo.params?.["arguments"] as Record<string, unknown>) ?? {};

        try {
          const resultado = await executarFerramenta(supabaseAdmin, ws, nome, args);
          return responder({
            content: [{ type: "text", text: JSON.stringify(resultado) }],
            structuredContent: { resultado },
          });
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "Falha ao executar a ferramenta.";
          return responder({ content: [{ type: "text", text: mensagem }], isError: true });
        }
      },
    },
  },
});
