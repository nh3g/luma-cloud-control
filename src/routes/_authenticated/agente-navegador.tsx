import { createFileRoute } from "@tanstack/react-router";

import { NotImplemented } from "@/components/luma/NotImplemented";

export const Route = createFileRoute("/_authenticated/agente-navegador")({
  head: () => ({
    meta: [
      { title: "Agente de Navegador — LUMA" },
      { name: "description", content: "Pareamento, execuções e aprovações do agente de navegador que roda localmente na sua máquina." },
      { property: "og:title", content: "Agente de Navegador — LUMA" },
      { property: "og:description", content: "Pareamento, execuções e aprovações do agente de navegador que roda localmente na sua máquina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <NotImplemented
      titulo="Agente de Navegador"
      descricao="Espelho do companion local: pareamento de dispositivos, execuções ao vivo com logs, fila de aprovações do agente e histórico de runs."
      fase="Fase 8"
    />
  );
}
