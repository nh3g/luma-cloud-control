CREATE TABLE public.integration_tokens (
  integration_id uuid PRIMARY KEY REFERENCES public.integrations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.integration_tokens TO service_role;

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: tokens ficam inacessíveis ao navegador; apenas o servidor confiável lê.

CREATE INDEX idx_integration_tokens_workspace ON public.integration_tokens(workspace_id);

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS last_auto_run_at timestamptz;