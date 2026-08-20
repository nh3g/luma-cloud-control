import { createFileRoute } from "@tanstack/react-router";

/**
 * Agendador: sincroniza contas e roda o motor de regras nos workspaces com
 * automação ligada. Protegido por segredo compartilhado — nada é executado em
 * contas de anúncio aqui: o motor apenas cria decisões pendentes de aprovação.
 */
export const Route = createFileRoute("/api/public/cron/executar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env["LOVABLE_CRON_SECRET"];
        const enviado = request.headers.get("x-cron-secret");
        if (!segredo || enviado !== segredo) {
          return new Response("Não autorizado", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sincronizarWorkspace } = await import("@/lib/luma/sync.server");
        const { analisarWorkspace } = await import("@/lib/luma/analise.server");

        const { data: workspaces } = await supabaseAdmin
          .from("workspaces")
          .select("id, last_auto_run_at, engine_settings(analysis_interval_minutes, auto_analysis_enabled)")
          .eq("auto_sync_enabled", true)
          .eq("agent_stopped", false);

        const resultados: { workspace: string; sincronizacoes: number; decisoes: number; erro?: string }[] = [];

        for (const ws of workspaces ?? []) {
          const settings = Array.isArray(ws.engine_settings) ? ws.engine_settings[0] : ws.engine_settings;
          const intervalo = settings?.analysis_interval_minutes ?? 120;
          const ultima = ws.last_auto_run_at ? new Date(ws.last_auto_run_at).getTime() : 0;
          if (Date.now() - ultima < intervalo * 60000) continue;

          try {
            const resumos = await sincronizarWorkspace(supabaseAdmin, ws.id);
            let decisoes = 0;
            if (settings?.auto_analysis_enabled !== false) {
              decisoes = (await analisarWorkspace(supabaseAdmin, ws.id)).criadas;
            }
            resultados.push({ workspace: ws.id, sincronizacoes: resumos.length, decisoes });
          } catch (erro) {
            resultados.push({
              workspace: ws.id,
              sincronizacoes: 0,
              decisoes: 0,
              erro: erro instanceof Error ? erro.message : "falha desconhecida",
            });
          }
          await supabaseAdmin
            .from("workspaces")
            .update({ last_auto_run_at: new Date().toISOString() })
            .eq("id", ws.id);
        }

        return Response.json({ ok: true, processados: resultados.length, resultados });
      },
    },
  },
});
