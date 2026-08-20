import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/decisoes")({
  head: () => ({
    meta: [
      { title: "Decisões — LUMA" },
      { name: "description", content: "Fila de decisões do motor de regras com aprovação humana de uso único e histórico de execuções." },
      { property: "og:title", content: "Decisões — LUMA" },
      { property: "og:description", content: "Fila de decisões do motor de regras com aprovação humana de uso único e histórico de execuções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Decisões"
      descricao="Fila de decisões pendentes geradas pelo motor de regras, com aprovação humana de uso único, histórico, execução e resultado verificado."
      fase="Fase 4"
    />
  );
}
