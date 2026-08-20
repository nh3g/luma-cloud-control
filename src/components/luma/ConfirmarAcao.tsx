import { useState } from "react";

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

/**
 * Envolve uma ação irreversível: o gatilho abre uma confirmação antes de executar.
 * Uso: <ConfirmarAcao titulo="…" descricao="…" aoConfirmar={fn}>{(abrir) => <Button onClick={abrir}/>}</ConfirmarAcao>
 */
export function ConfirmarAcao({
  titulo,
  descricao,
  rotuloConfirmar = "Confirmar",
  destrutivo = true,
  aoConfirmar,
  children,
}: {
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => void;
  children: (abrir: () => void) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {children(() => setAberto(true))}
      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>{descricao}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={destrutivo ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                setAberto(false);
                aoConfirmar();
              }}
            >
              {rotuloConfirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
