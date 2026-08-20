import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão Geral — LUMA" },
      { name: "description", content: "Painel de performance de tráfego pago com métricas do período, decisões recentes e status das integrações." },
      { property: "og:title", content: "Visão Geral — LUMA" },
      { property: "og:description", content: "Painel de performance de tráfego pago com métricas do período, decisões recentes e status das integrações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Visão Geral"
      descricao="Painel com investimento, receita, ROAS, CPA, CTR, CPC, CPM e frequência do período, gráfico de investimento x receita, decisões recentes e status das integrações e do companion."
      fase="Fase 3"
    />
  );
}
