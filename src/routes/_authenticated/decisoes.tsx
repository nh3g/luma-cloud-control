import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { decidirDecisao, listarDecisoes } from "@/lib/luma.functions";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  formatarDataHora,
  formatarRelativo,
  rotuloAcao,
  rotuloOrigem,
  rotuloPlataforma,
  rotuloRisco,
  rotuloStatusDecisao,
} from "@/lib/luma/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/decisoes")({
  head: () => ({
    meta: [
      { title: "Decisões — LUMA" },
      {
        name: "description",
        content:
          "Fila de decisões do motor de regras com aprovação humana de uso único e histórico de execuções.",
      },
      { property: "og:title", content: "Decisões — LUMA" },
      {
        property: "og:description",
        content:
          "Fila de decisões do motor de regras com aprovação humana de uso único e histórico de execuções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function tempoRestante(expira: string) {
  const ms = new Date(expira).getTime() - Date.now();
  if (ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `expira em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `expira em ${h} h`;
  return `expira em ${Math.floor(h / 24)} d`;
}

function descreverValores(anterior: unknown, proposto: unknown) {
  const texto = (v: unknown) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => `${k}: ${String(val)}`)
        .join(" · ");
    }
    return String(v);
  };
  const a = texto(anterior);
  const p = texto(proposto);
  if (!a && !p) return null;
  return `${a ?? "—"} → ${p ?? "—"}`;
}

function Pagina() {
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace();
  const [aba, setAba] = useState("PENDING");

  const { data, isLoading } = useQuery({
    queryKey: ["decisoes"],
    queryFn: () => listarDecisoes(),
  });

  const decidir = useServerFn(decidirDecisao);
  const mutacao = useMutation({
    mutationFn: (vars: { id: string; acao: "APROVAR" | "RECUSAR" }) => decidir({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.status === "APPROVED" ? "Decisão aprovada." : "Decisão recusada.");
      void queryClient.invalidateQueries({ queryKey: ["decisoes"] });
      void queryClient.invalidateQueries({ queryKey: ["visao-geral"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agenteParado = workspace?.agent_stopped ?? false;

  const listas = useMemo(() => {
    const todas = data ?? [];
    const expirada = (d: (typeof todas)[number]) =>
      d.status === "EXPIRED" ||
      (d.status === "PENDING" && new Date(d.expires_at).getTime() <= Date.now());
    return {
      PENDING: todas.filter((d) => d.status === "PENDING" && !expirada(d)),
      APPROVED: todas.filter((d) => d.status === "APPROVED" || d.status === "EXECUTED"),
      REJECTED: todas.filter((d) => d.status === "REJECTED"),
      EXPIRED: todas.filter(expirada).filter((d) => d.status !== "APPROVED"),
      TODAS: todas,
    } as const;
  }, [data]);

  const visiveis = listas[aba as keyof typeof listas] ?? listas.TODAS;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Decisões</h1>
        <p className="text-sm text-muted-foreground">
          Nada é executado sem sua aprovação. Cada aprovação vale uma única vez e expira no prazo
          definido nas configurações.
        </p>
      </header>

      {agenteParado ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          O agente está parado. Reative o agente na barra superior para aprovar ou recusar decisões.
        </div>
      ) : null}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="PENDING">Pendentes ({listas.PENDING.length})</TabsTrigger>
          <TabsTrigger value="APPROVED">Aprovadas ({listas.APPROVED.length})</TabsTrigger>
          <TabsTrigger value="REJECTED">Recusadas ({listas.REJECTED.length})</TabsTrigger>
          <TabsTrigger value="EXPIRED">Expiradas ({listas.EXPIRED.length})</TabsTrigger>
          <TabsTrigger value="TODAS">Todas ({listas.TODAS.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando decisões…
        </div>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            Nenhuma decisão nesta aba.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visiveis.map((d) => {
            const restante = tempoRestante(d.expires_at);
            const pendente = d.status === "PENDING" && restante !== null;
            const valores = descreverValores(d.previous_value_json, d.proposed_value_json);
            return (
              <Card key={d.id}>
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {rotuloAcao[d.action_type] ?? d.action_type}
                      </span>
                      <Badge variant="secondary">
                        {rotuloPlataforma[d.platform] ?? d.platform}
                      </Badge>
                      <Badge variant={d.status === "PENDING" ? "default" : "secondary"}>
                        {restante === null && d.status === "PENDING"
                          ? "Expirada"
                          : (rotuloStatusDecisao[d.status] ?? d.status)}
                      </Badge>
                      <Badge variant="outline">Risco {rotuloRisco[d.risk_level]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {d.campaign_name ?? "Campanha não identificada"}
                    </p>
                    <p className="text-sm">{d.reason}</p>
                    {valores ? (
                      <p className="text-xs text-muted-foreground">Alteração: {valores}</p>
                    ) : null}
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      Gerada {formatarRelativo(d.created_at)} por{" "}
                      {rotuloOrigem[d.source] ?? d.source} ·{" "}
                      {pendente ? restante : `prazo em ${formatarDataHora(d.expires_at)}`} ·
                      confiança {Math.round(Number(d.confidence) * 100)}%
                    </p>
                  </div>

                  {pendente ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        disabled={agenteParado || mutacao.isPending}
                        onClick={() => mutacao.mutate({ id: d.id, acao: "APROVAR" })}
                      >
                        <Check className="mr-1 size-4" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={agenteParado || mutacao.isPending}
                        onClick={() => mutacao.mutate({ id: d.id, acao: "RECUSAR" })}
                      >
                        <X className="mr-1 size-4" /> Recusar
                      </Button>
                    </div>
                  ) : (
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {d.approved_at
                        ? `Aprovada em ${formatarDataHora(d.approved_at)}`
                        : d.rejected_at
                          ? `Recusada em ${formatarDataHora(d.rejected_at)}`
                          : "Sem ação disponível"}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
