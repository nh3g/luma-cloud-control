import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarDataHora, formatarRelativo } from "@/lib/luma/format";
import { gerarChaveMcp, listarChavesMcp, revogarChaveMcp } from "@/lib/luma.functions";
import { ConfirmarAcao } from "@/components/luma/ConfirmarAcao";


/** Bloco de acesso MCP: chaves para agentes externos (Claude, ChatGPT, Cursor). */
export function AcessoMcp() {
  const listar = useServerFn(listarChavesMcp);
  const gerar = useServerFn(gerarChaveMcp);
  const revogar = useServerFn(revogarChaveMcp);
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [chaveNova, setChaveNova] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["chaves-mcp"], queryFn: () => listar() });
  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ["chaves-mcp"] });

  const mGerar = useMutation({
    mutationFn: () => gerar({ data: { label: nome.trim() || "Agente externo" } }),
    onSuccess: (r) => {
      setChaveNova(r.chave);
      setNome("");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mRevogar = useMutation({
    mutationFn: (id: string) => revogar({ data: { id } }),
    onSuccess: () => {
      toast.success("Chave revogada.");
      invalidar();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const endereco =
    typeof window === "undefined" ? "/api/public/mcp" : `${window.location.origin}/api/public/mcp`;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <KeyRound className="h-4 w-4 text-primary" /> Acesso para agentes externos (MCP)
        </h2>
        <p className="text-sm text-muted-foreground">
          Conecte assistentes como Claude, ChatGPT ou Cursor à LUMA. Eles podem ler métricas e propor ações — nenhuma
          alteração chega às contas de anúncio sem a sua aprovação no painel.
        </p>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <p className="text-xs text-muted-foreground">Endereço do servidor</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="truncate font-mono text-xs">{endereco}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(endereco);
              toast.success("Endereço copiado.");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da chave (ex.: Claude)" />
        <Button variant="outline" onClick={() => mGerar.mutate()} disabled={mGerar.isPending}>
          Gerar chave
        </Button>
      </div>

      {chaveNova && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
          <p className="text-sm font-medium">Copie agora — a chave não será exibida de novo.</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate font-mono text-xs">{chaveNova}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(chaveNova);
                toast.success("Chave copiada.");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {(data?.chaves.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma chave ativa.</p>
      ) : (
        <ul className="space-y-2">
          {data?.chaves.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="text-sm">
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  Criada em {formatarDataHora(c.created_at)} · último uso {formatarRelativo(c.last_used_at)}
                </p>
              </div>
              <ConfirmarAcao
                titulo={`Revogar a chave "${c.label}"?`}
                descricao="O agente externo que usa esta chave perde o acesso imediatamente. Essa ação não pode ser desfeita."
                rotuloConfirmar="Revogar chave"
                aoConfirmar={() => mRevogar.mutate(c.id)}
              >
                {(abrir) => (
                  <Button variant="ghost" size="sm" onClick={abrir} aria-label="Revogar chave">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </ConfirmarAcao>

            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
