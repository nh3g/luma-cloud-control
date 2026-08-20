# Fase 4 — Motor de regras, execução verificada e diagnóstico

Objetivo: fechar o ciclo do fluxograma entre "análise" e "execução auditada" usando os dados já sincronizados (hoje, os de demonstração). Nada roda sem aprovação humana e nada é dado como executado sem verificação.

## 1. Motor de regras determinístico

Uma rotina de servidor que avalia cada campanha ativa contra os parâmetros salvos em Configurações:

- ROAS >= limite de escala → **Aumentar orçamento** (+% configurado), risco baixo
- ROAS <= limite de redução **ou** CPA acima do alvo → **Reduzir orçamento** (-% configurado), risco médio
- Gasto >= mínimo sem nenhuma conversão → **Pausar campanha**, risco alto
- Frequência >= limite **e** CTR <= limite → **Girar criativo** (alerta), risco baixo
- Nenhuma condição → nenhuma decisão

Regras de integridade:
- Uma decisão pendente por campanha e tipo de ação: duplicata é ignorada, não recriada.
- Validade calculada pelo TTL das configurações.
- Confiança derivada da distância entre a métrica e o limite.
- O motor não roda com o agente parado.

## 2. Expiração automática

Toda leitura de decisões marca como **Expirada** o que passou da validade sem execução, incluindo aprovações não consumidas. Aprovação vale uma única vez.

## 3. Execução verificada (modo demonstração)

Decisão aprovada ganha o botão **Executar**. O fluxo segue o do fluxograma:

1. Relê o estado atual da campanha e compara com o valor anterior registrado.
2. Divergência → execução **bloqueada**, a decisão volta para nova análise, com motivo visível.
3. Sem divergência → aplica a alteração na campanha e confere o estado final.
4. Confirmado → **Executada** + resultado gravado; não confirmado → **Falhou** (nunca registra sucesso).
5. Cada passo grava um registro de auditoria com canal, endpoint simulado, requisição e resposta.

Enquanto o workspace está em demonstração, o canal fica marcado como simulado — a troca para API oficial é a Fase 5, sem mudar essa lógica.

## 4. Telas

- **Decisões**: botão "Rodar análise agora" no topo (com resumo do que foi criado), ação Executar nas aprovadas, aviso de bloqueio por divergência e contagem de expiradas.
- **Visão Geral**: aviso quando existem decisões aprovadas aguardando execução.
- **Diagnóstico** (hoje placeholder): passa a mostrar o estado real — agente parado ou ativo, última análise, últimas sincronizações, registros de auditoria recentes com sucesso/erro, e contagem por estado das decisões.

## 5. Detalhes técnicos

- Novas funções de servidor em `src/lib/luma.functions.ts`, autenticadas, com o workspace resolvido pelo dono: `rodarAnalise`, `executarDecisao`, `obterDiagnostico`.
- Lógica pura das regras isolada em `src/lib/luma/motor.ts` (recebe métricas + configurações, devolve decisões propostas), o que a torna testável e reaproveitável pela IA e pelo MCP nas fases seguintes.
- Expiração aplicada em `listarDecisoes` e no início de `rodarAnalise`.
- Auditoria em `action_logs` com `executed_via = SIMULATED` no modo demonstração.
- Nada de agendador automático nesta fase: a análise é disparada pela tela. O agendamento na nuvem entra junto com a sincronização real na Fase 5.
