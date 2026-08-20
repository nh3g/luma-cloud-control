import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { criarNota, excluirNota, listarNotas, salvarNota } from "@/lib/luma.functions";

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
  const carregar = useServerFn(listarNotas);
  const criar = useServerFn(criarNota);
  const gravar = useServerFn(salvarNota);
  const remover = useServerFn(excluirNota);
  const queryClient = useQueryClient();

  const { data: notas = [], isLoading } = useQuery({ queryKey: ["notas"], queryFn: () => carregar() });

  const [ativa, setAtiva] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notaAtual = notas.find((n) => n.id === ativa) ?? notas[0] ?? null;

  useEffect(() => {
    if (notaAtual && notaAtual.id !== ativa) setAtiva(notaAtual.id);
    if (notaAtual) setConteudo(notaAtual.content);
  }, [notaAtual?.id]);

  const mutCriar = useMutation({
    mutationFn: () => criar({ data: { title: `Nota ${notas.length + 1}` } }),
    onSuccess: async (nota) => {
      await queryClient.invalidateQueries({ queryKey: ["notas"] });
      setAtiva(nota.id);
      setConteudo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutRemover = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      setAtiva(null);
      void queryClient.invalidateQueries({ queryKey: ["notas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function aoDigitar(valor: string) {
    setConteudo(valor);
    if (!notaAtual) return;
    if (timer.current) clearTimeout(timer.current);
    setSalvando(true);
    timer.current = setTimeout(async () => {
      try {
        await gravar({ data: { id: notaAtual.id, content: valor } });
        await queryClient.invalidateQueries({ queryKey: ["notas"] });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSalvando(false);
      }
    }, 700);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Até 20 abas por workspace, com salvamento automático.
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {salvando ? "salvando…" : "salvo"}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {notas.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setAtiva(n.id)}
            className={`rounded-t-md border px-3 py-1.5 text-sm transition ${
              n.id === notaAtual?.id
                ? "border-border bg-card text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {n.title}
          </button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => mutCriar.mutate()}
          disabled={mutCriar.isPending || notas.length >= 20}
        >
          <Plus className="size-4" /> Nova aba
        </Button>
      </div>

      <div className="rounded-lg rounded-tl-none border border-border bg-card p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : notaAtual ? (
          <>
            <Textarea
              value={conteudo}
              maxLength={20000}
              onChange={(e) => aoDigitar(e.target.value)}
              placeholder="Escreva suas hipóteses, aprendizados e próximos testes…"
              className="min-h-[420px] resize-y font-mono text-sm"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{conteudo.length} / 20.000 caracteres</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => mutRemover.mutate(notaAtual.id)}
                disabled={mutRemover.isPending}
              >
                <Trash2 className="size-4" /> Excluir aba
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda. Crie a primeira aba.</p>
        )}
      </div>
    </div>
  );
}
