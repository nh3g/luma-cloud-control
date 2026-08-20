import { Construction } from "lucide-react";

type Props = {
  titulo: string;
  descricao: string;
  fase: string;
};

export function NotImplemented({ titulo, descricao, fase }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-warning">
          NOT_IMPLEMENTED
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Construction className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-primary">
              Previsto para a {fase}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
