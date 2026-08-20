# Adicionar "Todo o período" aos Relatórios

## Objetivo
Incluir uma opção "Todo o período" no seletor de período da tela de Relatórios, que abranja todos os dados existentes do workspace (sem filtro de data), ao lado das opções atuais de 7/14/30 dias.

## Mudanças

### 1. Backend — `src/lib/luma/relatorio.server.ts`
- Aceptar `dias === 0` como "todo o período":
  - `inicio` vira a data mais antiga disponível (ou `1970-01-01` como limite inferior seguro).
  - Período anterior fica vazio (zero), então `variacao` no frontend já retorna null e exibe "Sem período anterior para comparar".
- Ajustar o nome do CSV para "todo-periodo" quando `dias === 0`.

### 2. Server functions — `src/lib/luma.functions.ts`
- `obterRelatorio` e `exportarRelatorioCsv`: estender o union Zod de `7 | 14 | 30` para incluir `z.literal(0)` (sentinela de "todo o período").
- `exportarRelatorioCsv`: nome do arquivo reflete `0` como "todo-periodo".

### 3. Frontend — `src/routes/_authenticated/relatorios.tsx`
- Tipo `Periodo` passa a ser `7 | 14 | 30 | 0`.
- Adicionar `<TabsTrigger value="0">Todo o período</TabsTrigger>`.
- O texto do header ("comparativo com os {dias} dias anteriores") é ajustado para omitir o comparativo quando `dias === 0`.

## Detalhes técnicos
- Valor sentinela `0` significa "sem limite de janela"; não há mudança de schema nem migração.
- Nenhum impacto em Visão Geral, Campanhas, Decisões ou coleta.
