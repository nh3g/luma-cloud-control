CREATE TYPE public.collection_mode AS ENUM ('DEMO','API','BROWSER');
CREATE TYPE public.browser_run_status AS ENUM ('RUNNING','FINISHED','FAILED','STOPPED');

ALTER TABLE public.workspaces ADD COLUMN ai_model text NOT NULL DEFAULT 'gpt-4.1';

CREATE TABLE public.browser_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  mode public.collection_mode NOT NULL DEFAULT 'DEMO',
  external_account_id text,
  lookback_days integer NOT NULL DEFAULT 7 CHECK (lookback_days IN (7,14,30)),
  profile_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform)
);

CREATE TABLE public.browser_collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  task_id text NOT NULL,
  status public.browser_run_status NOT NULL DEFAULT 'RUNNING',
  step text,
  live_url text,
  error text,
  campaigns integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX browser_collection_runs_ws_idx ON public.browser_collection_runs (workspace_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_collections TO authenticated;
GRANT ALL ON public.browser_collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_collection_runs TO authenticated;
GRANT ALL ON public.browser_collection_runs TO service_role;

ALTER TABLE public.browser_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_collection_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono gerencia configuracoes de coleta" ON public.browser_collections
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Dono gerencia execucoes de coleta" ON public.browser_collection_runs
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));