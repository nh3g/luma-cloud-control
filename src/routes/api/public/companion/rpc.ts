import { createFileRoute } from "@tanstack/react-router";

/**
 * Ponte entre a nuvem e o companion local (agente de navegador).
 * Autenticado pelo token do dispositivo — nunca pela sessão do navegador.
 * Corpo: { acao: string, ...dados }
 */
export const Route = createFileRoute("/api/public/companion/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const companion = await import("@/lib/luma/companion.server");

        let corpo: Record<string, unknown>;
        try {
          corpo = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ erro: "Corpo inválido." }, { status: 400 });
        }

        const acao = String(corpo["acao"] ?? "");
        const token = request.headers.get("x-device-token");

        try {
          // Pareamento: única ação sem token de dispositivo.
          if (acao === "parear") {
            const resultado = await companion.trocarCodigoPorToken(supabaseAdmin, String(corpo["codigo"] ?? ""), {
              ...(corpo["appVersion"] ? { appVersion: String(corpo["appVersion"]) } : {}),
              ...(corpo["browserLabel"] ? { browserLabel: String(corpo["browserLabel"]) } : {}),
              ...(corpo["nome"] ? { nome: String(corpo["nome"]) } : {}),
            });
            return Response.json(resultado);
          }

          const dispositivo = await companion.dispositivoPorToken(supabaseAdmin, token);
          if (!dispositivo) return Response.json({ erro: "Dispositivo não autorizado." }, { status: 401 });
          const ws = dispositivo.workspace_id;
          const parado = await companion.agenteParado(supabaseAdmin, ws);

          switch (acao) {
            case "heartbeat": {
              await supabaseAdmin
                .from("companion_devices")
                .update({
                  status: parado ? "STOPPED" : ((corpo["status"] as "ONLINE") ?? "ONLINE"),
                  last_heartbeat_at: new Date().toISOString(),
                  ...(corpo["appVersion"] ? { app_version: String(corpo["appVersion"]) } : {}),
                  ...(corpo["browserLabel"] ? { browser_label: String(corpo["browserLabel"]) } : {}),
                })
                .eq("id", dispositivo.id);
              return Response.json({ ok: true, agentStopped: parado });
            }

            case "proxima_execucao": {
              if (parado) return Response.json({ run: null, agentStopped: true });
              const { data: run } = await supabaseAdmin
                .from("browser_agent_runs")
                .select("*")
                .eq("workspace_id", ws)
                .eq("status", "STARTING")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (!run) return Response.json({ run: null, agentStopped: false });
              await supabaseAdmin
                .from("browser_agent_runs")
                .update({ status: "RUNNING", started_at: new Date().toISOString(), companion_id: dispositivo.id })
                .eq("id", run.id);
              return Response.json({ run: { ...run, status: "RUNNING" }, agentStopped: false });
            }

            case "log": {
              const runId = String(corpo["runId"] ?? "");
              const { data: run } = await supabaseAdmin
                .from("browser_agent_runs")
                .select("id")
                .eq("id", runId)
                .eq("workspace_id", ws)
                .maybeSingle();
              if (!run) return Response.json({ erro: "Execução não encontrada." }, { status: 404 });
              await companion.registrarLog(
                supabaseAdmin,
                runId,
                String(corpo["mensagem"] ?? ""),
                String(corpo["nivel"] ?? "INFO"),
              );
              return Response.json({ ok: true, agentStopped: parado });
            }

            case "atualizar_execucao": {
              const runId = String(corpo["runId"] ?? "");
              const status = String(corpo["status"] ?? "");
              const permitidos = [
                "RUNNING",
                "WAITING_APPROVAL",
                "COMPLETED",
                "PARTIAL",
                "BLOCKED",
                "NEEDS_INPUT",
                "FAILED",
                "STOPPED",
              ];
              if (!permitidos.includes(status)) {
                return Response.json({ erro: "Status inválido." }, { status: 400 });
              }
              const finalizados = ["COMPLETED", "PARTIAL", "BLOCKED", "FAILED", "STOPPED"];
              const { error } = await supabaseAdmin
                .from("browser_agent_runs")
                .update({
                  status: status as "RUNNING",
                  result_text: corpo["resultado"] ? String(corpo["resultado"]) : null,
                  error_message: corpo["erro"] ? String(corpo["erro"]) : null,
                  ...(finalizados.includes(status) ? { finished_at: new Date().toISOString() } : {}),
                })
                .eq("id", runId)
                .eq("workspace_id", ws);
              if (error) return Response.json({ erro: error.message }, { status: 400 });
              return Response.json({ ok: true, agentStopped: parado });
            }

            case "pedir_aprovacao": {
              const runId = String(corpo["runId"] ?? "");
              const { data: run } = await supabaseAdmin
                .from("browser_agent_runs")
                .select("id, mode")
                .eq("id", runId)
                .eq("workspace_id", ws)
                .maybeSingle();
              if (!run) return Response.json({ erro: "Execução não encontrada." }, { status: 404 });
              if (run.mode === "ANALYZE") {
                return Response.json({ erro: "Escrita bloqueada no modo Análise." }, { status: 409 });
              }
              const { data: pedido, error } = await supabaseAdmin
                .from("browser_agent_approvals")
                .insert({
                  run_id: runId,
                  title: String(corpo["titulo"] ?? "Ação sensível"),
                  action_type: String(corpo["acaoTipo"] ?? "CLICK"),
                  target: corpo["alvo"] ? String(corpo["alvo"]) : null,
                  current_value: corpo["valorAtual"] ? String(corpo["valorAtual"]) : null,
                  proposed_value: corpo["valorProposto"] ? String(corpo["valorProposto"]) : null,
                  reason: String(corpo["motivo"] ?? "O agente precisa da sua autorização para continuar."),
                  risk_level: (corpo["risco"] as "MEDIUM") ?? "MEDIUM",
                  expires_at: new Date(
                    Date.now() + companion.MINUTOS_APROVACAO_AGENTE * 60000,
                  ).toISOString(),
                })
                .select("id, expires_at")
                .single();
              if (error) return Response.json({ erro: error.message }, { status: 400 });
              await supabaseAdmin
                .from("browser_agent_runs")
                .update({ status: "WAITING_APPROVAL" })
                .eq("id", runId);
              return Response.json({ aprovacaoId: pedido.id, expiraEm: pedido.expires_at });
            }

            case "consultar_aprovacao": {
              const id = String(corpo["aprovacaoId"] ?? "");
              await companion.expirarAprovacoesAgente(supabaseAdmin, ws);
              const { data: pedido } = await supabaseAdmin
                .from("browser_agent_approvals")
                .select("id, status, expires_at, response_note, run_id")
                .eq("id", id)
                .maybeSingle();
              if (!pedido) return Response.json({ erro: "Solicitação não encontrada." }, { status: 404 });
              const { data: run } = await supabaseAdmin
                .from("browser_agent_runs")
                .select("id")
                .eq("id", pedido.run_id)
                .eq("workspace_id", ws)
                .maybeSingle();
              if (!run) return Response.json({ erro: "Solicitação não encontrada." }, { status: 404 });
              return Response.json({ status: pedido.status, agentStopped: parado });
            }

            default:
              return Response.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 });
          }
        } catch (erro) {
          return Response.json(
            { erro: erro instanceof Error ? erro.message : "Falha inesperada." },
            { status: 400 },
          );
        }
      },
    },
  },
});
