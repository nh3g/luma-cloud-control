import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AcessoMcp } from "@/components/luma/AcessoMcp";
import { obterConfiguracoes, salvarConfiguracoes, salvarPerfil } from "@/lib/luma.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LUMA" },
      { name: "description", content: "Ajuste os parâmetros do motor de regras, seu perfil e as preferências do workspace." },
      { property: "og:title", content: "Configurações — LUMA" },
      { property: "og:description", content: "Ajuste os parâmetros do motor de regras, seu perfil e as preferências do workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

type Motor = {
  target_cpa: number;
  roas_scale_threshold: number;
  roas_reduce_threshold: number;
  min_spend_no_conversion: number;
  high_frequency_threshold: number;
  low_ctr_threshold: number;
  budget_scale_percent: number;
  budget_reduce_percent: number;
  auto_analysis_enabled: boolean;
  analysis_interval_minutes: number;
  decision_ttl_minutes: number;
};

const campos: { chave: keyof Motor; rotulo: string; ajuda: string; passo: string }[] = [
  { chave: "target_cpa", rotulo: "CPA alvo (R$)", ajuda: "Custo por aquisição desejado", passo: "0.01" },
  { chave: "roas_scale_threshold", rotulo: "ROAS para escalar", ajuda: "Acima disso, sugerir aumento de orçamento", passo: "0.1" },
  { chave: "roas_reduce_threshold", rotulo: "ROAS para reduzir", ajuda: "Abaixo disso, sugerir redução", passo: "0.1" },
  { chave: "min_spend_no_conversion", rotulo: "Gasto sem conversão (R$)", ajuda: "Gasto mínimo antes de sugerir pausa", passo: "1" },
  { chave: "high_frequency_threshold", rotulo: "Frequência alta", ajuda: "Acima disso, alerta de fadiga de criativo", passo: "0.1" },
  { chave: "low_ctr_threshold", rotulo: "CTR baixo (%)", ajuda: "Abaixo disso, combinado com frequência alta", passo: "0.1" },
  { chave: "budget_scale_percent", rotulo: "Aumento de orçamento (%)", ajuda: "Percentual aplicado ao escalar", passo: "1" },
  { chave: "budget_reduce_percent", rotulo: "Redução de orçamento (%)", ajuda: "Percentual aplicado ao reduzir", passo: "1" },
  { chave: "analysis_interval_minutes", rotulo: "Intervalo de análise (min)", ajuda: "Mínimo de 15 minutos", passo: "5" },
  { chave: "decision_ttl_minutes", rotulo: "Validade da decisão (min)", ajuda: "Aprovação de uso único expira após esse tempo", passo: "15" },
];

const cores = ["#6f8cff", "#38d39f", "#ffb84d", "#ff6b6b", "#b98cff", "#4dd0e1"];

function Pagina() {
  const carregar = useServerFn(obterConfiguracoes);
  const gravarMotor = useServerFn(salvarConfiguracoes);
  const gravarPerfil = useServerFn(salvarPerfil);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["configuracoes"], queryFn: () => carregar() });

  const [motor, setMotor] = useState<Motor | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#6f8cff");

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setMotor({
      target_cpa: Number(s.target_cpa),
      roas_scale_threshold: Number(s.roas_scale_threshold),
      roas_reduce_threshold: Number(s.roas_reduce_threshold),
      min_spend_no_conversion: Number(s.min_spend_no_conversion),
      high_frequency_threshold: Number(s.high_frequency_threshold),
      low_ctr_threshold: Number(s.low_ctr_threshold),
      budget_scale_percent: Number(s.budget_scale_percent),
      budget_reduce_percent: Number(s.budget_reduce_percent),
      auto_analysis_enabled: s.auto_analysis_enabled,
      analysis_interval_minutes: s.analysis_interval_minutes,
      decision_ttl_minutes: s.decision_ttl_minutes,
    });
  }, [data?.settings]);

  useEffect(() => {
    if (!data?.workspace) return;
    setNome(data.workspace.name);
    setCor(data.workspace.profile_color);
  }, [data?.workspace]);

  const mutMotor = useMutation({
    mutationFn: (valores: Motor) => gravarMotor({ data: valores }),
    onSuccess: () => {
      toast.success("Parâmetros do motor salvos.");
      void queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutPerfil = useMutation({
    mutationFn: () => gravarPerfil({ data: { name: nome, profile_color: cor, profile_avatar: "user" } }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parâmetros do motor de regras determinístico e identidade do workspace.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Motor de regras</h2>
        {isLoading || !motor ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {campos.map((campo) => (
                <div key={campo.chave} className="space-y-1.5">
                  <Label htmlFor={campo.chave}>{campo.rotulo}</Label>
                  <Input
                    id={campo.chave}
                    type="number"
                    step={campo.passo}
                    value={String(motor[campo.chave] as number)}
                    onChange={(e) =>
                      setMotor({ ...motor, [campo.chave]: Number(e.target.value) } as Motor)
                    }
                  />
                  <p className="text-xs text-muted-foreground">{campo.ajuda}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Análise automática</p>
                <p className="text-xs text-muted-foreground">
                  Executa o motor de regras periodicamente e cria decisões pendentes.
                </p>
              </div>
              <Switch
                checked={motor.auto_analysis_enabled}
                onCheckedChange={(v) => setMotor({ ...motor, auto_analysis_enabled: v })}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => mutMotor.mutate(motor)} disabled={mutMotor.isPending}>
                {mutMotor.isPending ? "Salvando…" : "Salvar parâmetros"}
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Perfil do workspace</h2>
        <div className="mt-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do workspace</Label>
            <Input id="nome" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cor do perfil</Label>
            <div className="flex gap-2">
              {cores.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setCor(c)}
                  className={`size-8 rounded-full border-2 transition ${cor === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => mutPerfil.mutate()} disabled={mutPerfil.isPending}>
              {mutPerfil.isPending ? "Salvando…" : "Salvar perfil"}
            </Button>
          </div>
        </div>
      </section>

      <AcessoMcp />
    </div>
  );
}
