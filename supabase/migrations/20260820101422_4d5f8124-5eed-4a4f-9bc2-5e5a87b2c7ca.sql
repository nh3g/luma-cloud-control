DROP TABLE IF EXISTS public.browser_agent_approvals CASCADE;
DROP TABLE IF EXISTS public.browser_agent_logs CASCADE;
DROP TABLE IF EXISTS public.browser_agent_runs CASCADE;
DROP TABLE IF EXISTS public.companion_devices CASCADE;

DROP FUNCTION IF EXISTS public.is_browser_run_owner(uuid);

DROP TYPE IF EXISTS public.browser_agent_mode;
DROP TYPE IF EXISTS public.browser_agent_run_status;
DROP TYPE IF EXISTS public.browser_approval_status;
DROP TYPE IF EXISTS public.companion_status;