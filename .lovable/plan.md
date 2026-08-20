# Fase 6 — Agente de Navegador (companion local) e MCP

Objetivo: ligar a nuvem ao companion que roda na máquina do usuário e abrir a API MCP para agentes externos. Nada muda no fluxo de segurança: o agente propõe, você aprova, e só então algo é alterado.

## 1. Pareamento do companion

- Página **Agente de Navegador** deixa de ser placeholder.
- Botão "Parear novo dispositivo" gera um código de 8 dígitos com validade de 10 minutos; o companion troca esse código por um token de dispositivo. No banco ficam apenas os hashes (nunca o código ou o token em claro).
- Lista de dispositivos com nome, versão do app, navegador, estado (Offline / Online / Ocupado / Parado / Erro) e último sinal de vida; botão para remover o dispositivo.
- Dispositivo é considerado offline quando o último sinal tem mais de 2 minutos.

## 2. Execuções (runs) do agente

- Campo para descrever a tarefa em linguagem natural + escolha do modo: **Análise** (leitura, escrita bloqueada), **Aprovação** (escrita mediante concessão de uso único) e **PRIME** (auditoria profunda).
- **Roteador de intenção** no servidor, antes de criar a execução: classifica leitura x escrita, detecta ambiguidade (pede esclarecimento sem acionar o companion nem IA) e estima a complexidade — SIMPLE 8 / STANDARD 14 / BROAD 60–80 passos. Pedido de escrita em modo Análise é recusado como `MODE_MISMATCH`, sem consumir nada.
- Execução criada em `STARTING`; o companion assume, envia logs e conclui em `COMPLETED / PARTIAL / BLOCKED / NEEDS_INPUT / FAILED / STOPPED`.
- Detalhe da execução com logs ao vivo (Realtime), tarefa, modo, plano de intenção e resultado final.

## 3. Fila de aprovações do agente

- Quando o companion vai clicar num controle sensível, ele registra uma solicitação e a execução vai para **Aguardando aprovação**.
- A UI mostra o pedido (ação, alvo, valor atual, valor proposto, motivo, risco) com Aprovar / Recusar.
- Concessão de **uso único** com expiração: aprovada, vale para uma única ação; vencida, vira `EXPIRED` e o agente precisa pedir de novo.
- Com **PARAR AGENTE** ativo, iniciar execução e aprovar ficam bloqueados, e as execuções em andamento recebem ordem de parada.

## 4. Endpoints do companion

Rotas públicas dedicadas, autenticadas pelo token do dispositivo (nunca pela sessão do navegador):

- registrar/parear dispositivo e trocar o código pelo token;
- heartbeat (estado, versão, navegador) — também responde se o agente foi parado;
- puxar a próxima execução pendente e atualizar o status;
- enviar logs;
- abrir uma solicitação de aprovação e consultar o resultado dela.

## 5. Servidor MCP

- Endpoint MCP em `/api/public/mcp`, autenticado por chave de acesso do workspace (gerada e revogável em Configurações; guardada só como hash).
- Ferramentas: `ads_get_overview`, `ads_list_campaigns`, `ads_list_decisions`, `ads_run_analysis`, `ads_propose_action`, `ads_approve_decision`, `ads_reject_decision`, `ads_execute_approved_action`, `ads_sync_platform`.
- Propostas vindas do MCP nascem com origem `MCP` e estado Pendente. `ads_approve_decision` respeita expiração, uso único e o botão de parada; `ads_execute_approved_action` reaproveita a execução verificada já existente da Fase 4.
- Página de Configurações ganha o bloco "Acesso MCP": gerar chave (exibida uma única vez), revogar e ver a URL de conexão.

## 6. Diagnóstico e Visão Geral

- Diagnóstico passa a mostrar dispositivos pareados, última execução do agente e chave MCP configurada.
- Visão Geral mostra o estado do companion no cartão de saúde.

## Detalhes técnicos

- Novas tabelas: `mcp_keys` (hash da chave, rótulo, último uso) e colunas de pareamento em `companion_devices` (validade do código, hash do token). RLS por dono do workspace; tabelas de credencial sem policy alguma, acessíveis só pelo servidor.
- Rotas do companion e do MCP em `src/routes/api/public/*`, resolvendo o workspace pelo hash do token/chave com o cliente de serviço, sem sessão de usuário.
- Lógica compartilhada em `src/lib/luma/companion.server.ts` (pareamento, heartbeat, fila) e `src/lib/luma/mcp.server.ts` (ferramentas), reaproveitando `motor.ts`, `analise.server.ts` e `executarDecisao`.
- Realtime do Supabase para logs e mudanças de estado das execuções na UI.
- Sem companion pareado, a página explica em PT-BR como parear e permanece utilizável (histórico vazio, sem erro).
