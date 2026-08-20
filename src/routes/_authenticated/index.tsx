import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";

import { obterVisaoGeral } from "@/lib/luma.functions";
import {
  formatarDecimal,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarRelativo,
  formatarRoas,
  rotuloPlataforma,
  rotuloStatusDecisao,
  rotuloStatusIntegracao,
  rotuloStatusSync,
  rotuloAcao,
} from "@/lib/luma/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão Geral — LUMA" },
      {
        name: "description",
        content:
          "Painel de performance de tráfego pago com métricas do período, decisões recentes e status das integrações.",
      },
      { property: "og:title", content: "Visão Geral — LUMA" },
      {
        property: "og:description",
        content:
          "Painel de performance de tráfego pago com métricas do período, decisões recentes e status das integrações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

type Snapshot = {
  captured_at: string;
  spend: number | string;
  revenue: number | string;
  conversions: number | string;
  clicks: number | string;
  impressions: number | string;
};

function agregarPorDia(snapshots: Snapshot[]) {
  const mapa = new Map<string, { dia: string; investimento: number; receita: number }>();
  for (const s of snapshots) {
    const dia = new Date(s.captured_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const atual = mapa.get(dia) ?? { dia, investimento: 0, receita: 0 };
    atual.investimento += Number(s.spend ?? 0);
    atual.receita += Number(s.revenue ?? 0);
    mapa.set(dia, atual);
  }
  return [...mapa.values()];
}

function Pagina() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["visao-geral"],
    queryFn: () => obterVisaoGeral(),
  });

  const resumo = useMemo(() => {
    const snaps = (data?.snapshots ?? []) as Snapshot[];
    const total = snaps.reduce(
      (acc, s) => {
        acc.investimento += Number(s.spend ?? 0);
        acc.receita += Number(s.revenue ?? 0);
        acc.conversoes += Number(s.conversions ?? 0);
        acc.cliques += Number(s.clicks ?? 0);
        acc.impressoes += Number(s.impressions ?? 0);
        return acc;
      },
      { investimento: 0, receita: 0, conversoes: 0, cliques: 0, impressoes: 0 },
    );
    return {
      ...total,
      roas: total.investimento > 0 ? total.receita / total.investimento : 0,
      cpa: total.conversoes > 0 ? total.investimento / total.conversoes : 0,
      ctr: total.impressoes > 0 ? (total.cliques / total.impressoes) * 100 : 0,
      cpc: total.cliques > 0 ? total.investimento / total.cliques : 0,
      cpm: total.impressoes > 0 ? (total.investimento / total.impressoes) * 1000 : 0,
    };
  }, [data]);

  const serie = useMemo(() => agregarPorDia((data?.snapshots ?? []) as Snapshot[]), [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando painel…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4" />
        Não foi possível carregar as métricas. Recarregue a página.
      </div>
    );
  }

  const campanhas = data?.campanhas ?? [];
  const ativas = campanhas.filter((c) => c.status === "ACTIVE").length;
  const pendentes = (data?.decisoes ?? []).filter((d) => d.status === "PENDING").length;
  const aguardandoExecucao = (data?.decisoes ?? []).filter((d) => d.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      <TourBoasVindas />

      <header>
        <h1 className="text-2xl font-semibold">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          Últimos 14 dias · {campanhas.length} campanhas ({ativas} ativas) ·{" "}
          {pendentes} decisões aguardando você
        </p>
      </header>

      {aguardandoExecucao > 0 ? (
        <Link
          to="/decisoes"
          className="block rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary"
        >
          {aguardandoExecucao} decisão(ões) aprovada(s) aguardando execução. A aprovação vale uma
          única vez e expira — abrir fila de decisões.
        </Link>
      ) : null}



      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica titulo="Investimento" valor={formatarMoeda(resumo.investimento)} />
        <Metrica titulo="Receita" valor={formatarMoeda(resumo.receita)} />
        <Metrica
          titulo="ROAS"
          valor={formatarRoas(resumo.roas)}
          destaque={resumo.roas >= 2 ? "positivo" : resumo.roas < 1 ? "negativo" : undefined}
        />
        <Metrica titulo="CPA" valor={formatarMoeda(resumo.cpa)} />
        <Metrica titulo="Conversões" valor={formatarDecimal(resumo.conversoes)} />
        <Metrica titulo="CTR" valor={formatarPercentual(resumo.ctr)} />
        <Metrica titulo="CPC" valor={formatarMoeda(resumo.cpc)} />
        <Metrica titulo="CPM" valor={formatarMoeda(resumo.cpm)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Investimento x Receita
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="grad-inv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-rec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => formatarNumero(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, nome: string) => [formatarMoeda(v), nome]}
              />
              <Area
                type="monotone"
                dataKey="investimento"
                name="Investimento"
                stroke="hsl(var(--muted-foreground))"
                fill="url(#grad-inv)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="receita"
                name="Receita"
                stroke="hsl(var(--primary))"
                fill="url(#grad-rec)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Decisões recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.decisoes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma decisão gerada ainda.</p>
            ) : (
              (data?.decisoes ?? []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {rotuloAcao[d.action_type] ?? d.action_type} ·{" "}
                      <span className="text-muted-foreground">{d.campaign_name ?? "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{d.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={d.status === "PENDING" ? "default" : "secondary"}>
                      {rotuloStatusDecisao[d.status] ?? d.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatarRelativo(d.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Integrações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.integracoes ?? []).map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span>{rotuloPlataforma[i.platform] ?? i.platform}</span>
                  <Badge variant={i.status === "CONNECTED" ? "default" : "secondary"}>
                    {rotuloStatusIntegracao[i.status] ?? i.status}
                  </Badge>
                </div>
              ))}
              {(data?.integracoes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Sincronizações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.syncs ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {rotuloPlataforma[s.platform] ?? s.platform} ·{" "}
                    {formatarRelativo(s.started_at)}
                  </span>
                  <Badge variant={s.status === "SUCCESS" ? "default" : "secondary"}>
                    {rotuloStatusSync[s.status] ?? s.status}
                  </Badge>
                </div>
              ))}
              {(data?.syncs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metrica({
  titulo,
  valor,
  destaque,
}: {
  titulo: string;
  valor: string;
  destaque?: "positivo" | "negativo" | undefined;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p
          className={
            destaque === "positivo"
              ? "mt-1 text-2xl font-semibold text-primary"
              : destaque === "negativo"
                ? "mt-1 text-2xl font-semibold text-destructive"
                : "mt-1 text-2xl font-semibold"
          }
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
