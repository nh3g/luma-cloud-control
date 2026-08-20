import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas — LUMA" },
      { name: "description", content: "Bloco de notas em abas para registrar hipóteses e aprendizados das suas campanhas." },
      { property: "og:title", content: "Notas — LUMA" },
      { property: "og:description", content: "Bloco de notas em abas para registrar hipóteses e aprendizados das suas campanhas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Notas"
      descricao="Notas em abas estilo navegador, com autosave, limite de 20 abas e reordenação por arrastar."
      fase="Fase 8"
    />
  );
}
