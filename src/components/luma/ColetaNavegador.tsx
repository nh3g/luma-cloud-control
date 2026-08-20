import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, CheckCircle2, ExternalLink, LogIn, Play, Square, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChaveNavegador } from "@/components/luma/ChaveNavegador";
import { formatarDataHora } from "@/lib/luma/format";
import {
  acompanharColetaNavegador,
  conectarContaNavegador,
  desconectarContaNavegador,
  iniciarColetaNavegador,
  obterColetaNavegador,
  pararColetaNavegador,
  salvarColetaNavegador,
} from "@/lib/luma.functions";


type Plataforma = "META" | "GOOGLE_ADS";

const titulos: Record<Plataforma, string> = { META: "Meta Ads", GOOGLE_ADS: "Google Ads" };

const rotuloModo: Record<string, string> = {
  DEMO: "Demonstração (números simulados)",
  API: "API oficial (token conectado)",
  BROWSER: "Navegador na nuvem (pago por sessão)",
  IMPORT: "Importar relatório exportado (grátis)",
};

const rotuloStatus: Record<string, string> = {
  RUNNING: "Em andamento",
  FINISHED: "Concluída",
  FAILED: "Falhou",
  STOPPED: "Interrompida",
};

/** Configuração e acompanhamento da coleta de métricas por navegador. */
export function ColetaNavegador() {
  const carregar = useServerFn(obterColetaNavegador);
  const salvar = useServerFn(salvarColetaNavegador);
  const iniciar = useServerFn(iniciarColetaNavegador);
  const acompanhar = useServerFn(acompanharColetaNavegador);
  const parar = useServerFn(pararColetaNavegador);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["coleta-navegador"], queryFn: () => carregar() });
  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["coleta-navegador"] });
    void queryClient.invalidateQueries({ queryKey: ["campanhas"] });
    void queryClient.invalidateQueries({ queryKey: ["visao-geral"] });
    void queryClient.invalidateQueries({ queryKey: ["integracoes"] });
  };

  const [rascunho, setRascunho] = useState<Record<string, { modo: string; conta: string; dias: number }>>({});

  const configuracoes = useMemo(() => {
    const mapa: Record<string, { modo: string; conta: string; dias: number }> = {
      META: { modo: "DEMO", conta: "", dias: 7 },
      GOOGLE_ADS: { modo: "DEMO", conta: "", dias: 7 },
    };
    for (const c of data?.configuracoes ?? []) {
      mapa[c.platform] = { modo: c.mode, conta: c.external_account_id ?? "", dias: c.lookback_days };
    }
    return mapa;
  }, [data]);

  const valor = (p: Plataforma) => rascunho[p] ?? configuracoes[p] ?? { modo: "DEMO", conta: "", dias: 7 };
  const alterar = (p: Plataforma, campo: "modo" | "conta" | "dias", v: string | number) =>
    setRascunho((atual) => ({ ...atual, [p]: { ...valor(p), [campo]: v } }));

  const mSalvar = useMutation({
    mutationFn: (p: Plataforma) =>
      salvar({
        data: {
          plataforma: p,
          modo: valor(p).modo as "DEMO" | "API" | "BROWSER" | "IMPORT",
          conta: valor(p).conta,
          dias: valor(p).dias as 7 | 14 | 30,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração de coleta salva.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  // Salva a configuração atual antes de disparar, para não depender do botão "Salvar".
  const mIniciar = useMutation({
    mutationFn: async (p: Plataforma) => {
      const atual = valor(p);
      await salvar({
        data: {
          plataforma: p,
          modo: atual.modo as "DEMO" | "API" | "BROWSER" | "IMPORT",
          conta: atual.conta,
          dias: atual.dias as 7 | 14 | 30,
        },
      });
      return iniciar({ data: { plataforma: p } });
    },
    onSuccess: () => {
      toast.success("Coleta iniciada. Acompanhe a sessão ao vivo para entrar na conta, se for pedido.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mParar = useMutation({
    mutationFn: (id: string) => parar({ data: { id } }),
    onSuccess: () => {
      toast.success("Coleta interrompida.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });


  const emAndamento = (data?.execucoes ?? []).filter((e) => e.status === "RUNNING");

  // Enquanto houver coleta rodando, consulta a nuvem a cada 6 segundos.
  useEffect(() => {
    if (emAndamento.length === 0) return;
    const timer = setInterval(() => {
      void Promise.all(emAndamento.map((e) => acompanhar({ data: { id: e.id } }))).then(invalidar).catch(() => undefined);
    }, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emAndamento.map((e) => e.id).join(",")]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Bot className="h-4 w-4 text-primary" /> Coleta por navegador
        </h2>
        <p className="text-sm text-muted-foreground">
          Sem API oficial? Um navegador na nuvem abre o painel de anúncios, lê as métricas do período e traz os números
          para a LUMA. A coleta é somente leitura — nenhuma campanha é alterada. No primeiro uso você entra na conta pela
          sessão ao vivo e o login fica salvo.
        </p>
        {data && !data.servicoConfigurado && (
          <p className="mt-2 text-xs text-amber-400">
            Cadastre a chave do serviço de navegador abaixo para liberar a coleta.
          </p>
        )}
      </div>

      <ChaveNavegador situacao={data?.chaveServico} />


      <div className="grid gap-4 lg:grid-cols-2">
        {(["META", "GOOGLE_ADS"] as Plataforma[]).map((p) => {
          const atual = valor(p);
          const rodando = emAndamento.find((e) => e.platform === p);
          return (
            <article key={p} className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="font-medium">{titulos[p]}</h3>

              <div className="space-y-1">
                <Label htmlFor={`modo-${p}`}>Origem dos dados</Label>
                <Select value={atual.modo} onValueChange={(v) => alterar(p, "modo", v)}>
                  <SelectTrigger id={`modo-${p}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(rotuloModo).map(([id, rotulo]) => (
                      <SelectItem key={id} value={id}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`conta-${p}`}>Conta (opcional)</Label>
                  <Input
                    id={`conta-${p}`}
                    value={atual.conta}
                    placeholder={p === "META" ? "Ex.: Loja Verão ou 123456789" : "Ex.: Loja Verão ou 123-456-7890"}
                    onChange={(e) => alterar(p, "conta", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`dias-${p}`}>Período</Label>
                  <Select value={String(atual.dias)} onValueChange={(v) => alterar(p, "dias", Number(v))}>
                    <SelectTrigger id={`dias-${p}`}>
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

              <p className="text-xs text-amber-400">
                Cada coleta por navegador consome créditos pagos do serviço Browser Use. Para não gastar, use a
                importação de relatório acima ou a API oficial.
              </p>

              <p className="text-xs text-muted-foreground">
                O navegador usa a conta em que você já está logado. Preencha só se o seu login tiver várias contas de
                anúncio e você quiser fixar uma — pode ser o nome ou o número da conta.
              </p>


              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => mSalvar.mutate(p)} disabled={mSalvar.isPending}>
                  Salvar configuração
                </Button>
                {rodando ? (
                  <Button size="sm" variant="ghost" onClick={() => mParar.mutate(rodando.id)} disabled={mParar.isPending}>
                    <Square className="mr-2 h-4 w-4" /> Interromper
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (atual.modo !== "BROWSER") {
                        toast.error('Escolha a origem "Navegador na nuvem" para coletar por navegador.');
                        return;
                      }
                      mIniciar.mutate(p);
                    }}
                    disabled={mIniciar.isPending || !data?.servicoConfigurado}
                  >
                    <Play className="mr-2 h-4 w-4" /> Coletar agora
                  </Button>
                )}
              </div>

              {!data?.servicoConfigurado && (
                <p className="text-xs text-muted-foreground">
                  A coleta fica disponível assim que a chave do serviço de navegador for cadastrada acima.
                </p>
              )}


              {rodando && (
                <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                  <p className="font-medium">Coleta em andamento…</p>
                  {rodando.step && <p className="text-muted-foreground">Etapa: {rodando.step}</p>}
                  {rodando.live_url && (
                    <a
                      className="mt-1 inline-flex items-center gap-1 text-primary underline"
                      href={rodando.live_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir sessão ao vivo <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {(data?.execucoes.length ?? 0) > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Últimas coletas por navegador</h3>
          <ul className="divide-y divide-border text-sm">
            {data?.execucoes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className="font-medium">{titulos[e.platform as Plataforma] ?? e.platform}</strong>{" "}
                  <span className="text-muted-foreground">{rotuloStatus[e.status] ?? e.status}</span>
                </span>
                <span className="text-muted-foreground">
                  {e.error ?? `${e.campaigns} campanhas`}
                </span>
                <span className="text-muted-foreground">{formatarDataHora(e.started_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
