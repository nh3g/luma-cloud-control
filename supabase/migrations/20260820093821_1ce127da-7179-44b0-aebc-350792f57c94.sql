ALTER TABLE public.companion_devices ADD COLUMN IF NOT EXISTS pairing_expires_at timestamptz;
ALTER TABLE public.browser_agent_approvals ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.browser_agent_runs ADD COLUMN IF NOT EXISTS max_steps integer NOT NULL DEFAULT 14;
ALTER TABLE public.browser_agent_runs ADD COLUMN IF NOT EXISTS complexity text NOT NULL DEFAULT 'STANDARD';

CREATE UNIQUE INDEX IF NOT EXISTS companion_devices_token_hash_key ON public.companion_devices (device_token_hash) WHERE device_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companion_devices_pairing_hash_key ON public.companion_devices (pairing_code_hash) WHERE pairing_code_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mcp_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Chave MCP',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_keys TO authenticated;
GRANT ALL ON public.mcp_keys TO service_role;
ALTER TABLE public.mcp_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia mcp_keys" ON public.mcp_keys FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));