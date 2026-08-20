import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";

import { listarCampanhas } from "@/lib/luma.functions";
import {
  formatarDecimal,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarRelativo,
  formatarRoas,
  rotuloPlataforma,
  rotuloStatusCampanha,
} from "@/lib/luma/format";
import { Badge } from "@/components/ui/badge";
import { ErroTela } from "@/components/luma/Estados";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — LUMA" },
      {
        name: "description",
        content:
          "Todas as campanhas de Meta Ads e Google Ads com métricas, filtros e histórico de performance.",
      },
      { property: "og:title", content: "Campanhas — LUMA" },
      {
        property: "og:description",
        content:
          "Todas as campanhas de Meta Ads e Google Ads com métricas, filtros e histórico de performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

type Coluna =
  | "name"
  | "budget_daily"
  | "spend"
  | "revenue"
  | "roas"
  | "cpa"
  | "ctr"
  | "conversions"
  | "frequency";

function Pagina() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["campanhas"],
    queryFn: () => listarCampanhas(),
  });

  const [busca, setBusca] = useState("");
  const [plataforma, setPlataforma] = useState("TODAS");
  const [status, setStatus] = useState("TODOS");
  const [ordem, setOrdem] = useState<{ coluna: Coluna; asc: boolean }>({
    coluna: "spend",
    asc: false,
  });

  const linhas = useMemo(() => {
    const lista = (data ?? []).filter((c) => {
      if (plataforma !== "TODAS" && c.platform !== plataforma) return false;
      if (status !== "TODOS" && c.status !== status) return false;
      if (busca && !c.name.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
    return [...lista].sort((a, b) => {
      const va = a[ordem.coluna];
      const vb = b[ordem.coluna];
      if (typeof va === "string" || typeof vb === "string") {
        return ordem.asc
          ? String(va).localeCompare(String(vb), "pt-BR")
          : String(vb).localeCompare(String(va), "pt-BR");
      }
      return ordem.asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
  }, [data, busca, plataforma, status, ordem]);

  const totais = useMemo(() => {
    const t = linhas.reduce(
      (acc, c) => {
        acc.investimento += Number(c.spend);
        acc.receita += Number(c.revenue);
        acc.conversoes += Number(c.conversions);
        return acc;
      },
      { investimento: 0, receita: 0, conversoes: 0 },
    );
    return {
      ...t,
      roas: t.investimento > 0 ? t.receita / t.investimento : 0,
    };
  }, [linhas]);

  const alternar = (coluna: Coluna) =>
    setOrdem((o) => ({ coluna, asc: o.coluna === coluna ? !o.asc : false }));

  const Cabecalho = ({ coluna, children }: { coluna: Coluna; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => alternar(coluna)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        {ordem.coluna === coluna ? (
          ordem.asc ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : null}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Meta Ads e Google Ads em uma única tabela, com métricas calculadas do período.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Resumo titulo="Campanhas" valor={formatarNumero(linhas.length)} />
        <Resumo titulo="Investimento" valor={formatarMoeda(totais.investimento)} />
        <Resumo titulo="Receita" valor={formatarMoeda(totais.receita)} />
        <Resumo titulo="ROAS médio" valor={formatarRoas(totais.roas)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar campanha…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={plataforma} onValueChange={setPlataforma}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as plataformas</SelectItem>
            <SelectItem value="META">Meta Ads</SelectItem>
            <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="ACTIVE">Ativas</SelectItem>
            <SelectItem value="PAUSED">Pausadas</SelectItem>
            <SelectItem value="ARCHIVED">Arquivadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErroTela erro={error} aoTentarNovamente={() => void refetch()} titulo="Não foi possível carregar as campanhas" />
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando campanhas…
            </div>
          ) : linhas.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">
              Nenhuma campanha encontrada com esses filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <Cabecalho coluna="name">Campanha</Cabecalho>
                    <TableHead>Status</TableHead>
                    <Cabecalho coluna="budget_daily">Orçamento/dia</Cabecalho>
                    <Cabecalho coluna="spend">Investimento</Cabecalho>
                    <Cabecalho coluna="revenue">Receita</Cabecalho>
                    <Cabecalho coluna="roas">ROAS</Cabecalho>
                    <Cabecalho coluna="cpa">CPA</Cabecalho>
                    <Cabecalho coluna="ctr">CTR</Cabecalho>
                    <Cabecalho coluna="conversions">Conversões</Cabecalho>
                    <Cabecalho coluna="frequency">Frequência</Cabecalho>
                    <TableHead>Sincronizada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="min-w-56">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rotuloPlataforma[c.platform] ?? c.platform}
                            {c.objective ? ` · ${c.objective}` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>
                          {rotuloStatusCampanha[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatarMoeda(c.budget_daily)}</TableCell>
                      <TableCell>{formatarMoeda(c.spend)}</TableCell>
                      <TableCell>{formatarMoeda(c.revenue)}</TableCell>
                      <TableCell
                        className={
                          Number(c.roas) >= 2
                            ? "font-medium text-primary"
                            : Number(c.roas) < 1
                              ? "font-medium text-destructive"
                              : "font-medium"
                        }
                      >
                        {formatarRoas(c.roas)}
                      </TableCell>
                      <TableCell>{formatarMoeda(c.cpa)}</TableCell>
                      <TableCell>{formatarPercentual(c.ctr)}</TableCell>
                      <TableCell>{formatarDecimal(c.conversions)}</TableCell>
                      <TableCell>{formatarDecimal(c.frequency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatarRelativo(c.synced_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-xl font-semibold">{valor}</p>
      </CardContent>
    </Card>
  );
}
