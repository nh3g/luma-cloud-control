# Fase 9 — Endurecimento, qualidade e publicação

As oito fases do plano original estão entregues (fundação, banco+RLS, dashboards, motor de regras, integrações reais, MCP/companion, estrategista IA, relatórios e onboarding). Esta fase fecha a plataforma para uso real: segurança revisada, comportamento previsível em erro e app publicado.

## 1. Segurança e credenciais
- Revisar as tabelas sensíveis (`platform_credentials`, `integration_tokens`): confirmar que continuam sem políticas e acessíveis somente pelo servidor, e registrar isso na memória de segurança para não virar alerta recorrente.
- Conferir que nenhuma chave/segredo trafega para o navegador (somente indicadores "configurado/não configurado").
- Revisar as políticas de todas as tabelas do workspace para garantir isolamento por dono.

## 2. Robustez de uso
- Estados de erro e vazio consistentes em todas as telas (falha de rede, workspace sem dados, integração sem credencial), no lugar de tela em branco.
- Confirmação antes de ações irreversíveis (revogar chave MCP, desparear companion, recusar decisão).
- Rever o botão PARAR AGENTE ponta a ponta: bloqueio de execução, sync, cron, companion e estrategista.
- Garantir mensagens de erro sempre em PT-BR e amigáveis.

## 3. Qualidade visual final
- Revisão de contraste e legibilidade nas telas restantes (Campanhas, Decisões, Relatórios, Diagnóstico), no mesmo padrão já aplicado ao gráfico da Visão Geral.
- Responsividade em telas menores: sidebar recolhível e tabelas com rolagem horizontal.
- Estados de carregamento (skeletons) nas listas mais pesadas.

## 4. Publicação
- Revisar metadados de todas as rotas (títulos e descrições únicos em PT-BR).
- Checagem final de tipos e verificação no navegador do fluxo completo: cadastro → tour → análise → aprovação → execução → relatório.
- Publicar o app e informar a URL.

## Detalhes técnicos
- Sem novas dependências. Ajustes concentrados em `src/routes/_authenticated/*`, `src/components/luma/*` e nos módulos `src/lib/luma/*`.
- Eventual migração apenas se a revisão de RLS apontar lacuna; nesse caso com `GRANT` explícito.
- Verificação com `tsgo` e Playwright contra o preview local.
