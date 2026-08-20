import { createFileRoute } from "@tanstack/react-router";

/** Retorno do OAuth de Meta Ads e Google Ads. Guarda o token fora do alcance do navegador. */
export const Route = createFileRoute("/api/public/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const destino = `${url.origin}/integracoes`;
        if (!code || !state) return Response.redirect(`${destino}?erro=retorno_invalido`, 302);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pedido } = await supabaseAdmin
          .from("oauth_states")
          .select("*")
          .eq("state", state)
          .maybeSingle();
        if (!pedido) return Response.redirect(`${destino}?erro=estado_desconhecido`, 302);
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        const redirect = `${url.origin}/api/public/oauth/callback`;
        const { obterCredenciais } = await import("@/lib/luma/credenciais.server");
        const credenciais = await obterCredenciais(
          supabaseAdmin,
          pedido.workspace_id,
          pedido.platform as "META" | "GOOGLE_ADS",
        );
        if (!credenciais) return Response.redirect(`${destino}?erro=chaves_nao_cadastradas`, 302);
        try {
          let accessToken = "";
          let refreshToken: string | null = null;
          let expiraEm: number | null = null;
          let contaId = "";
          let nome = "";

          if (pedido.platform === "META") {
            const troca = await fetch(
              `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${credenciais.clientId}` +
                `&client_secret=${credenciais.clientSecret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`,
            );
            const corpo = (await troca.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
            if (!corpo.access_token) throw new Error(corpo.error?.message ?? "Falha ao trocar o código pelo token.");
            accessToken = corpo.access_token;
            expiraEm = corpo.expires_in ?? null;
            const contas = await fetch(
              `https://graph.facebook.com/v20.0/me/adaccounts?fields=account_id,name&access_token=${accessToken}`,
            );
            const lista = (await contas.json()) as { data?: { account_id: string; name: string }[] };
            const primeira = lista.data?.[0];
            contaId = primeira ? `act_${primeira.account_id}` : "";
            nome = primeira?.name ?? "Meta Ads";
          } else {
            const troca = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                code,
                client_id: credenciais.clientId,
                client_secret: credenciais.clientSecret,
                redirect_uri: redirect,
                grant_type: "authorization_code",
              }),
            });
            const corpo = (await troca.json()) as {
              access_token?: string;
              refresh_token?: string;
              expires_in?: number;
              error_description?: string;
            };
            if (!corpo.access_token) throw new Error(corpo.error_description ?? "Falha ao trocar o código pelo token.");
            accessToken = corpo.access_token;
            refreshToken = corpo.refresh_token ?? null;
            expiraEm = corpo.expires_in ?? null;
            nome = "Google Ads";
          }

          const { data: integracao, error } = await supabaseAdmin
            .from("integrations")
            .upsert(
              {
                workspace_id: pedido.workspace_id,
                platform: pedido.platform,
                account_id: contaId,
                name: nome,
                status: "CONNECTED" as const,
                expires_at: expiraEm ? new Date(Date.now() + expiraEm * 1000).toISOString() : null,
                metadata_json: { demo: false },
              },
              { onConflict: "workspace_id,platform,account_id" },
            )
            .select("id")
            .single();
          if (error || !integracao) throw new Error(error?.message ?? "Não foi possível salvar a integração.");

          await supabaseAdmin.from("integration_tokens").upsert({
            integration_id: integracao.id,
            workspace_id: pedido.workspace_id,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiraEm ? new Date(Date.now() + expiraEm * 1000).toISOString() : null,
            updated_at: new Date().toISOString(),
          });

          return Response.redirect(`${destino}?conectado=${pedido.platform}`, 302);
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "falha_desconhecida";
          return Response.redirect(`${destino}?erro=${encodeURIComponent(mensagem)}`, 302);
        }
      },
    },
  },
});
