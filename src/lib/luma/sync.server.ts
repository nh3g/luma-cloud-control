/**
 * Sincronização de contas de anúncio.
 *
 * Em modo demonstração a sincronização é simulada (variação determinística das
 * métricas + novo snapshot). Com uma integração real conectada, os dados vêm da
 * API oficial da plataforma usando o token guardado em `integration_tokens`
 * (tabela sem policies: só o servidor confiável enxerga).
 */
import type { Sb } from "../luma.server";

export type CampanhaExterna = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget_daily: number;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
};

export type ResumoSync = {
  platform: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  campanhas: number;
  contas: number;
  contasComFalha: number;
  mensagem: string;
};

function derivadas(c: CampanhaExterna) {
  return {
    ctr: c.impressions > 0 ? (c.clicks * 100) / c.impressions : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    cpm: c.impressions > 0 ? (c.spend * 1000) / c.impressions : 0,
    cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
    roas: c.spend > 0 ? c.revenue / c.spend : 0,
  };
}

/** Variação pseudoaleatória estável por campanha, usada apenas no modo demonstração. */
function variacao(seed: string, amplitude: number): number {
  let h = 0;
  const chave = seed + Math.floor(Date.now() / 60000).toString();
  for (let i = 0; i < chave.length; i += 1) h = (h * 31 + chave.charCodeAt(i)) % 100003;
  return 1 + ((h % 200) / 100 - 1) * amplitude;
}

async function simular(sb: Sb, ws: string, plataforma: string): Promise<CampanhaExterna[]> {
  const { data } = await sb.from("campaigns").select("*").eq("workspace_id", ws).eq("platform", plataforma as never);
  return (data ?? []).map((c) => {
    const spend = Math.max(0, Number(c.spend) * variacao(`${c.id}s`, 0.06));
    const revenue = Math.max(0, Number(c.revenue) * variacao(`${c.id}r`, 0.09));
    const impressions = Math.max(0, Math.round(Number(c.impressions) * variacao(`${c.id}i`, 0.05)));
    const clicks = Math.max(0, Math.round(Number(c.clicks) * variacao(`${c.id}c`, 0.07)));
    const conversions = Math.max(0, Number(c.conversions) * variacao(`${c.id}v`, 0.1));
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budget_daily: Number(c.budget_daily),
      spend: Math.round(spend * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      impressions,
      clicks,
      conversions: Math.round(conversions * 100) / 100,
      frequency: Number(c.frequency),
    };
  });
}

async function buscarMeta(token: string, accountId: string): Promise<CampanhaExterna[]> {
  const campos =
    "campaign{id,name,objective},spend,impressions,clicks,frequency,actions,action_values,daily_budget";
  const url =
    `https://graph.facebook.com/v20.0/${encodeURIComponent(accountId)}/insights` +
    `?level=campaign&date_preset=last_7d&limit=200&fields=${encodeURIComponent(campos)}` +
    `&access_token=${encodeURIComponent(token)}`;
  const resposta = await fetch(url);
  const corpo = (await resposta.json()) as {
    data?: Record<string, unknown>[];
    error?: { message?: string };
  };
  if (!resposta.ok || corpo.error) {
    throw new Error(corpo.error?.message ?? `Meta Ads respondeu ${resposta.status}`);
  }
  return (corpo.data ?? []).map((linha) => {
    const campanha = (linha["campaign"] ?? {}) as Record<string, string>;
    const acoes = (linha["actions"] ?? []) as { action_type: string; value: string }[];
    const valores = (linha["action_values"] ?? []) as { action_type: string; value: string }[];
    const conversoes = acoes
      .filter((a) => a.action_type.includes("purchase") || a.action_type.includes("lead"))
      .reduce((t, a) => t + Number(a.value ?? 0), 0);
    const receita = valores
      .filter((a) => a.action_type.includes("purchase"))
      .reduce((t, a) => t + Number(a.value ?? 0), 0);
    return {
      id: String(campanha["id"] ?? linha["campaign_id"] ?? ""),
      name: String(campanha["name"] ?? "Campanha sem nome"),
      status: "ACTIVE",
      objective: campanha["objective"] ?? null,
      budget_daily: Number(linha["daily_budget"] ?? 0) / 100,
      spend: Number(linha["spend"] ?? 0),
      revenue: receita,
      impressions: Number(linha["impressions"] ?? 0),
      clicks: Number(linha["clicks"] ?? 0),
      conversions: conversoes,
      frequency: Number(linha["frequency"] ?? 0),
    };
  });
}

async function buscarGoogle(token: string, accountId: string): Promise<CampanhaExterna[]> {
  const developerToken = process.env["GOOGLE_ADS_DEVELOPER_TOKEN"];
  if (!developerToken) throw new Error("Token de desenvolvedor do Google Ads não configurado.");
  const customerId = accountId.replace(/\D/g, "");
  const consulta = `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign_budget.amount_micros, metrics.cost_micros, metrics.conversions_value,
           metrics.impressions, metrics.clicks, metrics.conversions
    FROM campaign WHERE segments.date DURING LAST_7_DAYS`;
  const resposta = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: consulta, pageSize: 200 }),
    },
  );
  const corpo = (await resposta.json()) as { results?: Record<string, never>[]; error?: { message?: string } };
  if (!resposta.ok) throw new Error(corpo.error?.message ?? `Google Ads respondeu ${resposta.status}`);
  return (corpo.results ?? []).map((linha) => {
    const campanha = (linha["campaign"] ?? {}) as Record<string, string>;
    const orcamento = (linha["campaignBudget"] ?? {}) as Record<string, string>;
    const metricas = (linha["metrics"] ?? {}) as Record<string, string>;
    return {
      id: String(campanha["id"] ?? ""),
      name: String(campanha["name"] ?? "Campanha sem nome"),
      status: String(campanha["status"] ?? "ACTIVE"),
      objective: campanha["advertisingChannelType"] ?? null,
      budget_daily: Number(orcamento["amountMicros"] ?? 0) / 1_000_000,
      spend: Number(metricas["costMicros"] ?? 0) / 1_000_000,
      revenue: Number(metricas["conversionsValue"] ?? 0),
      impressions: Number(metricas["impressions"] ?? 0),
      clicks: Number(metricas["clicks"] ?? 0),
      conversions: Number(metricas["conversions"] ?? 0),
      frequency: 0,
    };
  });
}

async function gravarCampanhas(
  sb: Sb,
  ws: string,
  plataforma: string,
  accountId: string,
  campanhas: CampanhaExterna[],
) {
  if (campanhas.length === 0) return 0;
  const agora = new Date().toISOString();
  const linhas = campanhas
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id,
      workspace_id: ws,
      platform: plataforma as "META" | "GOOGLE_ADS" | "GA4",
      account_id: accountId,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budget_daily: c.budget_daily,
      spend: c.spend,
      revenue: c.revenue,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
      ...derivadas(c),
      synced_at: agora,
    }));
  const { error } = await sb.from("campaigns").upsert(linhas, { onConflict: "id" });
  if (error) throw new Error(error.message);

  const { error: erroSnap } = await sb.from("metric_snapshots").insert(
    linhas.map((c) => ({
      workspace_id: ws,
      campaign_id: c.id,
      platform: c.platform,
      spend: c.spend,
      revenue: c.revenue,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
      ctr: c.ctr,
      cpc: c.cpc,
      cpm: c.cpm,
      cpa: c.cpa,
      roas: c.roas,
      captured_at: agora,
    })),
  );
  if (erroSnap) throw new Error(erroSnap.message);
  return linhas.length;
}

/**
 * Sincroniza todas as integrações conectadas do workspace e registra cada
 * execução em `sync_runs`.
 */
export async function sincronizarWorkspace(sb: Sb, ws: string): Promise<ResumoSync[]> {
  const [{ data: workspace }, { data: integracoes }] = await Promise.all([
    sb.from("workspaces").select("demo_mode, agent_stopped").eq("id", ws).maybeSingle(),
    sb.from("integrations").select("*").eq("workspace_id", ws).eq("status", "CONNECTED"),
  ]);
  if (workspace?.agent_stopped) throw new Error("O agente está parado. Reative o agente para sincronizar.");
  const conectadas = integracoes ?? [];
  if (conectadas.length === 0) {
    throw new Error("Nenhuma integração conectada. Conecte Meta Ads ou Google Ads para sincronizar.");
  }

  const demo = workspace?.demo_mode !== false;
  const resumos: ResumoSync[] = [];

  for (const integracao of conectadas) {
    const inicio = new Date().toISOString();
    const { data: run } = await sb
      .from("sync_runs")
      .insert({
        workspace_id: ws,
        platform: integracao.platform,
        status: "RUNNING",
        accounts: 1,
        started_at: inicio,
      })
      .select("id")
      .single();

    try {
      let campanhas: CampanhaExterna[];
      if (demo) {
        campanhas = await simular(sb, ws, integracao.platform);
      } else {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: token } = await supabaseAdmin
          .from("integration_tokens")
          .select("access_token")
          .eq("integration_id", integracao.id)
          .maybeSingle();
        if (!token?.access_token) throw new Error("Token de acesso ausente. Reconecte a conta.");
        campanhas =
          integracao.platform === "META"
            ? await buscarMeta(token.access_token, integracao.account_id ?? "")
            : await buscarGoogle(token.access_token, integracao.account_id ?? "");
      }

      const total = await gravarCampanhas(sb, ws, integracao.platform, integracao.account_id ?? "", campanhas);
      const mensagem = demo
        ? `${total} campanhas atualizadas em modo demonstração.`
        : `${total} campanhas sincronizadas pela API oficial.`;
      if (run) {
        await sb
          .from("sync_runs")
          .update({ status: "SUCCESS", campaigns: total, message: mensagem, finished_at: new Date().toISOString() })
          .eq("id", run.id);
      }
      resumos.push({
        platform: integracao.platform,
        status: "SUCCESS",
        campanhas: total,
        contas: 1,
        contasComFalha: 0,
        mensagem,
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida na sincronização.";
      if (run) {
        await sb
          .from("sync_runs")
          .update({
            status: "FAILED",
            message: mensagem,
            failed_accounts: 1,
            finished_at: new Date().toISOString(),
          })
          .eq("id", run.id);
      }
      await sb
        .from("integrations")
        .update({ status: "ERROR", metadata_json: { erro: mensagem } })
        .eq("id", integracao.id);
      resumos.push({
        platform: integracao.platform,
        status: "FAILED",
        campanhas: 0,
        contas: 1,
        contasComFalha: 1,
        mensagem,
      });
    }
  }

  return resumos;
}
