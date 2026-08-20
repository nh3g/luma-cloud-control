import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Check, Laptop, Play, Plus, ShieldAlert, Square, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataHora, formatarRelativo, rotuloRisco, rotuloStatusCompanion } from "@/lib/luma/format";
import {
  criarDispositivo,
  iniciarExecucaoAgente,
  listarAgente,
  listarLogsExecucao,
  pararExecucaoAgente,
  removerDispositivo,
  responderAprovacaoAgente,
} from "@/lib/luma.functions";

const descricao =
  "Pareie o companion que roda na sua máquina, envie tarefas em linguagem natural e aprove cada alteração sensível.";

export const Route = createFileRoute("/_authenticated/agente-navegador")({
  head: () => ({
    meta: [
      { title: "Agente de Navegador — LUMA" },
      { name: "description", content: descricao },
      { property: "og:title", content: "Agente de Navegador — LUMA" },
      { property: "og:description", content: descricao },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

const modos = [
  { valor: "ANALYZE" as const, titulo: "Análise", detalhe: "Só navega e lê. Qualquer escrita é recusada." },
  { valor: "APPROVAL" as const, titulo: "Aprovação", detalhe: "Cada alteração pede sua autorização de uso único." },
  { valor: "PRIME" as const, titulo: "PRIME", detalhe: "Auditoria profunda, até 80 passos, antes de qualquer tese." },
];

const rotuloRun: Record<string, string> = {
  STARTING: "Iniciando",
  RUNNING: "Em execução",
  WAITING_APPROVAL: "Aguardando aprovação",
  COMPLETED: "Concluída",
  PARTIAL: "Parcial",
  BLOCKED: "Bloqueada",
  NEEDS_INPUT: "Precisa de informação",
  MODE_MISMATCH: "Escrita bloqueada",
  FAILED: "Falhou",
  STOPPED: "Interrompida",
};

const rotuloComplexidade: Record<string, string> = {
  SIMPLE: "Simples (8 passos)",
  STANDARD: "Padrão (14 passos)",
  BROAD: "Ampla (60–80 passos)",
};

function Pagina() {
  const carregar = useServerFn(listarAgente);
  const iniciar = useServerFn(iniciarExecucaoAgente);
  const parar = useServerFn(pararExecucaoAgente);
  const responder = useServerFn(responderAprovacaoAgente);
  const criar = useServerFn(criarDispositivo);
  const remover = useServerFn(removerDispositivo);
  const queryClient = useQueryClient();

  const [tarefa, setTarefa] = useState("");
  const [modo, setModo] = useState<"ANALYZE" | "APPROVAL" | "PRIME">("ANALYZE");
  const [nomeDispositivo, setNomeDispositivo] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [runAberta, setRunAberta] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agente"],
    queryFn: () => carregar(),
    refetchInterval: 8000,
  });

  const carregarLogs = useServerFn(listarLogsExecucao);
  const { data: detalhe } = useQuery({
    queryKey: ["agente-run", runAberta],
    queryFn: () => carregarLogs({ data: { runId: runAberta! } }),
    enabled: Boolean(runAberta),
    refetchInterval: 4000,
  });

  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ["agente"] });

  const mIniciar = useMutation({
    mutationFn: () => iniciar({ data: { tarefa, modo } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Tarefa enviada ao companion.");
        setAviso(null);
        setTarefa("");
        if (r.runId) setRunAberta(r.runId);
      } else {
        setAviso(r.motivo ?? "Não foi possível iniciar a tarefa.");
      }
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mParar = useMutation({
    mutationFn: (runId: string) => parar({ data: { runId } }),
    onSuccess: () => {
      toast.success("Execução interrompida.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mResponder = useMutation({
    mutationFn: (entrada: { id: string; acao: "APROVAR" | "RECUSAR" }) => responder({ data: entrada }),
    onSuccess: (r) => {
      toast.success(r.status === "APPROVED" ? "Autorização concedida (uso único)." : "Solicitação recusada.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mCriar = useMutation({
    mutationFn: () => criar({ data: { nome: nomeDispositivo.trim() || "Meu computador" } }),
    onSuccess: (r) => {
      setCodigo(r.codigo);
      setNomeDispositivo("");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mRemover = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Dispositivo removido.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando agente…</p>;
  }

  const parado = data.workspace?.agent_stopped === true;
  const pendentes = data.aprovacoes.filter((a) => a.status === "PENDING");

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Agente de Navegador</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{descricao}</p>
      </header>

      {parado && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          O agente está parado. Reative o agente no topo da tela para enviar tarefas ou responder aprovações.
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Bot className="h-4 w-4 text-primary" /> Nova tarefa
          </h2>
          <Textarea
            value={tarefa}
            onChange={(e) => setTarefa(e.target.value)}
            rows={3}
            placeholder="Ex.: conferir no Meta Ads se a campanha Black Friday está com o orçamento do painel"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            {modos.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setModo(m.valor)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  modo === m.valor ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="block font-medium">{m.titulo}</span>
                <span className="block text-xs text-muted-foreground">{m.detalhe}</span>
              </button>
            ))}
          </div>
          {aviso && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
            </p>
          )}
          <Button
            onClick={() => mIniciar.mutate()}
            disabled={parado || tarefa.trim().length < 3 || mIniciar.isPending}
          >
            <Play className="mr-2 h-4 w-4" /> {mIniciar.isPending ? "Enviando…" : "Enviar ao companion"}
          </Button>
        </article>

        <article className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Laptop className="h-4 w-4 text-primary" /> Dispositivos
          </h2>
          <div className="flex gap-2">
            <Input
              value={nomeDispositivo}
              onChange={(e) => setNomeDispositivo(e.target.value)}
              placeholder="Nome do computador"
            />
            <Button variant="outline" onClick={() => mCriar.mutate()} disabled={mCriar.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Parear
            </Button>
          </div>

          {codigo && (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
              <p className="font-medium">Código de pareamento (válido por 10 minutos)</p>
              <p className="mt-1 font-mono text-2xl tracking-widest">{codigo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Informe este código no companion instalado na sua máquina. Ele aparece uma única vez.
              </p>
            </div>
          )}

          {data.dispositivos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum dispositivo pareado. O agente de navegador roda na sua máquina e usa o seu próprio Chrome, Edge ou
              Brave — a nuvem só envia tarefas e recebe os registros.
            </p>
          )}

          <ul className="space-y-2">
            {data.dispositivos.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="text-sm">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.aguardandoPareamento
                      ? "Aguardando pareamento"
                      : `${rotuloStatusCompanion[d.offline ? "OFFLINE" : d.status] ?? d.status} · sinal ${formatarRelativo(d.last_heartbeat_at)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.app_version ? `Versão ${d.app_version}` : "Versão desconhecida"}
                    {d.browser_label ? ` · ${d.browser_label}` : ""}
                  </p>
                </div>
                <ConfirmarAcao
                  titulo={`Remover "${d.name}"?`}
                  descricao="O dispositivo será despareado e precisará de um novo código para voltar a executar tarefas."
                  rotuloConfirmar="Remover dispositivo"
                  aoConfirmar={() => mRemover.mutate(d.id)}
                >
                  {(abrir) => (
                    <Button variant="ghost" size="sm" onClick={abrir} aria-label="Remover dispositivo">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </ConfirmarAcao>

              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Aprovações do agente</h2>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação aguardando resposta.</p>
        ) : (
          <ul className="space-y-3">
            {pendentes.map((a) => (
              <li key={a.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Alvo: {a.target ?? "—"} · De {a.current_value ?? "—"} para {a.proposed_value ?? "—"} · Risco{" "}
                      {rotuloRisco[a.risk_level]} · Vale até {formatarDataHora(a.expires_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={parado || mResponder.isPending}
                      onClick={() => mResponder.mutate({ id: a.id, acao: "APROVAR" })}
                    >
                      <Check className="mr-2 h-4 w-4" /> Autorizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={parado || mResponder.isPending}
                      onClick={() => mResponder.mutate({ id: a.id, acao: "RECUSAR" })}
                    >
                      <X className="mr-2 h-4 w-4" /> Recusar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Execuções</h2>
        {data.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução registrada até agora.</p>
        ) : (
          <ul className="space-y-2">
            {data.runs.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{r.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {rotuloRun[r.status] ?? r.status} ·{" "}
                      {r.mode === "ANALYZE" ? "Análise" : r.mode === "APPROVAL" ? "Aprovação" : "PRIME"} ·{" "}
                      {rotuloComplexidade[r.complexity] ?? r.complexity} · {formatarRelativo(r.created_at)}
                    </p>
                    {r.error_message && <p className="mt-1 text-xs text-destructive">{r.error_message}</p>}
                    {r.result_text && <p className="mt-1 text-xs text-muted-foreground">{r.result_text}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRunAberta(runAberta === r.id ? null : r.id)}
                    >
                      {runAberta === r.id ? "Ocultar registros" : "Ver registros"}
                    </Button>
                    {["STARTING", "RUNNING", "WAITING_APPROVAL", "NEEDS_INPUT"].includes(r.status) && (
                      <Button size="sm" variant="ghost" onClick={() => mParar.mutate(r.id)}>
                        <Square className="mr-2 h-4 w-4" /> Parar
                      </Button>
                    )}
                  </div>
                </div>

                {runAberta === r.id && (
                  <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-xs">
                    {(detalhe?.logs ?? []).length === 0 ? (
                      <p className="text-muted-foreground">Sem registros ainda.</p>
                    ) : (
                      (detalhe?.logs ?? []).map((l) => (
                        <p key={l.id} className={l.level === "ERROR" ? "text-destructive" : ""}>
                          <span className="text-muted-foreground">{formatarDataHora(l.created_at)} </span>
                          {l.message}
                        </p>
                      ))
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
