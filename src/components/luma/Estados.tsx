import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Mensagem amigável em PT-BR para erros técnicos vindos do servidor. */
export function mensagemAmigavel(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro ?? "");
  const texto = bruto.toLowerCase();
  if (!bruto) return "Não foi possível carregar os dados agora.";
  if (texto.includes("failed to fetch") || texto.includes("networkerror") || texto.includes("network"))
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  if (texto.includes("unauthorized") || texto.includes("401") || texto.includes("jwt"))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (texto.includes("timeout") || texto.includes("timed out"))
    return "O servidor demorou para responder. Tente novamente em instantes.";
  if (texto.includes("workspace"))
    return "Não encontramos seu workspace. Recarregue a página e tente de novo.";
  return bruto;
}

/** Bloco padrão de erro com botão de nova tentativa. */
export function ErroTela({
  erro,
  aoTentarNovamente,
  titulo = "Não foi possível carregar",
}: {
  erro: unknown;
  aoTentarNovamente?: () => void;
  titulo?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-6">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4" /> {titulo}
      </p>
      <p className="text-sm text-muted-foreground">{mensagemAmigavel(erro)}</p>
      {aoTentarNovamente ? (
        <Button size="sm" variant="outline" onClick={aoTentarNovamente}>
          <RefreshCw className="mr-1 size-4" /> Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/** Bloco padrão de estado vazio. */
export function VazioTela({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="font-medium">{titulo}</p>
      {descricao ? <p className="max-w-md text-sm text-muted-foreground">{descricao}</p> : null}
      {acao}
    </div>
  );
}
