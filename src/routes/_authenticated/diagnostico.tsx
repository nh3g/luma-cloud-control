import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { obterDiagnostico } from "@/lib/luma.functions";
import {
  formatarDataHora,
  formatarRelativo,
  rotuloPlataforma,
  rotuloStatusCompanion,
  rotuloStatusDecisao,
  rotuloStatusIntegracao,
  rotuloStatusSync,
} from "@/lib/luma/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — LUMA" },
      {
        name: "description",
        content:
          "Estado do agente, integrações, sincronizações, decisões por status e registros de auditoria recentes.",
      },
      { property: "og:title", content: "Diagnóstico — LUMA" },
      {
        property: "og:description",
        content:
          "Estado do agente, integrações, sincronizações, decisões por status e registros de auditoria recentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { data, isLoading } = useQuery({
    queryKey: ["diagnostico"],
    queryFn: () => obterDiagnostico(),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando diagnóstico…
      </div>
    );
  }

  const parado = data.workspace?.agent_stopped ?? false;
  const contagem = data.contagemDecisoes;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Diagnóstico</h1>
        <p className="text-sm text-muted-foreground">
          Tudo o que o agente fez neste workspace, com registro auditável de cada passo.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Agente</p>
            <p
              className={
                parado ? "mt-1 text-xl font-semibold text-destructive" : "mt-1 text-xl font-semibold text-primary"
              }
            >
              {parado ? "Parado" : "Ativo"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.workspace?.demo_mode ? "Modo demonstração — execuções simuladas" : "Execuções via API oficial"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Última análise</p>
            <p className="mt-1 text-xl font-semibold">{formatarRelativo(data.ultimaAnalise)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Intervalo configurado: {data.settings?.analysis_interval_minutes ?? "—"} min · validade{" "}
              {data.settings?.decision_ttl_minutes ?? "—"} min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Decisões por estado</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.keys(contagem).length === 0 ? (
                <span className="text-sm text-muted-foreground">Nenhuma decisão registrada.</span>
              ) : (
                Object.entries(contagem).map(([status, total]) => (
                  <Badge key={status} variant="secondary">
                    {rotuloStatusDecisao[status] ?? status}: {total}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Integrações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.integracoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma integração configurada.</p>
            ) : (
              data.integracoes.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span>{rotuloPlataforma[i.platform] ?? i.platform}</span>
                  <Badge variant={i.status === "CONNECTED" ? "default" : "destructive"}>
                    {rotuloStatusIntegracao[i.status] ?? i.status}
                  </Badge>
                </div>
              ))
            )}
            <div className="pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Companion</p>
              {data.companion.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dispositivo pareado.</p>
              ) : (
                data.companion.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <Badge variant="secondary">{rotuloStatusCompanion[c.status] ?? c.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Sincronizações recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.syncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada.</p>
            ) : (
              data.syncs.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p>{rotuloPlataforma[s.platform] ?? s.platform}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.message ?? "—"} · {formatarRelativo(s.started_at)}
                    </p>
                  </div>
                  <Badge variant={s.status === "SUCCESS" ? "default" : "secondary"}>
                    {rotuloStatusSync[s.status] ?? s.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Registros de auditoria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação executada ainda. Aprove e execute uma decisão para gerar registros.
            </p>
          ) : (
            data.logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0">
                {l.success ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {l.method} {l.endpoint}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rotuloPlataforma[l.platform] ?? l.platform} · {formatarDataHora(l.executed_at)}
                    {l.error_message ? ` · ${l.error_message}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {parado ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          O agente está parado: análises e execuções ficam bloqueadas até a reativação manual.
        </div>
      ) : null}
    </div>
  );
}
