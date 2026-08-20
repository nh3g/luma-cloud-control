import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/estrategista")({
  head: () => ({
    meta: [
      { title: "Estrategista IA — LUMA" },
      { name: "description", content: "Análise estratégica assistida por IA com propostas convertíveis em decisões aprovadas por você." },
      { property: "og:title", content: "Estrategista IA — LUMA" },
      { property: "og:description", content: "Análise estratégica assistida por IA com propostas convertíveis em decisões aprovadas por você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Estrategista"
      descricao="Chat com a IA estrategista, propostas estratégicas estruturadas e o modo LUMA PRIME em etapas (auditoria, tese, debate e liberação)."
      fase="Fase 7"
    />
  );
}
