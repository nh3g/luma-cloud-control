import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Brain,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Megaphone,
  NotebookPen,
  Plug,
  Settings,
  Stethoscope,
  User,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  listarAgente,
  listarCampanhas,
  listarDecisoes,
  listarIntegracoes,
  listarNotas,
  obterConfiguracoes,
  obterDiagnostico,
  obterVisaoGeral,
} from "@/lib/luma.functions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { AgentStoppedBanner, StopAgentButton } from "./StopAgentButton";

const NAV = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/decisoes", label: "Decisões", icon: ClipboardCheck },
  { to: "/estrategista", label: "Estrategista", icon: Brain },
  { to: "/agente-navegador", label: "Agente de Navegador", icon: Bot },
  { to: "/integracoes", label: "Integrações", icon: Plug },
  { to: "/notas", label: "Notas", icon: NotebookPen },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/diagnostico", label: "Diagnóstico", icon: Stethoscope },
] as const;

/** Dados de cada página, para adiantar a busca assim que o mouse encosta no menu. */
const PRE_CARGA: Record<string, { chave: string; buscar: () => Promise<unknown> }> = {
  "/": { chave: "visao-geral", buscar: () => obterVisaoGeral() },
  "/campanhas": { chave: "campanhas", buscar: () => listarCampanhas() },
  "/decisoes": { chave: "decisoes", buscar: () => listarDecisoes() },
  "/agente-navegador": { chave: "agente", buscar: () => listarAgente() },
  "/integracoes": { chave: "integracoes", buscar: () => listarIntegracoes() },
  "/notas": { chave: "notas", buscar: () => listarNotas() },
  "/configuracoes": { chave: "configuracoes", buscar: () => obterConfiguracoes() },
  "/diagnostico": { chave: "diagnostico", buscar: () => obterDiagnostico() },
};

export function AppLayout() {
  const queryClient = useQueryClient();
  const { data: workspace, isLoading } = useWorkspace();
  const navigate = useNavigate();

  const adiantar = (destino: string) => {
    const alvo = PRE_CARGA[destino];
    if (!alvo) return;
    void queryClient.prefetchQuery({ queryKey: [alvo.chave], queryFn: alvo.buscar, staleTime: 60_000 });
  };

  const sair = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="text-lg font-bold tracking-[0.2em] text-primary">LUMA</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            v3
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              preload="intent"
              onMouseEnter={() => adiantar(to)}
              onFocus={() => adiantar(to)}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary",
              }}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void sair()}
          className="m-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </aside>

      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            {workspace?.demo_mode && (
              <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                Demo
              </span>
            )}
            <span className="text-sm font-medium text-foreground">
              {isLoading ? "Carregando…" : (workspace?.name ?? "Workspace")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {workspace && <StopAgentButton workspace={workspace} />}
            <span
              className="flex size-8 items-center justify-center rounded-full text-background"
              style={{ backgroundColor: workspace?.profile_color ?? "#6f8cff" }}
            >
              <User className="size-4" />
            </span>
          </div>
        </header>

        {workspace && <AgentStoppedBanner workspace={workspace} />}

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
