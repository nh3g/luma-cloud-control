import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — LUMA" },
      { name: "description", content: "Conecte Meta Ads, Google Ads e GA4 e sincronize suas contas de anúncio com segurança." },
      { property: "og:title", content: "Integrações — LUMA" },
      { property: "og:description", content: "Conecte Meta Ads, Google Ads e GA4 e sincronize suas contas de anúncio com segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Integrações"
      descricao="Credenciais do app guardadas com segurança, conexão OAuth com Meta Ads, Google Ads e GA4, e sincronização das contas de anúncio."
      fase="Fase 5"
    />
  );
}
