CREATE TABLE public.platform_credentials (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  developer_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, platform)
);

GRANT ALL ON public.platform_credentials TO service_role;
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
-- Sem policies de propósito: nem o navegador nem o usuário autenticado leem estas chaves.
-- O acesso acontece apenas no servidor, pela chave de serviço.