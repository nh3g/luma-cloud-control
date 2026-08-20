import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removerChaveNavegador, salvarChaveNavegador } from "@/lib/luma.functions";

type Situacao = { configurada: boolean; origem?: "workspace" | "projeto"; prefixo?: string };

/** Cadastro e troca da chave do serviço de navegador (Browser Use). */
export function ChaveNavegador({ situacao }: { situacao: Situacao | undefined }) {
  const salvar = useServerFn(salvarChaveNavegador);
  const remover = useServerFn(removerChaveNavegador);
  const queryClient = useQueryClient();

  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState("");

  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ["coleta-navegador"] });

  const mSalvar = useMutation({
    mutationFn: () => salvar({ data: { chave: chave.trim() } }),
    onSuccess: () => {
      toast.success("Chave do navegador salva.");
      setChave("");
      setAberto(false);
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mRemover = useMutation({
    mutationFn: () => remover({ data: undefined }),
    onSuccess: () => {
      toast.success("Chave removida.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-primary" /> Chave do serviço de navegador
        </p>
        {situacao?.configurada ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {situacao.origem === "projeto" ? "Usando a chave do projeto" : `Cadastrada (${situacao.prefixo}…)`}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Ainda não cadastrada</span>
        )}
      </div>

      {aberto ? (
        <div className="space-y-2">
          <Label htmlFor="chave-navegador">Chave da API (Browser Use)</Label>
          <Input
            id="chave-navegador"
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="bu_..."
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Pegue em cloud.browser-use.com › Settings › API keys. A chave fica guardada só no servidor e pode ser
            trocada quando você quiser.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => mSalvar.mutate()} disabled={chave.trim().length < 10 || mSalvar.isPending}>
              Salvar chave
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAberto(false);
                setChave("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
            {situacao?.origem === "workspace" ? "Trocar chave" : "Cadastrar chave"}
          </Button>
          {situacao?.origem === "workspace" && (
            <Button size="sm" variant="ghost" onClick={() => mRemover.mutate()} disabled={mRemover.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
