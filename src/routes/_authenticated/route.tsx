import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/luma/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Lê a sessão local (sem ida ao servidor) para a troca de página ser instantânea.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AppLayout,
});
