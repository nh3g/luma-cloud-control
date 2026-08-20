import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarDataHora, formatarMoeda } from "@/lib/luma/format";
import {
  analisarImportacao,
  confirmarImportacao,
  listarImportacoesRelatorio,
} from "@/lib/luma.functions";

type Plataforma = "META" | "GOOGLE_ADS";
type Periodo = 7 | 14 | 30;

type Campanha = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget_daily: number;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  frequency: number;
};

type Previa = {
  campanhas: Campanha[];
  avisos: string[];
  totais: { gasto: number; receita: number; conversoes: number; roas: number };
};

const titulos: Record<Plataforma, string> = { META: "Meta Ads", GOOGLE_ADS: "Google Ads" };

/** Lê um arquivo de planilha no próprio navegador e devolve o texto em CSV. */
async function arquivoParaTexto(arquivo: File): Promise<string> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".csv") || nome.endsWith(".tsv") || nome.endsWith(".txt")) return arquivo.text();
  const XLSX = await import("xlsx");
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const planilha = XLSX.read(dados, { type: "array" });
  const primeira = planilha.SheetNames[0];
  if (!primeira) throw new Error("A planilha está vazia.");
  const aba = planilha.Sheets[primeira];
  if (!aba) throw new Error("A planilha está vazia.");
  return XLSX.utils.sheet_to_csv(aba);
}

/**
 * Importação de relatórios exportados do painel de anúncios. Não usa navegador
 * na nuvem: o arquivo é lido aqui e interpretado pela IA no servidor.
 */
export function ImportarRelatorio() {
  const analisar = useServerFn(analisarImportacao);
  const confirmar = useServerFn(confirmarImportacao);
  const listar = useServerFn(listarImportacoesRelatorio);
  const queryClient = useQueryClient();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [plataforma, setPlataforma] = useState<Plataforma>("META");
  const [dias, setDias] = useState<Periodo>(7);
  const [conteudo, setConteudo] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);

  const { data: historico } = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => listar(),
  });

  const invalidar = () => {
    for (const chave of ["importacoes", "visao-geral", "campanhas", "integracoes", "coleta-navegador", "diagnostico"]) {
      void queryClient.invalidateQueries({ queryKey: [chave] });
    }
  };

  const mAnalisar = useMutation({
    mutationFn: () => analisar({ data: { plataforma, conteudo: conteudo.trim(), dias } }),
    onSuccess: (r) => {
      setPrevia(r as Previa);
      toast.success(`${r.campanhas.length} campanhas reconhecidas. Confira e confirme.`);
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mConfirmar = useMutation({
    mutationFn: () =>
      confirmar({
        data: {
          plataforma,
          dias,
          campanhas: previa?.campanhas ?? [],
          ...(rotulo.trim() ? { rotulo: rotulo.trim() } : {}),
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.campanhas} campanhas importadas como dados reais.`);
      setPrevia(null);
      setConteudo("");
      setRotulo("");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const texto = await arquivoParaTexto(arquivo);
      setConteudo(texto);
      setRotulo(arquivo.name);
      setPrevia(null);
      toast.success(`Arquivo "${arquivo.name}" carregado. Clique em "Ler relatório".`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível ler este arquivo.");
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <FileSpreadsheet className="h-4 w-4 text-primary" /> Importar relatório (sem custo de navegador)
        </h2>
        <p className="text-sm text-muted-foreground">
          Exporte o relatório de campanhas no Gerenciador de Anúncios ou no Google Ads — ou selecione a tabela na tela e
          copie. A LUMA lê o conteúdo com a IA, mostra uma prévia e só grava depois da sua confirmação. Reimportar o
          mesmo período substitui as campanhas, sem duplicar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="import-plataforma">Plataforma</Label>
          <Select value={plataforma} onValueChange={(v) => setPlataforma(v as Plataforma)}>
            <SelectTrigger id="import-plataforma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="META">Meta Ads</SelectItem>
              <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-dias">Período do relatório</Label>
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v) as Periodo)}>
            <SelectTrigger id="import-dias">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputArquivo}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
          />
          <Button size="sm" variant="outline" onClick={() => inputArquivo.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Escolher arquivo (CSV, TSV ou Excel)
          </Button>
          <span className="text-xs text-muted-foreground">ou cole o conteúdo abaixo</span>
        </div>

        <Label htmlFor="import-conteudo" className="sr-only">
          Conteúdo do relatório
        </Label>
        <Textarea
          id="import-conteudo"
          value={conteudo}
          onChange={(e) => {
            setConteudo(e.target.value);
            setPrevia(null);
          }}
          rows={6}
          placeholder={"Campanha\tValor usado\tImpressões\tCliques\tCompras\tValor de conversão\nBlack Friday\t2.450,80\t210000\t4200\t61\t9.803,20"}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => mAnalisar.mutate()}
          disabled={conteudo.trim().length < 20 || mAnalisar.isPending}
        >
          {mAnalisar.isPending ? "Lendo relatório…" : "Ler relatório"}
        </Button>
        {previa && (
          <Button size="sm" variant="outline" onClick={() => mConfirmar.mutate()} disabled={mConfirmar.isPending}>
            Confirmar e importar {previa.campanhas.length} campanhas
          </Button>
        )}
      </div>

      {previa && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm">
            <strong>{previa.campanhas.length} campanhas</strong> — gasto {formatarMoeda(previa.totais.gasto)}, receita{" "}
            {formatarMoeda(previa.totais.receita)}, ROAS {previa.totais.roas.toFixed(2)}x
          </p>
          {previa.avisos.length > 0 && (
            <ul className="list-inside list-disc text-xs text-amber-400">
              {previa.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Campanha</th>
                  <th className="py-1 pr-2">Situação</th>
                  <th className="py-1 pr-2 text-right">Gasto</th>
                  <th className="py-1 pr-2 text-right">Receita</th>
                  <th className="py-1 pr-2 text-right">Conv.</th>
                  <th className="py-1 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previa.campanhas.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1 pr-2">{c.name}</td>
                    <td className="py-1 pr-2 text-muted-foreground">{c.status}</td>
                    <td className="py-1 pr-2 text-right">{formatarMoeda(c.spend)}</td>
                    <td className="py-1 pr-2 text-right">{formatarMoeda(c.revenue)}</td>
                    <td className="py-1 pr-2 text-right">{c.conversions}</td>
                    <td className="py-1 text-right">{(c.spend > 0 ? c.revenue / c.spend : 0).toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(historico?.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Últimas importações</h3>
          <ul className="divide-y divide-border text-sm">
            {historico?.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className="font-medium">{titulos[i.platform as Plataforma] ?? i.platform}</strong>{" "}
                  <span className="text-muted-foreground">
                    {i.campaigns} campanhas · {i.lookback_days} dias
                  </span>
                </span>
                <span className="text-muted-foreground">{formatarMoeda(Number(i.spend))}</span>
                <span className="text-muted-foreground">{formatarDataHora(i.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
