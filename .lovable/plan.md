# Coleta por navegador (browser-use na nuvem) + IA com sua chave OpenAI

Duas entregas: a LUMA passa a usar a sua chave da OpenAI em tudo que é IA, e ganha um
terceiro modo de coleta de métricas — um navegador na nuvem que abre o Gerenciador de
Anúncios da Meta e o Google Ads, lê os números da tela e grava no banco, sem precisar
de API oficial nem de programa instalado no seu computador.

## O que muda para você

- **Integrações** ganha a opção "Como buscar os dados": *Demonstração*, *API oficial*
  (o que já existe) ou *Navegador (browser-use)*.
- No modo navegador você informa, por plataforma, o **ID da conta de anúncios**
  (ex.: `act_123...` na Meta, `123-456-7890` no Google) e o período (últimos 7/14/30 dias).
- Ao clicar em **Sincronizar agora**, a LUMA abre uma sessão de navegador na nuvem,
  faz a leitura e mostra o andamento ao vivo (etapas, tempo, erro em português).
- Na **primeira vez** a sessão precisa de login: a tela mostra um link de acompanhamento
  ao vivo da sessão, você entra na sua conta Meta/Google por ali, e a sessão fica salva
  para as próximas coletas (perfil persistente do provedor).
- **Configurações** ganha um bloco de IA: chave OpenAI já configurada, escolha do modelo
  e teste de conexão.
- Nada disso altera contas de anúncio: a coleta é somente leitura, e qualquer ação
  continua passando pela fila de aprovação humana.

## O que é preciso de você

- A chave `OPENAI_API_KEY` já foi fornecida.
- Uma chave do serviço de navegador em nuvem (**Browser Use Cloud** — `BROWSER_USE_API_KEY`).
  Vou pedir por um campo seguro na hora de implementar. Sem ela, o modo navegador aparece
  desativado, explicando o que falta; os modos demonstração e API oficial continuam iguais.

## Detalhes técnicos

**IA (OpenAI)**
- Novo `src/lib/luma/ia.server.ts`: cliente único da OpenAI (`/v1/chat/completions`,
  tool-calling), lendo `OPENAI_API_KEY` dentro do handler; modelo padrão `gpt-4.1`,
  sobrescrevível por workspace em `workspace_settings`. Erros 401/429/402 traduzidos.
- `estrategista.server.ts` deixa de chamar o gateway do Lovable e passa a usar esse cliente,
  mantendo o mesmo conjunto de ferramentas permitidas (leitura + `ads_propose_action`).

**Coleta por navegador**
- `src/lib/luma/browser.server.ts`: cria a tarefa na API do Browser Use Cloud
  (`POST /api/v2/tasks`, header `X-Browser-Use-API-Key`, `llm` OpenAI, perfil persistente
  por workspace+plataforma), com prompt em PT-BR por plataforma e `structuredOutput`
  (JSON Schema) devolvendo a lista de campanhas: nome, status, objetivo, orçamento diário,
  gasto, receita/valor de conversão, impressões, cliques, conversões, frequência.
- Consulta assíncrona: a tarefa roda por minutos. O servidor cria a tarefa e guarda o id;
  a tela consulta o andamento a cada poucos segundos por uma server function
  (`consultarColetaNavegador`), sem segurar requisição aberta.
- `sync.server.ts` ganha o terceiro caminho: `demo` → simulação, `api` → APIs oficiais,
  `browser` → resultado estruturado do navegador, reaproveitando `gravarCampanhas`
  (mesmas métricas derivadas, mesmo snapshot, mesmo registro em `sync_runs`).
- Migração: colunas em `integrations` para `collection_mode` (`DEMO|API|BROWSER`),
  `external_account_id` e `lookback_days`; nova tabela `browser_collection_runs`
  (workspace, plataforma, task id, status, etapa atual, url de acompanhamento, erro,
  timestamps) com RLS por `is_workspace_owner` e GRANTs para `authenticated`/`service_role`.
  A chave do provedor fica só em segredo do servidor, nunca no navegador.
- Funções em `luma.functions.ts`: `iniciarColetaNavegador`, `consultarColetaNavegador`,
  `salvarModoColeta`, `testarChaveIa` — todas com `requireSupabaseAuth` e bloqueadas
  quando o botão PARAR AGENTE está ativo.

**Interface**
- `src/routes/_authenticated/integracoes.tsx`: seletor de modo por plataforma, campos de
  conta/período com validação de formato, botão de sincronizar e painel de andamento
  (etapas, link da sessão ao vivo, erro traduzido, botão de tentar de novo).
- `src/routes/_authenticated/configuracoes.tsx`: bloco de IA (status da chave, modelo,
  teste), no mesmo padrão visual das demais telas.

**Fora de escopo**
- Nenhuma escrita/alteração nas contas de anúncio pelo navegador — apenas leitura.
- O motor Python local do exemplo enviado não volta; a mesma função é feita pelo serviço
  em nuvem.
