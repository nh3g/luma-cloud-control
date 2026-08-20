import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removerCredenciaisPlataforma, salvarCredenciaisPlataforma } from "@/lib/luma.functions";

type Situacao = { configurada: boolean; origem?: "workspace" | "projeto"; prefixo?: string };

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
  const queryClient = useQueryClient();

  const [aberto, setAberto] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [developerToken, setDeveloperToken] = useState("");

  const google = plataforma === "GOOGLE_ADS";
  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ["integracoes"] });

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
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mRemover = useMutation({
    mutationFn: () => remover({ data: { plataforma } }),
    onSuccess: () => {
      toast.success("Chaves removidas.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const podeSalvar =
    clientId.trim().length >= 4 && clientSecret.trim().length >= 8 && (!google || developerToken.trim().length >= 4);

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
          {situacao?.configurada && situacao.origem === "workspace" && (
            <Button variant="ghost" size="sm" onClick={() => mRemover.mutate()} disabled={mRemover.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${plataforma}-id`}>{google ? "ID do cliente OAuth" : "ID do app (App ID)"}</Label>
            <Input
              id={`${plataforma}-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={google ? "000000000000-xxxx.apps.googleusercontent.com" : "1234567890123456"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${plataforma}-secret`}>
              {google ? "Chave secreta do cliente" : "Chave secreta do app (App Secret)"}
            </Label>
            <Input
              id={`${plataforma}-secret`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
            />
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
              />
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
    </div>
  );
}
