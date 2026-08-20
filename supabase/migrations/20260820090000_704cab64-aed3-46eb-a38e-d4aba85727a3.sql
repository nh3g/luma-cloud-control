-- ============ ENUMS ============
CREATE TYPE public.platform AS ENUM ('META','GOOGLE_ADS','GA4');
CREATE TYPE public.integration_status AS ENUM ('DISCONNECTED','CONNECTED','EXPIRED','ERROR');
CREATE TYPE public.decision_action_type AS ENUM ('PAUSE_CAMPAIGN','RESUME_CAMPAIGN','INCREASE_BUDGET','DECREASE_BUDGET','ROTATE_CREATIVE');
CREATE TYPE public.decision_status AS ENUM ('PENDING','APPROVED','REJECTED','EXECUTED','FAILED','EXPIRED');
CREATE TYPE public.decision_source AS ENUM ('RULE_ENGINE','AI','MCP','MANUAL');
CREATE TYPE public.risk_level AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TYPE public.execution_channel AS ENUM ('API','BROWSER','SIMULATED');
CREATE TYPE public.sync_status AS ENUM ('RUNNING','SUCCESS','PARTIAL','FAILED');
CREATE TYPE public.browser_agent_mode AS ENUM ('ANALYZE','APPROVAL','PRIME');
CREATE TYPE public.browser_agent_run_status AS ENUM ('STARTING','RUNNING','WAITING_APPROVAL','COMPLETED','PARTIAL','BLOCKED','NEEDS_INPUT','MODE_MISMATCH','FAILED','STOPPED');
CREATE TYPE public.browser_approval_status AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED');
CREATE TYPE public.companion_status AS ENUM ('OFFLINE','ONLINE','BUSY','STOPPED','ERROR');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = auth.uid());
$$;

-- ============ ENGINE SETTINGS ============
CREATE TABLE public.engine_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_cpa numeric(12,2) NOT NULL DEFAULT 40,
  roas_scale_threshold numeric(8,2) NOT NULL DEFAULT 3,
  roas_reduce_threshold numeric(8,2) NOT NULL DEFAULT 1.3,
  min_spend_no_conversion numeric(12,2) NOT NULL DEFAULT 100,
  high_frequency_threshold numeric(6,2) NOT NULL DEFAULT 4,
  low_ctr_threshold numeric(6,2) NOT NULL DEFAULT 0.8,
  budget_scale_percent numeric(5,2) NOT NULL DEFAULT 15,
  budget_reduce_percent numeric(5,2) NOT NULL DEFAULT 20,
  auto_analysis_enabled boolean NOT NULL DEFAULT true,
  analysis_interval_minutes integer NOT NULL DEFAULT 120,
  decision_ttl_minutes integer NOT NULL DEFAULT 1440,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_settings TO authenticated;
GRANT ALL ON public.engine_settings TO service_role;
ALTER TABLE public.engine_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia engine_settings" ON public.engine_settings FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE TRIGGER engine_settings_set_updated_at BEFORE UPDATE ON public.engine_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_engine_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.analysis_interval_minutes < 15 THEN NEW.analysis_interval_minutes := 15; END IF;
  IF NEW.decision_ttl_minutes < 15 THEN NEW.decision_ttl_minutes := 15; END IF;
  IF NEW.target_cpa < 0 OR NEW.roas_scale_threshold < 0 OR NEW.roas_reduce_threshold < 0
     OR NEW.min_spend_no_conversion < 0 OR NEW.high_frequency_threshold < 0 OR NEW.low_ctr_threshold < 0 THEN
    RAISE EXCEPTION 'Parâmetros do motor não podem ser negativos';
  END IF;
  IF NEW.budget_scale_percent < 0 OR NEW.budget_scale_percent > 100
     OR NEW.budget_reduce_percent < 0 OR NEW.budget_reduce_percent > 100 THEN
    RAISE EXCEPTION 'Percentuais de orçamento devem ficar entre 0 e 100';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER engine_settings_validate BEFORE INSERT OR UPDATE ON public.engine_settings FOR EACH ROW EXECUTE FUNCTION public.validate_engine_settings();

-- ============ APP CREDENTIALS ============
CREATE TABLE public.app_credentials (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  vault_secret_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_credentials TO authenticated;
GRANT ALL ON public.app_credentials TO service_role;
ALTER TABLE public.app_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia app_credentials" ON public.app_credentials FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE TRIGGER app_credentials_set_updated_at BEFORE UPDATE ON public.app_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INTEGRATIONS ============
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  account_id text,
  name text,
  status public.integration_status NOT NULL DEFAULT 'DISCONNECTED',
  access_token_vault_id text,
  refresh_token_vault_id text,
  expires_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia integrations" ON public.integrations FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ OAUTH STATES ============
CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.oauth_states TO authenticated;
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia oauth_states" ON public.oauth_states FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ SYNC RUNS ============
CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  status public.sync_status NOT NULL,
  message text,
  accounts integer NOT NULL DEFAULT 0,
  campaigns integer NOT NULL DEFAULT 0,
  failed_accounts integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX sync_runs_ws_platform_idx ON public.sync_runs (workspace_id, platform, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia sync_runs" ON public.sync_runs FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ CAMPAIGNS ============
CREATE TABLE public.campaigns (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  account_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  objective text,
  budget_daily numeric(12,2) NOT NULL DEFAULT 0,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  ctr numeric(8,4) NOT NULL DEFAULT 0,
  cpc numeric(12,4) NOT NULL DEFAULT 0,
  cpm numeric(12,4) NOT NULL DEFAULT 0,
  cpa numeric(12,2) NOT NULL DEFAULT 0,
  roas numeric(10,4) NOT NULL DEFAULT 0,
  frequency numeric(8,4) NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_ws_platform_account_idx ON public.campaigns (workspace_id, platform, account_id);
CREATE INDEX campaigns_ws_status_spend_idx ON public.campaigns (workspace_id, status, spend DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ METRIC SNAPSHOTS ============
CREATE TABLE public.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id text NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  spend numeric(14,2) NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions numeric(12,2) NOT NULL DEFAULT 0,
  ctr numeric(8,4) NOT NULL DEFAULT 0,
  cpc numeric(12,4) NOT NULL DEFAULT 0,
  cpm numeric(12,4) NOT NULL DEFAULT 0,
  cpa numeric(12,2) NOT NULL DEFAULT 0,
  roas numeric(10,4) NOT NULL DEFAULT 0,
  frequency numeric(8,4) NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX metric_snapshots_campaign_idx ON public.metric_snapshots (campaign_id, captured_at);
CREATE INDEX metric_snapshots_ws_idx ON public.metric_snapshots (workspace_id, captured_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_snapshots TO authenticated;
GRANT ALL ON public.metric_snapshots TO service_role;
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia metric_snapshots" ON public.metric_snapshots FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ DECISIONS ============
CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  account_id text NOT NULL,
  campaign_id text REFERENCES public.campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  action_type public.decision_action_type NOT NULL,
  reason text NOT NULL,
  previous_value_json jsonb,
  proposed_value_json jsonb,
  confidence numeric(3,2) NOT NULL DEFAULT 0,
  risk_level public.risk_level NOT NULL DEFAULT 'MEDIUM',
  status public.decision_status NOT NULL DEFAULT 'PENDING',
  source public.decision_source NOT NULL DEFAULT 'RULE_ENGINE',
  executed_via public.execution_channel,
  result_json jsonb,
  approved_by_user_id uuid,
  approval_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  rejected_at timestamptz,
  executed_at timestamptz
);
CREATE INDEX decisions_ws_status_idx ON public.decisions (workspace_id, status, created_at DESC);
CREATE INDEX decisions_campaign_status_idx ON public.decisions (campaign_id, status, created_at DESC);
CREATE INDEX decisions_campaign_executed_idx ON public.decisions (campaign_id, executed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia decisions" ON public.decisions FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ ACTION LOGS ============
CREATE TABLE public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  platform public.platform NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_json jsonb,
  response_json jsonb,
  success boolean NOT NULL,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX action_logs_ws_idx ON public.action_logs (workspace_id, executed_at DESC);
GRANT SELECT, INSERT ON public.action_logs TO authenticated;
GRANT ALL ON public.action_logs TO service_role;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê action_logs" ON public.action_logs FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "Dono insere action_logs" ON public.action_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ COMPANION DEVICES ============
CREATE TABLE public.companion_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  pairing_code_hash text,
  device_token_hash text,
  status public.companion_status NOT NULL DEFAULT 'OFFLINE',
  app_version text,
  browser_label text,
  last_heartbeat_at timestamptz,
  paired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX companion_devices_ws_idx ON public.companion_devices (workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_devices TO authenticated;
GRANT ALL ON public.companion_devices TO service_role;
ALTER TABLE public.companion_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia companion_devices" ON public.companion_devices FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

-- ============ BROWSER AGENT ============
CREATE TABLE public.browser_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES public.companion_devices(id) ON DELETE SET NULL,
  task text NOT NULL,
  mode public.browser_agent_mode NOT NULL DEFAULT 'ANALYZE',
  model text NOT NULL DEFAULT 'gpt-4.1-mini',
  intent jsonb,
  status public.browser_agent_run_status NOT NULL DEFAULT 'STARTING',
  result_text text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX browser_agent_runs_ws_idx ON public.browser_agent_runs (workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_agent_runs TO authenticated;
GRANT ALL ON public.browser_agent_runs TO service_role;
ALTER TABLE public.browser_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia browser_agent_runs" ON public.browser_agent_runs FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE OR REPLACE FUNCTION public.is_browser_run_owner(_run_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.browser_agent_runs r
    JOIN public.workspaces w ON w.id = r.workspace_id
    WHERE r.id = _run_id AND w.owner_id = auth.uid()
  );
$$;

CREATE TABLE public.browser_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.browser_agent_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'INFO',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX browser_agent_logs_run_idx ON public.browser_agent_logs (run_id, created_at);
GRANT SELECT, INSERT ON public.browser_agent_logs TO authenticated;
GRANT ALL ON public.browser_agent_logs TO service_role;
ALTER TABLE public.browser_agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê browser_agent_logs" ON public.browser_agent_logs FOR SELECT TO authenticated
  USING (public.is_browser_run_owner(run_id));
CREATE POLICY "Dono insere browser_agent_logs" ON public.browser_agent_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_browser_run_owner(run_id));

CREATE TABLE public.browser_agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.browser_agent_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  action_type text NOT NULL,
  target text,
  current_value text,
  proposed_value text,
  reason text NOT NULL,
  risk_level public.risk_level NOT NULL DEFAULT 'MEDIUM',
  status public.browser_approval_status NOT NULL DEFAULT 'PENDING',
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response_note text
);
CREATE INDEX browser_agent_approvals_run_idx ON public.browser_agent_approvals (run_id, status, requested_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.browser_agent_approvals TO authenticated;
GRANT ALL ON public.browser_agent_approvals TO service_role;
ALTER TABLE public.browser_agent_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia browser_agent_approvals" ON public.browser_agent_approvals FOR ALL TO authenticated
  USING (public.is_browser_run_owner(run_id)) WITH CHECK (public.is_browser_run_owner(run_id));

-- ============ NOTES ============
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_ws_idx ON public.notes (workspace_id, position, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia notes" ON public.notes FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id)) WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_note()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE total integer;
BEGIN
  NEW.title := left(coalesce(NEW.title, 'Nota'), 40);
  IF length(coalesce(NEW.content, '')) > 20000 THEN
    RAISE EXCEPTION 'Conteúdo da nota excede 20.000 caracteres';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO total FROM public.notes WHERE workspace_id = NEW.workspace_id;
    IF total >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 notas por workspace atingido';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notes_validate BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.validate_note();

CREATE OR REPLACE FUNCTION public.validate_decision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'A validade da decisão deve estar no futuro';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER decisions_validate BEFORE INSERT ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.validate_decision();