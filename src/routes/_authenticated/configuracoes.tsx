import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LUMA" },
      { name: "description", content: "Ajuste os parâmetros do motor de regras, seu perfil e as preferências do workspace." },
      { property: "og:title", content: "Configurações — LUMA" },
      { property: "og:description", content: "Ajuste os parâmetros do motor de regras, seu perfil e as preferências do workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Configurações"
      descricao="Parâmetros do motor de regras, perfil do usuário, reinício do tour, reset do modo demonstração e zona de perigo."
      fase="Fase 8"
    />
  );
}
