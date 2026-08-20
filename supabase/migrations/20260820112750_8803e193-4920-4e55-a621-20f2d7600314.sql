ALTER TABLE public.browser_collections
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_id text;

ALTER TABLE public.browser_collection_runs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'COLLECT',
  ADD COLUMN IF NOT EXISTS session_id text;

ALTER TABLE public.browser_collection_runs
  DROP CONSTRAINT IF EXISTS browser_collection_runs_kind_check;
ALTER TABLE public.browser_collection_runs
  ADD CONSTRAINT browser_collection_runs_kind_check CHECK (kind IN ('LOGIN','COLLECT'));