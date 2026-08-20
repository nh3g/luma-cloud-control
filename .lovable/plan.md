# FASE 2 — Banco completo, RLS e seed de demonstração

A Fase 1 entregou auth, workspace, tema e layout. A Fase 2 cria **todo o restante do banco** conforme o `schema.prisma` enviado, com RLS por workspace, e popula um **conjunto de dados fictícios** para o modo demonstração — a base sobre a qual as fases 3 a 8 vão trabalhar.

## O que será criado no banco

Enums (fiéis ao schema): `platform`, `integration_status`, `decision_action_type`, `decision_status`, `decision_source`, `risk_level`, `execution_channel`, `sync_status`, `browser_agent_mode`, `browser_agent_run_status`, `browser_approval_status`, `companion_status`.

Tabelas (nomes e colunas preservados da 1.10.4):

| Grupo | Tabelas |
|---|---|
| Configuração | `engine_settings`, `app_credentials` |
| Integrações | `integrations`, `oauth_states`, `sync_runs` |
| Dados de mídia | `campaigns`, `metric_snapshots` |
| Decisão | `decisions`, `action_logs` |
| Companion | `companion_devices`, `browser_agent_runs`, `browser_agent_logs`, `browser_agent_approvals` |
| Extras | `notes` |

Regras aplicadas em todas elas:
- RLS ligada, acesso apenas ao dono do workspace (`auth.uid()`), via função `security definer` `public.is_workspace_owner(uuid)` para evitar recursão.
- GRANTs explícitos para `authenticated` e `service_role`; nada liberado para visitantes anônimos.
- Índices do schema (por workspace, status, data) e `updated_at` automático via trigger.
- Nenhum token ou segredo em texto puro: `app_credentials` e `integrations` guardam apenas **referências** de segredo (id no cofre) e metadados.
- `engine_settings` criada automaticamente junto com o workspace, com os 10 defaults da 1.10.4 (CPA alvo 40, ROAS 3 / 1.3, gasto sem conversão 100, frequência 4, CTR 0.8, +15% / -20%, análise 120 min, TTL de decisão 1440 min).

Validações por trigger (não CHECK, para não quebrar restauração):
- intervalo de análise mínimo de 15 minutos;
- máximo de 20 notas por workspace, título ≤ 40 e conteúdo ≤ 20.000 caracteres;
- decisão sempre com `expires_at` no futuro na criação.

## Seed de demonstração

A própria migração insere os dados fictícios de um **workspace-modelo de demonstração**, replicado para o usuário no primeiro acesso quando `demo_mode = true`:

- 2 integrações (Meta e Google Ads) com status `CONNECTED` simulado;
- ~10 campanhas brasileiras plausíveis (nomes, objetivos, orçamentos em BRL) distribuídas entre as duas plataformas, com status ACTIVE/PAUSED e métricas coerentes (spend, revenue, ROAS, CPA, CTR, CPC, CPM, frequência);
- 14 dias de `metric_snapshots` por campanha, para os gráficos de tendência da Fase 3;
- decisões de exemplo cobrindo cada estado (`PENDING`, `APPROVED`, `EXECUTED`, `REJECTED`, `EXPIRED`) e cada tipo de ação, com valores antes/depois, confiança, risco e origem;
- `action_logs` correspondentes às decisões executadas (canal `SIMULATED`);
- 2 `sync_runs` recentes (um SUCCESS, um PARTIAL);
- 1 companion offline e 1 nota de boas-vindas.

Casos de exemplo escolhidos para exercitar cada regra do motor: ROAS ≥ 3 (escalar), ROAS ≤ 1.3 (reduzir), gasto ≥ 100 sem conversão (pausar), frequência ≥ 4 com CTR ≤ 0.8 (girar criativo).

## Camada de acesso no app

- Tipos regenerados do banco e um módulo `src/lib/luma/` com helpers de formatação em PT-BR (BRL, percentual, ROAS) e rótulos dos enums.
- Funções de servidor autenticadas (`createServerFn` + middleware Supabase) para leitura: visão geral, campanhas, decisões, sync runs, notas, configurações — usadas pelas fases seguintes.
- Semeadura do workspace demo executada uma única vez por workspace, disparada por função de servidor, sem duplicar se já houver dados.
- Página **Configurações** passa a ler e gravar de verdade os parâmetros do motor e o perfil (apelido, cor, avatar), com validação dos limites.
- Página **Notas** funcional: abas até 20, autosave.

As demais páginas continuam com o placeholder até suas fases.

## Detalhes técnicos

- Uma migração SQL única: enums → tabelas → GRANTs → RLS → policies → triggers → INSERTs literais do seed.
- Trigger existente `handle_new_user` estendido para criar também `engine_settings`.
- Leitura sempre por função de servidor autenticada (RLS aplicada como o usuário); nada de cliente admin em rota pública.
- Validação final: cadastro de novo usuário → workspace + settings criados → dados demo visíveis nas páginas de Configurações e Notas, verificado no navegador.
