# Religar o modo demonstração deve trazer os dados fictícios de volta

## O que acontece hoje

Os dados de demonstração são criados uma única vez, no cadastro da conta. Depois disso, ligar o switch "Modo demonstração" apenas grava a preferência no workspace — não recria nada. Como a Limpeza de dados apaga campanhas, métricas e decisões, o workspace fica vazio e o switch parece não funcionar.

Além disso, a rotina de seed atual desiste se já existir qualquer campanha no workspace, então nem se fosse chamada de novo ela repopularia um workspace que já tenha dados reais importados.

## O que vai mudar

1. Ao ligar o switch de dados simulados, a LUMA recria automaticamente o conjunto fictício (2 integrações demo, 10 campanhas, 14 dias de métricas, decisões em vários estados e a nota de boas-vindas) caso ele não esteja mais no workspace.
2. Os dados reais (importados, coletados por API ou navegador) nunca são apagados nesse processo — o seed só insere as linhas com marcação `demo-`, e a mistura continua sendo resolvida pelos filtros já existentes de escopo DEMO/REAIS.
3. Se o conjunto fictício já estiver presente, nada é duplicado: a rotina apenas confirma e mantém o que existe.
4. Um botão explícito "Recriar dados de demonstração" fica disponível em Integrações, junto da Limpeza de dados, para quem quiser refazer o conjunto sem mexer no switch.
5. Mensagens de retorno em PT-BR: "Dados de demonstração recriados" ou "Modo demonstração ligado — os dados fictícios já estavam no lugar".

## Detalhes técnicos

- Migração ajustando `public.seed_demo_workspace(_ws uuid)`:
  - trocar o guard `IF EXISTS (SELECT 1 FROM campaigns WHERE workspace_id = _ws) RETURN` por um guard restrito às linhas demo (`id LIKE 'demo-%'`), para que workspaces com dados reais também possam receber o seed;
  - antes de inserir, limpar apenas o resíduo demo (decisões/snapshots/campanhas com `id LIKE 'demo-%'` e integrações com `metadata_json->>'demo' = 'true'`), garantindo idempotência;
  - manter `SECURITY DEFINER` e o `REVOKE` atual.
- Nova server function `recriarDemonstracao` em `src/lib/luma.functions.ts` com `requireSupabaseAuth`: resolve o workspace do usuário, carrega `supabaseAdmin` dentro do handler (`await import("@/integrations/supabase/client.server")`) e executa `seed_demo_workspace(ws)` via RPC, retornando quantas campanhas demo existem ao final.
- `alternarPreferenciaWorkspace`: quando `campo === "demo_mode"` e `valor === true`, chamar a mesma rotina de seed depois de gravar a preferência, e devolver `{ ok: true, recriado: boolean }`.
- Frontend: no componente que expõe o switch (tela de Integrações / selo de demonstração), invalidar as queries `visao-geral`, `campanhas`, `decisoes`, `integracoes`, `diagnostico` e `notas` após ligar o modo demo, e mostrar o toast correspondente. Adicionar o botão "Recriar dados de demonstração" no painel de Limpeza de dados, com diálogo de confirmação.
