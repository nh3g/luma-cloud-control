import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, Sparkles, User, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { conversarEstrategista } from "@/lib/luma.functions";

export const Route = createFileRoute("/_authenticated/estrategista")({
  head: () => ({
    meta: [
      { title: "Estrategista IA — LUMA" },
      {
        name: "description",
        content: "Converse com a estrategista de tráfego pago da LUMA e transforme análises em decisões aprovadas por você.",
      },
      { property: "og:title", content: "Estrategista IA — LUMA" },
      {
        property: "og:description",
        content: "Converse com a estrategista de tráfego pago da LUMA e transforme análises em decisões aprovadas por você.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

type Mensagem = { role: "user" | "assistant"; content: string; ferramentas?: string[]; propostas?: number };

const SUGESTOES = [
  "Quais campanhas estão queimando verba sem retorno?",
  "Onde eu deveria aumentar orçamento essa semana?",
  "Compare o desempenho de Meta e Google Ads.",
  "Monte um plano de otimização para os próximos 7 dias.",
];

function Pagina() {
  const conversar = useServerFn(conversarEstrategista);
  const queryClient = useQueryClient();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"RAPIDO" | "PRIME">("RAPIDO");
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const enviar = useMutation({
    mutationFn: async (pergunta: string) => {
      const historico = [...mensagens.map((m) => ({ role: m.role, content: m.content })), {
        role: "user" as const,
        content: pergunta,
      }];
      return conversar({ data: { historico: historico.slice(-24), modo } });
    },
    onSuccess: (resultado) => {
      setMensagens((atual) => [
        ...atual,
        {
          role: "assistant",
          content: resultado.resposta,
          ferramentas: [...new Set(resultado.ferramentasUsadas.map((f) => f.nome))],
          propostas: resultado.propostas.length,
        },
      ]);
      if (resultado.propostas.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ["decisoes"] });
        toast.success(`${resultado.propostas.length} proposta(s) criada(s) na fila de decisões.`);
      }
    },
    onError: (erro: Error) => {
      toast.error(erro.message);
      setMensagens((atual) => atual.slice(0, -1));
    },
  });

  function submeter(pergunta: string) {
    const limpo = pergunta.trim();
    if (!limpo || enviar.isPending) return;
    setMensagens((atual) => [...atual, { role: "user", content: limpo }]);
    setTexto("");
    enviar.mutate(limpo);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estrategista</h1>
          <p className="text-sm text-muted-foreground">
            A IA lê as métricas reais do workspace e pode propor ações. Nada é executado sem a sua aprovação em{" "}
            <Link to="/decisoes" className="text-primary underline-offset-4 hover:underline">
              Decisões
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={modo === "RAPIDO" ? "default" : "outline"} size="sm" onClick={() => setModo("RAPIDO")}>
            Rápido
          </Button>
          <Button variant={modo === "PRIME" ? "default" : "outline"} size="sm" onClick={() => setModo("PRIME")}>
            <Sparkles className="mr-2 h-4 w-4" /> LUMA PRIME
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {modo === "PRIME" ? "Auditoria profunda com tese e contrapontos" : "Conversa objetiva sobre a operação"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
            {mensagens.length === 0 && (
              <div className="space-y-3 rounded-md border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Comece por uma pergunta. A estrategista consulta campanhas, decisões e resultados antes de responder.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => submeter(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                </div>
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                  {(m.ferramentas?.length || m.propostas) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {m.ferramentas?.map((f) => (
                        <Badge key={f} variant="outline" className="gap-1 text-xs">
                          <Wrench className="h-3 w-3" /> {f}
                        </Badge>
                      ))}
                      {m.propostas ? (
                        <Badge className="text-xs">{m.propostas} proposta(s) pendente(s) de aprovação</Badge>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {enviar.isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Consultando os dados do workspace…
              </p>
            )}
            <div ref={fim} />
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submeter(texto);
                }
              }}
              placeholder="Pergunte sobre ROAS, CPA, verba, criativos…"
              rows={2}
              className="resize-none"
            />
            <Button onClick={() => submeter(texto)} disabled={enviar.isPending || texto.trim().length === 0}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Enviar</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
