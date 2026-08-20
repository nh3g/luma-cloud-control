CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  lookback_days integer NOT NULL DEFAULT 7,
  campaigns integer NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  source_label text,
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono gerencia import_batches"
ON public.import_batches FOR ALL TO authenticated
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE INDEX import_batches_ws_idx ON public.import_batches (workspace_id, created_at DESC);