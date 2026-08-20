import { useState } from "react";
import { OctagonX } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSetAgentStopped, type Workspace } from "@/hooks/useWorkspace";

export function StopAgentButton({ workspace }: { workspace: Workspace }) {
  const [aberto, setAberto] = useState(false);
  const { mutate, isPending } = useSetAgentStopped();

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={workspace.agent_stopped || isPending}
        className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <OctagonX className="size-4" />
        Parar agente
      </button>

      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar o agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhuma sincronização, análise ou execução será realizada até você reativar
              manualmente. Decisões pendentes continuam salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                mutate(
                  { id: workspace.id, stopped: true },
                  {
                    onSuccess: () => toast.warning("Agente parado."),
                    onError: () => toast.error("Não foi possível parar o agente."),
                  },
                )
              }
            >
              Parar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AgentStoppedBanner({ workspace }: { workspace: Workspace }) {
  const { mutate, isPending } = useSetAgentStopped();

  if (!workspace.agent_stopped) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/40 bg-destructive/10 px-6 py-2.5">
      <p className="text-sm font-medium text-destructive">
        Agente parado — nenhuma automação será executada.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          mutate(
            { id: workspace.id, stopped: false },
            {
              onSuccess: () => toast.success("Agente reativado."),
              onError: () => toast.error("Não foi possível reativar o agente."),
            },
          )
        }
        className="rounded-md border border-destructive/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
      >
        Reativar agente
      </button>
    </div>
  );
}
