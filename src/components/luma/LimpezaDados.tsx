import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmarAcao } from "@/components/luma/ConfirmarAcao";
import { limparDadosWorkspace } from "@/lib/luma.functions";

type Escopo = "DEMO" | "REAIS";
type Plataforma = "TODAS" | "META" | "GOOGLE_ADS";
type Periodo = 0 | 7 | 14 | 30;

const rotuloEscopo: Record<Escopo, string> = {
  DEMO: "Dados de demonstração (fictícios)",
  REAIS: "Dados reais (API ou coleta por navegador)",
};

/** Apaga números fictícios ou coletados, para que os dois nunca se misturem. */
export function LimpezaDados() {
  const limpar = useServerFn(limparDadosWorkspace);
  const queryClient = useQueryClient();

  const [escopo, setEscopo] = useState<Escopo>("DEMO");
  const [plataforma, setPlataforma] = useState<Plataforma>("TODAS");
  const [periodo, setPeriodo] = useState<Periodo>(0);

  const mLimpar = useMutation({
    mutationFn: () => limpar({ data: { escopo, plataforma, periodo } }),
    onSuccess: (r) => {
      toast.success(
        `Limpeza concluída: ${r.campanhas} campanhas, ${r.medicoes} medições e ${r.decisoes} decisões removidas.`,
      );
      for (const chave of ["visao-geral", "campanhas", "decisoes", "integracoes", "coleta-navegador", "diagnostico"]) {
        void queryClient.invalidateQueries({ queryKey: [chave] });
      }
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Eraser className="h-4 w-4 text-primary" /> Limpeza de dados
        </h2>
        <p className="text-sm text-muted-foreground">
          Apague os números de demonstração ao começar a usar dados reais, ou refaça uma coleta do zero sem correr o
          risco de repetir períodos. A ação não pode ser desfeita.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="limpeza-escopo">O que apagar</Label>
          <Select value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
            <SelectTrigger id="limpeza-escopo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(rotuloEscopo).map(([id, rotulo]) => (
                <SelectItem key={id} value={id}>
                  {rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="limpeza-plataforma">Plataforma</Label>
          <Select value={plataforma} onValueChange={(v) => setPlataforma(v as Plataforma)}>
            <SelectTrigger id="limpeza-plataforma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="META">Meta Ads</SelectItem>
              <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="limpeza-periodo">Período</Label>
          <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v) as Periodo)}>
            <SelectTrigger id="limpeza-periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Tudo (campanhas e histórico)</SelectItem>
              <SelectItem value="7">Só o histórico dos últimos 7 dias</SelectItem>
              <SelectItem value="14">Só o histórico dos últimos 14 dias</SelectItem>
              <SelectItem value="30">Só o histórico dos últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ConfirmarAcao
        titulo="Apagar estes dados?"
        descricao={`Serão removidos: ${rotuloEscopo[escopo].toLowerCase()} — ${
          plataforma === "TODAS" ? "todas as plataformas" : plataforma === "META" ? "Meta Ads" : "Google Ads"
        }, ${periodo === 0 ? "campanhas e todo o histórico" : `histórico dos últimos ${periodo} dias`}. Não é possível desfazer.`}
        onConfirmar={() => mLimpar.mutate()}
      >
        <Button variant="destructive" size="sm" disabled={mLimpar.isPending}>
          Apagar dados selecionados
        </Button>
      </ConfirmarAcao>
    </section>
  );
}
