import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, X } from "lucide-react";

import { concluirOnboarding } from "@/lib/luma.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PASSOS = [
  {
    titulo: "Bem-vindo à LUMA",
    texto:
      "A LUMA acompanha suas campanhas de Meta Ads e Google Ads, calcula ROAS, CPA e CTR e avisa quando algo precisa da sua atenção.",
  },
  {
    titulo: "Ela propõe, você decide",
    texto:
      "O motor de regras e a estrategista de IA só criam propostas. Nada é alterado nas plataformas sem a sua aprovação.",
  },
  {
    titulo: "Fila de decisões",
    texto:
      "Em Decisões você aprova ou recusa cada proposta. A aprovação vale uma única vez e expira sozinha se ficar sem resposta.",
  },
  {
    titulo: "Botão PARAR AGENTE",
    texto:
      "No topo da tela existe o botão de pânico. Ao acioná-lo, toda automação para na hora — análises, execuções e o agente de navegador.",
  },
] as const;

export function TourBoasVindas() {
  const [passo, setPasso] = useState(0);
  const [fechado, setFechado] = useState(false);
  const queryClient = useQueryClient();
  const concluir = useServerFn(concluirOnboarding);

  const encerrar = () => {
    setFechado(true);
    void concluir({}).then(() => queryClient.invalidateQueries({ queryKey: ["workspace"] }));
  };

  if (fechado) return null;
  const atual = PASSOS[passo]!;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary">
              Passo {passo + 1} de {PASSOS.length}
            </p>
            <h2 className="mt-1 text-base font-semibold">{atual.titulo}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{atual.texto}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Dispensar tour" onClick={encerrar}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {passo < PASSOS.length - 1 ? (
            <Button size="sm" onClick={() => setPasso((p) => p + 1)}>
              Próximo <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={encerrar}>
              Começar a usar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={encerrar}>
            Pular apresentação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
