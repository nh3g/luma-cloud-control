import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { exportarRelatorioCsv, obterRelatorio } from "@/lib/luma.functions";
import {
  formatarDataHora,
  formatarDecimal,
  formatarMoeda,
  formatarPercentual,
  formatarRoas,
  rotuloAcao,
  rotuloPlataforma,
  rotuloStatusDecisao,
} from "@/lib/luma/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DESC =
  "Relatório de investimento, receita, ROAS e decisões do período, com comparativo e exportação em CSV.";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — LUMA" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Relatórios — LUMA" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

type Periodo = 7 | 14 | 30;

function variacao(atual: number, anterior: number) {
  if (anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function Pagina() {
  const [dias, setDias] = useState<Periodo>(7);
  const [baixando, setBaixando] = useState(false);
  const exportar = useServerFn(exportarRelatorioCsv);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio", dias],
    queryFn: () => obterRelatorio({ data: { dias } }),
  });

  const baixar = async () => {
    setBaixando(true);
    try {
      const { csv, nome } = await exportar({ data: { dias } });
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado.");
    } catch {
      toast.error("Não foi possível gerar o CSV.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Resultado do período e comparativo com os {dias} dias anteriores.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v) as Periodo)}>
            <TabsList>
              <TabsTrigger value="7">7 dias</TabsTrigger>
              <TabsTrigger value="14">14 dias</TabsTrigger>
              <TabsTrigger value="30">30 dias</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => void baixar()} disabled={baixando || isLoading}>
            {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exportar CSV
          </Button>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando relatório…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              titulo="Investimento"
              valor={formatarMoeda(data.atual.investimento)}
              variacao={variacao(data.atual.investimento, data.anterior.investimento)}
              melhorSubindo={false}
            />
            <Cartao
              titulo="Receita"
              valor={formatarMoeda(data.atual.receita)}
              variacao={variacao(data.atual.receita, data.anterior.receita)}
              melhorSubindo
            />
            <Cartao
              titulo="ROAS"
              valor={formatarRoas(data.atual.roas)}
              variacao={variacao(data.atual.roas, data.anterior.roas)}
              melhorSubindo
            />
            <Cartao
              titulo="CPA"
              valor={formatarMoeda(data.atual.cpa)}
              variacao={variacao(data.atual.cpa, data.anterior.cpa)}
              melhorSubindo={false}
            />
            <Cartao titulo="Conversões" valor={formatarDecimal(data.atual.conversoes)} />
            <Cartao titulo="CTR" valor={formatarPercentual(data.atual.ctr)} />
            <Cartao titulo="CPC" valor={formatarMoeda(data.atual.cpc)} />
            <Cartao
              titulo="Impacto em orçamento"
              valor={formatarMoeda(data.decisoes.impactoOrcamento)}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Decisões do período ({data.decisoes.total})
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.decisoes.porStatus).map(([status, qtd]) => (
                  <Badge key={status} variant="secondary">
                    {rotuloStatusDecisao[status] ?? status}: {qtd}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {data.decisoes.itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma decisão foi gerada neste período. Rode uma análise na tela de Decisões.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium">Quando</th>
                        <th className="py-2 text-left font-medium">Ação</th>
                        <th className="py-2 text-left font-medium">Campanha</th>
                        <th className="py-2 text-left font-medium">Plataforma</th>
                        <th className="py-2 text-right font-medium">Δ Orçamento</th>
                        <th className="py-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.decisoes.itens.map((d) => (
                        <tr key={d.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 text-muted-foreground">
                            {formatarDataHora(d.created_at)}
                          </td>
                          <td className="py-2">{rotuloAcao[d.action_type] ?? d.action_type}</td>
                          <td className="py-2 text-muted-foreground">{d.campaign_name ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">
                            {rotuloPlataforma[d.platform] ?? d.platform}
                          </td>
                          <td className="py-2 text-right">
                            {d.delta === null ? "—" : formatarMoeda(d.delta)}
                          </td>
                          <td className="py-2 text-right">
                            <Badge variant={d.status === "EXECUTED" ? "default" : "secondary"}>
                              {rotuloStatusDecisao[d.status] ?? d.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Cartao({
  titulo,
  valor,
  variacao: v,
  melhorSubindo,
}: {
  titulo: string;
  valor: string;
  variacao?: number | null;
  melhorSubindo?: boolean;
}) {
  const bom = v === null || v === undefined ? null : melhorSubindo ? v >= 0 : v <= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold">{valor}</p>
        {v === null || v === undefined ? (
          <p className="mt-1 text-xs text-muted-foreground">Sem período anterior para comparar</p>
        ) : (
          <p
            className={
              bom
                ? "mt-1 flex items-center gap-1 text-xs text-primary"
                : "mt-1 flex items-center gap-1 text-xs text-destructive"
            }
          >
            {v >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {formatarPercentual(Math.abs(v))} vs. período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
