import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — LUMA" },
      { name: "description", content: "Todas as campanhas de Meta Ads e Google Ads com métricas, filtros e histórico de performance." },
      { property: "og:title", content: "Campanhas — LUMA" },
      { property: "og:description", content: "Todas as campanhas de Meta Ads e Google Ads com métricas, filtros e histórico de performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Campanhas"
      descricao="Tabela de campanhas Meta e Google com status, orçamento, gasto, receita e todas as métricas calculadas, com filtros, busca, ordenação e histórico expansível."
      fase="Fase 3"
    />
  );
}
