/**
 * Limpeza de dados do workspace.
 *
 * Separa claramente o que é demonstração (semeado no cadastro, com id
 * `demo-…`) do que veio de verdade (API oficial ou coleta por navegador),
 * para que os dois nunca se misturem nos painéis.
 */
import type { Sb } from "../luma.server";

export type EscopoLimpeza = "DEMO" | "REAIS";
export type PlataformaFiltro = "TODAS" | "META" | "GOOGLE_ADS";
/** 0 = tudo; 7/14/30 = apenas o que foi coletado nos últimos N dias. */
export type PeriodoLimpeza = 0 | 7 | 14 | 30;

export type ResultadoLimpeza = {
  campanhas: number;
  medicoes: number;
  decisoes: number;
  sincronizacoes: number;
  coletas: number;
};

const DEMO = "demo-%";

export async function limparDados(
  sb: Sb,
  ws: string,
  entrada: { escopo: EscopoLimpeza; plataforma: PlataformaFiltro; periodo: PeriodoLimpeza },
): Promise<ResultadoLimpeza> {
  const demo = entrada.escopo === "DEMO";
  const desde =
    entrada.periodo > 0 ? new Date(Date.now() - entrada.periodo * 86400000).toISOString() : null;

  // Campanhas do escopo escolhido (id `demo-…` = semeadas na demonstração).
  let consulta = sb.from("campaigns").select("id").eq("workspace_id", ws);
  consulta = demo ? consulta.like("id", DEMO) : consulta.not("id", "like", DEMO);
  if (entrada.plataforma !== "TODAS") consulta = consulta.eq("platform", entrada.plataforma);
  const { data: campanhas, error } = await consulta;
  if (error) throw new Error(error.message);
  const ids = (campanhas ?? []).map((c) => c.id);

  const resultado: ResultadoLimpeza = {
    campanhas: 0,
    medicoes: 0,
    decisoes: 0,
    sincronizacoes: 0,
    coletas: 0,
  };

  if (ids.length > 0) {
    // Com período escolhido, apagamos só o histórico da janela e mantemos as campanhas.
    let medicoes = sb
      .from("metric_snapshots")
      .delete({ count: "exact" })
      .eq("workspace_id", ws)
      .in("campaign_id", ids);
    if (desde) medicoes = medicoes.gte("captured_at", desde);
    const { error: erroMedicoes, count: apagadas } = await medicoes;
    if (erroMedicoes) throw new Error(erroMedicoes.message);
    resultado.medicoes = apagadas ?? 0;

    if (!desde) {
      const { error: erroDecisoes, count: dec } = await sb
        .from("decisions")
        .delete({ count: "exact" })
        .eq("workspace_id", ws)
        .in("campaign_id", ids);
      if (erroDecisoes) throw new Error(erroDecisoes.message);
      resultado.decisoes = dec ?? 0;

      const { error: erroCampanhas, count: camp } = await sb
        .from("campaigns")
        .delete({ count: "exact" })
        .eq("workspace_id", ws)
        .in("id", ids);
      if (erroCampanhas) throw new Error(erroCampanhas.message);
      resultado.campanhas = camp ?? 0;
    }
  }

  if (!desde) {
    // Histórico de execuções da mesma plataforma, para não sobrar registro órfão.
    let syncs = sb.from("sync_runs").delete({ count: "exact" }).eq("workspace_id", ws);
    if (entrada.plataforma !== "TODAS") syncs = syncs.eq("platform", entrada.plataforma);
    const { count: s } = await syncs;
    resultado.sincronizacoes = s ?? 0;

    if (!demo) {
      let coletas = sb.from("browser_collection_runs").delete({ count: "exact" }).eq("workspace_id", ws);
      if (entrada.plataforma !== "TODAS") coletas = coletas.eq("platform", entrada.plataforma);
      const { count: c } = await coletas;
      resultado.coletas = c ?? 0;
    }

    if (demo) {
      // As integrações fictícias do seed saem junto com os números fictícios.
      const { data: integracoes } = await sb
        .from("integrations")
        .select("id, metadata_json")
        .eq("workspace_id", ws);
      const demoIds = (integracoes ?? [])
        .filter((i) => (i.metadata_json as { demo?: boolean } | null)?.demo === true)
        .map((i) => i.id);
      if (demoIds.length > 0) await sb.from("integrations").delete().in("id", demoIds);
    }
  }

  return resultado;
}
