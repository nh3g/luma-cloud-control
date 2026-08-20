import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — LUMA" },
      { name: "description", content: "Verifique a saúde das integrações, tokens, sincronizações e erros recentes da plataforma." },
      { property: "og:title", content: "Diagnóstico — LUMA" },
      { property: "og:description", content: "Verifique a saúde das integrações, tokens, sincronizações e erros recentes da plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Diagnóstico"
      descricao="Saúde das funções, validade dos tokens, status do companion, última sincronização por plataforma e últimos erros registrados."
      fase="Fase 8"
    />
  );
}
