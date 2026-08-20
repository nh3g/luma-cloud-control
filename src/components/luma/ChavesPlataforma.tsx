import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, KeyRound, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removerCredenciaisPlataforma,
  salvarCredenciaisPlataforma,
  testarCredenciaisPlataforma,
} from "@/lib/luma.functions";

type Situacao = { configurada: boolean; origem?: "workspace" | "projeto"; prefixo?: string };

const AJUDA = {
  META: {
    id: {
      rotulo: "ID do app (App ID)",
      dica: "Somente números. Está em developers.facebook.com › seu app › Configurações › Básico.",
      exemplo: "1234567890123456",
      valida: (v: string) => (/^\d{8,20}$/.test(v) ? null : "O App ID da Meta é só de números (8 a 20 dígitos)."),
    },
    segredo: {
      rotulo: "Chave secreta do app (App Secret)",
      dica: "No mesmo lugar do App ID, em “Chave secreta do app”. Tem 32 caracteres.",
      valida: (v: string) =>
        /^[a-f0-9]{32}$/i.test(v) ? null : "A chave secreta da Meta tem 32 caracteres entre letras a–f e números.",
    },
  },
  GOOGLE_ADS: {
    id: {
      rotulo: "ID do cliente OAuth",
      dica: "Google Cloud › APIs e serviços › Credenciais › ID do cliente OAuth (aplicativo do tipo Web).",
      exemplo: "000000000000-xxxx.apps.googleusercontent.com",
      valida: (v: string) =>
        v.endsWith(".apps.googleusercontent.com")
          ? null
          : "O ID do cliente do Google termina em .apps.googleusercontent.com.",
    },
    segredo: {
      rotulo: "Chave secreta do cliente",
      dica: "Na mesma credencial do Google Cloud, campo “Chave secreta do cliente”. Costuma começar com GOCSPX-.",
      valida: (v: string) => (v.length >= 8 ? null : "A chave secreta do cliente parece curta demais."),
    },
  },
} as const;

/** Formulário das chaves do app (Meta / Google Ads) direto na tela de Integrações. */
export function ChavesPlataforma({
  plataforma,
  situacao,
}: {
  plataforma: "META" | "GOOGLE_ADS";
  situacao: Situacao | undefined;
}) {
  const salvar = useServerFn(salvarCredenciaisPlataforma);
  const remover = useServerFn(removerCredenciaisPlataforma);
  const testar = useServerFn(testarCredenciaisPlataforma);
  const queryClient = useQueryClient();

  const [aberto, setAberto] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [developerToken, setDeveloperToken] = useState("");
  const [teste, setTeste] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const google = plataforma === "GOOGLE_ADS";
  const ajuda = AJUDA[plataforma];
  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ["integracoes"] });

  const erroId = clientId.trim() ? ajuda.id.valida(clientId.trim()) : null;
  const erroSegredo = clientSecret.trim() ? ajuda.segredo.valida(clientSecret.trim()) : null;
  const erroDev =
    google && developerToken.trim() && !/^[A-Za-z0-9_-]{10,}$/.test(developerToken.trim())
      ? "O token de desenvolvedor tem pelo menos 10 caracteres, sem espaços."
      : null;

  const mSalvar = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          plataforma,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          ...(google ? { developerToken: developerToken.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Chaves salvas com segurança.");
      setClientId("");
      setClientSecret("");
      setDeveloperToken("");
      setAberto(false);
      setTeste(null);
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mRemover = useMutation({
    mutationFn: () => remover({ data: { plataforma } }),
    onSuccess: () => {
      toast.success("Chaves removidas.");
      setTeste(null);
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mTestar = useMutation({
    mutationFn: () => testar({ data: { plataforma } }),
    onSuccess: (r) => {
      setTeste(r);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    },
    onError: (erro: Error) => setTeste({ ok: false, mensagem: erro.message }),
  });

  const podeSalvar =
    clientId.trim().length >= 4 &&
    clientSecret.trim().length >= 8 &&
    (!google || developerToken.trim().length >= 4) &&
    !erroId &&
    !erroSegredo &&
    !erroDev;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-primary" /> Chaves do app
        </p>
        {situacao?.configurada ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {situacao.origem === "projeto" ? "Configuradas no projeto" : `Cadastradas (${situacao.prefixo}…)`}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Ainda não cadastradas</span>
        )}
      </div>

      {!aberto ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
            {situacao?.configurada ? "Substituir chaves" : "Cadastrar chaves"}
          </Button>
          {situacao?.configurada && (
            <Button variant="outline" size="sm" onClick={() => mTestar.mutate()} disabled={mTestar.isPending}>
              {mTestar.isPending ? "Testando…" : "Testar chaves"}
            </Button>
          )}
          {situacao?.configurada && situacao.origem === "workspace" && (
            <Button variant="ghost" size="sm" onClick={() => mRemover.mutate()} disabled={mRemover.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${plataforma}-id`}>{ajuda.id.rotulo}</Label>
            <Input
              id={`${plataforma}-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={ajuda.id.exemplo}
              autoComplete="off"
              aria-invalid={Boolean(erroId)}
            />
            <p className="text-xs text-muted-foreground">{ajuda.id.dica}</p>
            {erroId && <p className="text-xs text-destructive">{erroId}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${plataforma}-secret`}>{ajuda.segredo.rotulo}</Label>
            <Input
              id={`${plataforma}-secret`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
              aria-invalid={Boolean(erroSegredo)}
            />
            <p className="text-xs text-muted-foreground">{ajuda.segredo.dica}</p>
            {erroSegredo && <p className="text-xs text-destructive">{erroSegredo}</p>}
          </div>
          {google && (
            <div className="space-y-1">
              <Label htmlFor={`${plataforma}-dev`}>Token de desenvolvedor</Label>
              <Input
                id={`${plataforma}-dev`}
                type="password"
                value={developerToken}
                onChange={(e) => setDeveloperToken(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(erroDev)}
              />
              <p className="text-xs text-muted-foreground">
                Google Ads › Ferramentas › Central de API. Precisa estar aprovado para uso em produção.
              </p>
              {erroDev && <p className="text-xs text-destructive">{erroDev}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            As chaves ficam guardadas no servidor e nunca voltam para o navegador — a tela mostra apenas se estão
            cadastradas.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mSalvar.mutate()} disabled={!podeSalvar || mSalvar.isPending}>
              {mSalvar.isPending ? "Salvando…" : "Salvar chaves"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {teste && (
        <p className={`flex items-start gap-2 text-xs ${teste.ok ? "text-primary" : "text-destructive"}`} role="status">
          {teste.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {teste.mensagem}
        </p>
      )}
    </div>
  );
}
