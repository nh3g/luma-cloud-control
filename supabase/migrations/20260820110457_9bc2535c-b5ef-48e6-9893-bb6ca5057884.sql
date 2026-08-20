CREATE TABLE public.service_credentials (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service text NOT NULL,
  api_key text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, service)
);
GRANT ALL ON public.service_credentials TO service_role;
ALTER TABLE public.service_credentials ENABLE ROW LEVEL SECURITY;