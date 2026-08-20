import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { obterConfigIa, salvarModeloIa, testarModeloIa } from "@/lib/luma.functions";

/** Escolha do modelo de IA usado pela estrategista e pela coleta por navegador. */
export function ModeloIa() {
  const carregar = useServerFn(obterConfigIa);
  const salvar = useServerFn(salvarModeloIa);
  const testar = useServerFn(testarModeloIa);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["config-ia"], queryFn: () => carregar() });
  const [modelo, setModelo] = useState("");

  useEffect(() => {
    if (data?.modelo) setModelo(data.modelo);
  }, [data?.modelo]);

  const mSalvar = useMutation({
    mutationFn: () => salvar({ data: { modelo } }),
    onSuccess: () => {
      toast.success("Modelo de IA atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["config-ia"] });
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const mTestar = useMutation({
    mutationFn: () => testar({ data: { modelo } }),
    onSuccess: (r) => (r.ok ? toast.success(r.mensagem) : toast.error(r.mensagem)),
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> Inteligência artificial
        </h2>
        <p className="text-sm text-muted-foreground">
          A LUMA usa a sua chave da OpenAI para a estrategista e para conduzir o navegador que lê os painéis de anúncios.
        </p>
        {data && !data.configurada && (
          <p className="mt-2 text-xs text-amber-400">A chave da OpenAI ainda não está configurada neste projeto.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="modelo-ia">Modelo</Label>
          <Select value={modelo} onValueChange={setModelo}>
            <SelectTrigger id="modelo-ia">
              <SelectValue placeholder="Escolha o modelo" />
            </SelectTrigger>
            <SelectContent>
              {(data?.modelos ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => mSalvar.mutate()} disabled={!modelo || mSalvar.isPending}>
          Salvar modelo
        </Button>
        <Button variant="outline" onClick={() => mTestar.mutate()} disabled={!modelo || mTestar.isPending}>
          {mTestar.isPending ? "Testando…" : "Testar IA"}
        </Button>
      </div>
    </section>
  );
}
