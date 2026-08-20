# Fase 8 — Fechamento: onboarding, relatórios e polimento

Última fase do plano. As telas e o motor já existem; agora o foco é a experiência de quem chega pela primeira vez, o fechamento de ciclo (relatório e histórico) e o acabamento de segurança e desempenho.

## 1. Onboarding e modo demonstração explícito
- Selo "MODO DEMONSTRAÇÃO" fixo no topo do layout quando o workspace está em demo, com link direto para Integrações.
- Tour de boas-vindas na Visão Geral (4 passos: o que a LUMA faz, fila de decisões, aprovação humana, botão PARAR AGENTE), dispensável e lembrado por workspace.
- Estado vazio orientado em cada tela quando ainda não há dados, sempre em PT-BR.

## 2. Relatório do período
- Nova tela **Relatórios**: escolha de período (7/14/30 dias), resumo de investimento, receita, ROAS, CPA e variação vs. período anterior.
- Tabela de decisões do período com resultado (aprovadas, recusadas, executadas, expiradas) e o impacto estimado acumulado.
- Exportação em CSV gerada no servidor, sem bibliotecas extras.

## 3. Ciclo de vida das decisões
- Expiração automática aplicada também na abertura de Visão Geral e Decisões (hoje só ocorre na análise, no MCP e na execução), para a fila nunca mostrar item vencido.
- Registro em `action_logs` quando uma decisão expira, para aparecer no Diagnóstico.
- Resumo no topo da fila: quantas aguardam você, quantas vencem na próxima hora.

## 4. Acabamento
- Metadados de página (título e descrição próprios) em todas as rotas, hoje ausentes.
- Revisão de acessibilidade básica: rótulos em botões de ícone, foco visível, contraste nos estados desabilitados.
- Varredura de segurança do banco e ajuste de qualquer política sinalizada.

## Detalhes técnicos
- Nova rota `src/routes/_authenticated/relatorios.tsx` + item na sidebar; dados via nova função de servidor em `src/lib/luma.functions.ts` agregando `metric_snapshots` e `decisions` por período.
- Exportação CSV por rota de servidor autenticada retornando `text/csv`, não por download montado no cliente.
- Onboarding e dispensa do tour guardados em coluna JSON de preferências do `workspaces` (migração pequena, com GRANT e RLS já existentes por dono).
- Expiração reaproveita `expirarDecisoesVencidas` de `src/lib/luma.server.ts`, chamada nas funções de leitura de Visão Geral e Decisões.
- Nenhuma alteração no fluxo de aprovação humana, no botão de pânico ou nas credenciais.
