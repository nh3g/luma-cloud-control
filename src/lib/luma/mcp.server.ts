import type { Sb } from "../luma.server";
import { expirarDecisoesVencidas } from "../luma.server";
import { analisarWorkspace } from "./analise.server";
import { sincronizarWorkspace } from "./sync.server";
import { resumo } from "./cripto.server";

/**
 * Ferramentas MCP da LUMA. Agentes externos podem ler e propor,
 * mas nenhuma escrita em conta de anúncio acontece sem uma decisão
 * aprovada por uma pessoa — as mesmas regras da interface.
 */

export type FerramentaMcp = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export const ferramentas: FerramentaMcp[] = [
  {
    name: "ads_get_overview",
    description: "Resumo do workspace: investimento, receita, ROAS, CPA e decisões pendentes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ads_list_campaigns",
    description: "Lista as campanhas sincronizadas com métricas completas.",
    inputSchema: {
      type: "object",
      properties: { platform: { type: "string", enum: ["META", "GOOGLE_ADS"] } },
    },
  },
  {
    name: "ads_list_decisions",
    description: "Lista as decisões, opcionalmente filtradas por estado.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "EXECUTED", "FAILED", "EXPIRED"] },
      },
    },
  },
  {
    name: "ads_run_analysis",
    description: "Roda o motor de regras determinístico e cria decisões pendentes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ads_propose_action",
    description: "Propõe uma ação em uma campanha. A decisão nasce pendente de aprovação humana.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        action_type: {
          type: "string",
          enum: ["PAUSE_CAMPAIGN", "RESUME_CAMPAIGN", "INCREASE_BUDGET", "DECREASE_BUDGET", "ROTATE_CREATIVE"],
        },
        reason: { type: "string" },
        proposed_budget_daily: { type: "number" },
      },
      required: ["campaign_id", "action_type", "reason"],
    },
  },
  {
    name: "ads_approve_decision",
    description: "Aprova uma decisão pendente (uso único, respeita validade e o botão de parada).",
    inputSchema: { type: "object", properties: { decision_id: { type: "string" } }, required: ["decision_id"] },
  },
  {
    name: "ads_reject_decision",
    description: "Recusa uma decisão pendente.",
    inputSchema: { type: "object", properties: { decision_id: { type: "string" } }, required: ["decision_id"] },
  },
  {
    name: "ads_execute_approved_action",
    description: "Executa uma decisão já aprovada, com verificação do estado final.",
    inputSchema: { type: "object", properties: { decision_id: { type: "string" } }, required: ["decision_id"] },
  },
  {
    name: "ads_sync_platform",
    description: "Sincroniza as contas conectadas e grava novos snapshots de métricas.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function workspacePorChaveMcp(sb: Sb, chave: string | null) {
  if (!chave) return null;
  const { data } = await sb
    .from("mcp_keys")
    .select("id, workspace_id, revoked_at")
    .eq("key_hash", await resumo(chave))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await sb.from("mcp_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.workspace_id;
}

export async function executarFerramenta(
  sb: Sb,
  ws: string,
  nome: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (nome) {
    case "ads_get_overview": {
      const { data: campanhas } = await sb.from("campaigns").select("*").eq("workspace_id", ws);
      const lista = campanhas ?? [];
      const soma = (campo: "spend" | "revenue" | "conversions") =>
        lista.reduce((t, c) => t + Number(c[campo] ?? 0), 0);
      const spend = soma("spend");
      const revenue = soma("revenue");
      const conversions = soma("conversions");
      const { count: pendentes } = await sb
        .from("decisions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws)
        .eq("status", "PENDING");
      return {
        campaigns: lista.length,
        spend,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        pending_decisions: pendentes ?? 0,
      };
    }
    case "ads_list_campaigns": {
      let consulta = sb.from("campaigns").select("*").eq("workspace_id", ws).order("spend", { ascending: false });
      const plataforma = args["platform"];
      if (plataforma === "META" || plataforma === "GOOGLE_ADS") consulta = consulta.eq("platform", plataforma);
      const { data } = await consulta;
      return data ?? [];
    }
    case "ads_list_decisions": {
      await expirarDecisoesVencidas(sb, ws);
      let consulta = sb
        .from("decisions")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(100);
      const status = args["status"];
      if (typeof status === "string") {
        consulta = consulta.eq("status", status as "PENDING");
      }
      const { data } = await consulta;
      return data ?? [];
    }
    case "ads_run_analysis":
      return analisarWorkspace(sb, ws);
    case "ads_sync_platform":
      return { runs: await sincronizarWorkspace(sb, ws) };
    case "ads_propose_action": {
      const campaignId = String(args["campaign_id"] ?? "");
      const { data: campanha } = await sb
        .from("campaigns")
        .select("*")
        .eq("workspace_id", ws)
        .eq("id", campaignId)
        .maybeSingle();
      if (!campanha) throw new Error("Campanha não encontrada neste workspace.");

      const acao = String(args["action_type"]) as
        | "PAUSE_CAMPAIGN"
        | "RESUME_CAMPAIGN"
        | "INCREASE_BUDGET"
        | "DECREASE_BUDGET"
        | "ROTATE_CREATIVE";

      const { data: duplicada } = await sb
        .from("decisions")
        .select("id")
        .eq("workspace_id", ws)
        .eq("campaign_id", campaignId)
        .eq("action_type", acao)
        .eq("status", "PENDING")
        .maybeSingle();
      if (duplicada) return { decision_id: duplicada.id, duplicated: true };

      const { data: settings } = await sb
        .from("engine_settings")
        .select("decision_ttl_minutes")
        .eq("workspace_id", ws)
        .maybeSingle();
      const ttl = settings?.decision_ttl_minutes ?? 1440;

      const anterior =
        acao === "INCREASE_BUDGET" || acao === "DECREASE_BUDGET"
          ? { budgetDaily: Number(campanha.budget_daily) }
          : { status: campanha.status };
      const proposto =
        acao === "INCREASE_BUDGET" || acao === "DECREASE_BUDGET"
          ? { budgetDaily: Number(args["proposed_budget_daily"] ?? campanha.budget_daily) }
          : { status: acao === "PAUSE_CAMPAIGN" ? "PAUSED" : "ACTIVE" };

      const { data: criada, error } = await sb
        .from("decisions")
        .insert({
          workspace_id: ws,
          platform: campanha.platform,
          account_id: campanha.account_id,
          campaign_id: campanha.id,
          campaign_name: campanha.name,
          action_type: acao,
          reason: String(args["reason"] ?? "Proposta enviada por agente externo via MCP."),
          previous_value_json: anterior,
          proposed_value_json: proposto,
          confidence: 0.5,
          risk_level: acao === "PAUSE_CAMPAIGN" ? "HIGH" : "MEDIUM",
          status: "PENDING",
          source: "MCP",
          expires_at: new Date(Date.now() + ttl * 60000).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { decision_id: criada.id, status: "PENDING" };
    }
    case "ads_approve_decision":
    case "ads_reject_decision": {
      const id = String(args["decision_id"] ?? "");
      const { data: workspace } = await sb.from("workspaces").select("agent_stopped").eq("id", ws).maybeSingle();
      if (workspace?.agent_stopped) throw new Error("O agente está parado. Reative o agente no painel.");

      const { data: decisao } = await sb
        .from("decisions")
        .select("id, status, expires_at")
        .eq("workspace_id", ws)
        .eq("id", id)
        .maybeSingle();
      if (!decisao) throw new Error("Decisão não encontrada.");
      if (decisao.status !== "PENDING") throw new Error("Esta decisão já foi respondida.");
      if (new Date(decisao.expires_at).getTime() <= Date.now()) {
        await sb.from("decisions").update({ status: "EXPIRED" }).eq("id", id);
        throw new Error("Esta decisão expirou. Rode uma nova análise.");
      }

      const aprovar = nome === "ads_approve_decision";
      const agora = new Date().toISOString();
      const { error } = await sb
        .from("decisions")
        .update(
          aprovar
            ? { status: "APPROVED", approved_at: agora, approval_note: "Aprovada via MCP" }
            : { status: "REJECTED", rejected_at: agora, approval_note: "Recusada via MCP" },
        )
        .eq("id", id)
        .eq("status", "PENDING");
      if (error) throw new Error(error.message);
      return { decision_id: id, status: aprovar ? "APPROVED" : "REJECTED" };
    }
    case "ads_execute_approved_action": {
      const { executarDecisaoAprovada } = await import("./execucao.server");
      return executarDecisaoAprovada(sb, ws, String(args["decision_id"] ?? ""));
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}
