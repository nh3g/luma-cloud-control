CREATE OR REPLACE FUNCTION public.seed_demo_workspace(_ws uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  p text := substr(replace(_ws::text, '-', ''), 1, 8);
  meta_acct text := 'act_1029384756';
  goog_acct text := '482-716-9034';
  d integer;
  f numeric;
  c record;
  dec1 uuid; dec2 uuid; dec3 uuid; dec4 uuid; dec5 uuid;
BEGIN
  -- Idempotente: se o conjunto fictício já existe, não faz nada.
  IF EXISTS (SELECT 1 FROM public.campaigns WHERE workspace_id = _ws AND id LIKE 'demo-%') THEN RETURN; END IF;

  -- Remove apenas resíduos demo (dados reais permanecem intactos).
  DELETE FROM public.action_logs WHERE workspace_id = _ws AND decision_id IN (
    SELECT id FROM public.decisions WHERE workspace_id = _ws AND campaign_id LIKE 'demo-%'
  );
  DELETE FROM public.decisions WHERE workspace_id = _ws AND campaign_id LIKE 'demo-%';
  DELETE FROM public.metric_snapshots WHERE workspace_id = _ws AND campaign_id LIKE 'demo-%';
  DELETE FROM public.campaigns WHERE workspace_id = _ws AND id LIKE 'demo-%';
  DELETE FROM public.integrations WHERE workspace_id = _ws AND metadata_json->>'demo' = 'true';

  INSERT INTO public.integrations (workspace_id, platform, account_id, name, status, metadata_json)
  VALUES
    (_ws, 'META', meta_acct, 'Loja Aurora — Meta Ads', 'CONNECTED', '{"demo": true, "currency": "BRL"}'::jsonb),
    (_ws, 'GOOGLE_ADS', goog_acct, 'Loja Aurora — Google Ads', 'CONNECTED', '{"demo": true, "currency": "BRL"}'::jsonb)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.campaigns (
    id, workspace_id, platform, account_id, name, status, objective,
    budget_daily, spend, revenue, impressions, clicks, conversions, frequency, metadata_json, synced_at
  )
  SELECT
    'demo-' || p || '-' || v.n,
    _ws, v.platform::public.platform, v.account_id, v.name, v.status, v.objective,
    v.budget_daily, v.spend, v.revenue, v.impressions, v.clicks, v.conversions, v.frequency,
    '{"demo": true, "currency": "BRL"}'::jsonb, now() - interval '18 minutes'
  FROM (VALUES
    ('01','META',meta_acct,'Black Friday — Conversão (BR)','ACTIVE','OUTCOME_SALES',300::numeric,2450.80::numeric,9803.20::numeric,210000,4200,61::numeric,2.10::numeric),
    ('02','META',meta_acct,'Remarketing 30d — Catálogo','ACTIVE','OUTCOME_SALES',150,1180.50,1416.60,320000,2100,22,4.60),
    ('03','META',meta_acct,'Prospecção Frio — Vídeo 15s','ACTIVE','OUTCOME_AWARENESS',120,640.00,0.00,180000,900,0,1.40),
    ('04','META',meta_acct,'Lead Ads — Consultoria','PAUSED','OUTCOME_LEADS',80,320.00,900.00,60000,800,12,1.80),
    ('05','META',meta_acct,'Engajamento — Reels Institucional','ACTIVE','OUTCOME_ENGAGEMENT',60,410.30,512.00,240000,1500,8,5.20),
    ('06','GOOGLE_ADS',goog_acct,'Search — Marca','ACTIVE','SEARCH',90,720.40,4322.40,40000,3000,48,1.00),
    ('07','GOOGLE_ADS',goog_acct,'Search — Genéricas Alto Funil','ACTIVE','SEARCH',200,1890.00,2457.00,95000,3800,31,1.00),
    ('08','GOOGLE_ADS',goog_acct,'Performance Max — Loja','ACTIVE','PERFORMANCE_MAX',250,3120.75,12483.00,520000,7400,88,1.00),
    ('09','GOOGLE_ADS',goog_acct,'Shopping — Ofertas','ACTIVE','SHOPPING',140,980.20,2450.50,150000,2200,34,1.00),
    ('10','GOOGLE_ADS',goog_acct,'Display — Remarketing','PAUSED','DISPLAY',50,210.00,180.00,400000,600,3,3.20)
  ) AS v(n, platform, account_id, name, status, objective, budget_daily, spend, revenue, impressions, clicks, conversions, frequency);

  UPDATE public.campaigns SET
    ctr = CASE WHEN impressions > 0 THEN round(clicks::numeric * 100 / impressions, 4) ELSE 0 END,
    cpc = CASE WHEN clicks > 0 THEN round(spend / clicks, 4) ELSE 0 END,
    cpm = CASE WHEN impressions > 0 THEN round(spend * 1000 / impressions, 4) ELSE 0 END,
    cpa = CASE WHEN conversions > 0 THEN round(spend / conversions, 2) ELSE 0 END,
    roas = CASE WHEN spend > 0 THEN round(revenue / spend, 4) ELSE 0 END
  WHERE workspace_id = _ws AND id LIKE 'demo-%';

  FOR c IN SELECT * FROM public.campaigns WHERE workspace_id = _ws AND id LIKE 'demo-%' LOOP
    FOR d IN 0..13 LOOP
      f := (0.72 + ((d * 7 + length(c.id)) % 11)::numeric / 20) / 14;
      INSERT INTO public.metric_snapshots (
        workspace_id, campaign_id, platform, spend, revenue, impressions, clicks, conversions,
        ctr, cpc, cpm, cpa, roas, frequency, captured_at
      )
      SELECT _ws, c.id, c.platform,
        round(c.spend * f, 2), round(c.revenue * f, 2),
        round(c.impressions * f)::int, round(c.clicks * f)::int, round(c.conversions * f, 2),
        c.ctr, c.cpc, c.cpm, c.cpa, c.roas, c.frequency,
        date_trunc('day', now()) - ((13 - d) || ' days')::interval + interval '20 hours';
    END LOOP;
  END LOOP;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at)
  VALUES (_ws, 'META', meta_acct, 'demo-' || p || '-01', 'Black Friday — Conversão (BR)', 'INCREASE_BUDGET',
    'ROAS de 4,00 acima do limite de escala (3,00) nos últimos 7 dias. Sugerido aumentar o orçamento diário em 15%.',
    '{"budgetDaily": 300}'::jsonb, '{"budgetDaily": 345}'::jsonb, 0.86, 'LOW', 'PENDING', 'RULE_ENGINE', now() + interval '20 hours')
  RETURNING id INTO dec1;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at)
  VALUES (_ws, 'META', meta_acct, 'demo-' || p || '-02', 'Remarketing 30d — Catálogo', 'DECREASE_BUDGET',
    'ROAS de 1,20 abaixo do limite de redução (1,30) e CPA de R$ 53,66 acima do alvo de R$ 40,00. Sugerido reduzir o orçamento diário em 20%.',
    '{"budgetDaily": 150}'::jsonb, '{"budgetDaily": 120}'::jsonb, 0.78, 'MEDIUM', 'PENDING', 'RULE_ENGINE', now() + interval '16 hours')
  RETURNING id INTO dec2;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at, approved_at, approval_note, executed_via)
  VALUES (_ws, 'META', meta_acct, 'demo-' || p || '-03', 'Prospecção Frio — Vídeo 15s', 'PAUSE_CAMPAIGN',
    'Gasto de R$ 640,00 acima do mínimo de R$ 100,00 sem nenhuma conversão registrada. Sugerido pausar a campanha.',
    '{"status": "ACTIVE"}'::jsonb, '{"status": "PAUSED"}'::jsonb, 0.92, 'HIGH', 'APPROVED', 'RULE_ENGINE',
    now() + interval '10 hours', now() - interval '35 minutes', 'Aprovado após revisar os criativos.', NULL)
  RETURNING id INTO dec3;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at, rejected_at, approval_note)
  VALUES (_ws, 'META', meta_acct, 'demo-' || p || '-05', 'Engajamento — Reels Institucional', 'ROTATE_CREATIVE',
    'Frequência de 5,20 acima do limite de 4,00 com CTR de 0,62% abaixo de 0,80%. Sugerido girar os criativos.',
    '{"frequency": 5.2, "ctr": 0.62}'::jsonb, '{"action": "novo criativo"}'::jsonb, 0.64, 'LOW', 'REJECTED', 'AI',
    now() + interval '8 hours', now() - interval '2 hours', 'Criativo novo já está em produção.')
  RETURNING id INTO dec4;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at, approved_at, executed_at, executed_via, result_json)
  VALUES (_ws, 'GOOGLE_ADS', goog_acct, 'demo-' || p || '-07', 'Search — Genéricas Alto Funil', 'DECREASE_BUDGET',
    'ROAS de 1,30 no limite de redução por 3 dias seguidos. Orçamento diário reduzido em 20%.',
    '{"budgetDaily": 250}'::jsonb, '{"budgetDaily": 200}'::jsonb, 0.81, 'MEDIUM', 'EXECUTED', 'RULE_ENGINE',
    now() + interval '30 hours', now() - interval '1 day' - interval '2 hours', now() - interval '1 day' - interval '1 hour',
    'SIMULATED', '{"verified": true, "budgetDaily": 200}'::jsonb)
  RETURNING id INTO dec5;

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at)
  VALUES (_ws, 'GOOGLE_ADS', goog_acct, 'demo-' || p || '-10', 'Display — Remarketing', 'RESUME_CAMPAIGN',
    'Campanha pausada há 9 dias com CPA histórico dentro do alvo. Sugerido reativar em orçamento reduzido.',
    '{"status": "PAUSED"}'::jsonb, '{"status": "ACTIVE"}'::jsonb, 0.55, 'MEDIUM', 'PENDING', 'MANUAL', now() + interval '6 hours');

  INSERT INTO public.decisions (workspace_id, platform, account_id, campaign_id, campaign_name, action_type, reason,
    previous_value_json, proposed_value_json, confidence, risk_level, status, source, expires_at)
  VALUES (_ws, 'GOOGLE_ADS', goog_acct, 'demo-' || p || '-09', 'Shopping — Ofertas', 'INCREASE_BUDGET',
    'ROAS de 2,50 em alta consistente. A aprovação não foi consumida dentro da validade e a decisão expirou.',
    '{"budgetDaily": 140}'::jsonb, '{"budgetDaily": 161}'::jsonb, 0.7, 'LOW', 'EXPIRED', 'RULE_ENGINE', now() + interval '1 minute')
  RETURNING id INTO dec4;
  UPDATE public.decisions SET expires_at = now() - interval '4 hours', created_at = now() - interval '2 days' WHERE id = dec4;

  INSERT INTO public.action_logs (workspace_id, decision_id, platform, endpoint, method, request_json, response_json, success, executed_at)
  VALUES
    (_ws, dec5, 'GOOGLE_ADS', '/v17/customers/4827169034/campaignBudgets:mutate', 'POST',
     '{"budgetDaily": 200, "mode": "SIMULATED"}'::jsonb, '{"resourceName": "customers/4827169034/campaignBudgets/9911", "amountMicros": 200000000}'::jsonb,
     true, now() - interval '1 day' - interval '1 hour'),
    (_ws, dec5, 'GOOGLE_ADS', '/v17/customers/4827169034/googleAds:search', 'GET',
     '{"query": "verificacao de estado final"}'::jsonb, '{"budgetDaily": 200, "verified": true}'::jsonb,
     true, now() - interval '1 day' - interval '59 minutes');

  INSERT INTO public.sync_runs (workspace_id, platform, status, message, accounts, campaigns, failed_accounts, started_at, finished_at)
  VALUES
    (_ws, 'META', 'SUCCESS', '5 campanhas sincronizadas.', 1, 5, 0, now() - interval '20 minutes', now() - interval '18 minutes'),
    (_ws, 'GOOGLE_ADS', 'PARTIAL', '5 campanhas sincronizadas. 1 conta não respondeu no tempo limite.', 2, 5, 1, now() - interval '20 minutes', now() - interval '17 minutes');

  INSERT INTO public.notes (workspace_id, title, content, position)
  SELECT _ws, 'Bem-vindo à LUMA', E'Este workspace está em modo DEMONSTRAÇÃO.\n\nOs números, campanhas e decisões são fictícios e servem para você conhecer o fluxo:\nsincronização -> motor de regras -> decisão -> aprovação humana -> execução verificada.\n\nNenhuma ação é executada em contas reais enquanto o modo demonstração estiver ativo.', 0
  WHERE NOT EXISTS (SELECT 1 FROM public.notes WHERE workspace_id = _ws AND title = 'Bem-vindo à LUMA');
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_demo_workspace(uuid) FROM PUBLIC, anon, authenticated;