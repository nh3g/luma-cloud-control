import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Link2, Plug, RefreshCw, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  formatarDataHora,
  formatarRelativo,
  rotuloPlataforma,
  rotuloStatusIntegracao,
  rotuloStatusSync,
} from "@/lib/luma/format";
import {
  alternarPreferenciaWorkspace,
  desconectarIntegracao,
  iniciarConexao,
  listarIntegracoes,
  sincronizarAgora,
} from "@/lib/luma.functions";

const descricao =
  "Conecte Meta Ads e Google Ads, sincronize suas contas e acompanhe cada execução de sincronização.";

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: (busca: Record<string, unknown>) => ({
    conectado: typeof busca["conectado"] === "string" ? busca["conectado"] : undefined,
    erro: typeof busca["erro"] === "string" ? busca["erro"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Integrações — LUMA" },
      { name: "description", content: descricao },
      { property: "og:title", content: "Integrações — LUMA" },
      { property: "og:description", content: descricao },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

const plataformas = [
  {
    chave: "META" as const,
    titulo: "Meta Ads",
    detalhe: "Facebook e Instagram · leitura de campanhas e ajuste de orçamento",
    chaves: "META_APP_ID e META_APP_SECRET",
  },
  {
    chave: "GOOGLE_ADS" as const,
    titulo: "Google Ads",
    detalhe: "Search, Performance Max e Shopping · leitura e ajuste de orçamento",
    chaves: "GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN",
  },
];

function Pagina() {
  const busca = useSearch({ from: "/_authenticated/integracoes" });
  const carregar = useServerFn(listarIntegracoes);
  const sincronizar = useServerFn(sincronizarAgora);
  const alternar = useServerFn(alternarPreferenciaWorkspace);
  const desconectar = useServerFn(desconectarIntegracao);
  const conectar = useServerFn(iniciarConexao);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["integracoes"], queryFn: () => carregar() });

  useEffect(() => {
    if (busca.conectado) toast.success(`${rotuloPlataforma[busca.conectado] ?? busca.conectado} conectado com sucesso.`);
    if (busca.erro) toast.error(`Não foi possível concluir a conexão: ${busca.erro}`);
  }, [busca.conectado, busca.erro]);

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["integracoes"] });
    void queryClient.invalidateQueries({ queryKey: ["visao-geral"] });
    void queryClient.invalidateQueries({ queryKey: ["campanhas"] });
  };

  const mSync = useMutation({
    mutationFn: () => sincronizar({ data: undefined }),
    onSuccess: (resultado) => {
      const falhas = resultado.resumos.filter((r) => r.status === "FAILED");
      if (falhas.length > 0) toast.error(falhas.map((f) => `${rotuloPlataforma[f.platform]}: ${f.mensagem}`).join(" · "));
      const okays = resultado.resumos.filter((r) => r.status === "SUCCESS");
      if (okays.length > 0) {
        toast.success(`Sincronização concluída: ${okays.reduce((t, r) => t + r.campanhas, 0)} campanhas atualizadas.`);
      }
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mPreferencia = useMutation({
    mutationFn: (entrada: { campo: "demo_mode" | "auto_sync_enabled"; valor: boolean }) => alternar({ data: entrada }),
    onSuccess: () => {
      toast.success("Preferência atualizada.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mDesconectar = useMutation({
    mutationFn: (id: string) => desconectar({ data: { id } }),
    onSuccess: () => {
      toast.success("Conta desconectada.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mConectar = useMutation({
    mutationFn: (plataforma: "META" | "GOOGLE_ADS") => conectar({ data: { plataforma } }),
    onSuccess: (resultado) => {
      window.location.href = resultado.url;
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando integrações…</p>;
  }

  const demo = data.workspace?.demo_mode !== false;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Integrações</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Button onClick={() => mSync.mutate()} disabled={mSync.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${mSync.isPending ? "animate-spin" : ""}`} />
          {mSync.isPending ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </header>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Modo demonstração</p>
            <p className="text-sm text-muted-foreground">
              Com o modo ligado, nada é enviado às contas reais: métricas e execuções são simuladas.
            </p>
          </div>
          <Switch
            checked={demo}
            onCheckedChange={(valor) => mPreferencia.mutate({ campo: "demo_mode", valor })}
            aria-label="Alternar modo demonstração"
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">Sincronização automática</p>
            <p className="text-sm text-muted-foreground">
              O agendador sincroniza as contas e roda o motor de regras no intervalo definido em Configurações.
              Última execução automática: {formatarRelativo(data.workspace?.last_auto_run_at)}.
            </p>
          </div>
          <Switch
            checked={data.workspace?.auto_sync_enabled !== false}
            onCheckedChange={(valor) => mPreferencia.mutate({ campo: "auto_sync_enabled", valor })}
            aria-label="Alternar sincronização automática"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {plataformas.map((p) => {
          const integracao = data.integracoes.find((i) => i.platform === p.chave);
          const conectado = integracao?.status === "CONNECTED";
          const temCredenciais = data.credenciais[p.chave];
          return (
            <article key={p.chave} className="space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-medium">
                    <Plug className="h-4 w-4 text-primary" /> {p.titulo}
                  </h2>
                  <p className="text-sm text-muted-foreground">{p.detalhe}</p>
                </div>
                <span
                  className={`rounded-md border px-2 py-1 text-xs ${
                    conectado ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {rotuloStatusIntegracao[integracao?.status ?? "DISCONNECTED"]}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Conta</dt>
                  <dd>{integracao?.account_id || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Campanhas</dt>
                  <dd>{data.contagemCampanhas[p.chave] ?? 0}</dd>
                </div>
              </dl>

              {integracao?.status === "ERROR" && (
                <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {String((integracao.metadata_json as Record<string, unknown>)?.["erro"] ?? "Falha na última sincronização.")}
                </p>
              )}

              {!temCredenciais && (
                <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                  Para conectar a conta real, cadastre {p.chaves} nas chaves do projeto. Sem isso, a plataforma
                  funciona apenas em modo demonstração.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!temCredenciais || mConectar.isPending}
                  onClick={() => mConectar.mutate(p.chave)}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {conectado ? "Reconectar conta" : "Conectar conta"}
                </Button>
                {integracao && conectado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mDesconectar.isPending}
                    onClick={() => mDesconectar.mutate(integracao.id)}
                  >
                    <Unplug className="mr-2 h-4 w-4" /> Desconectar
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-lg font-medium">Últimas sincronizações</h2>
        {data.syncs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada até agora.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.syncs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {s.status === "SUCCESS" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <strong className="font-medium">{rotuloPlataforma[s.platform]}</strong>
                  <span className="text-muted-foreground">{rotuloStatusSync[s.status]}</span>
                </span>
                <span className="text-muted-foreground">{s.message ?? "—"}</span>
                <span className="text-muted-foreground">{formatarDataHora(s.started_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
