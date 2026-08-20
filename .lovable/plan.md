# Corrigir cadastro + Fase 3 (Dashboards)

## Por que o cadastro falha

Os logs de autenticação mostram que a conta não é criada porque a senha usada (`Chiquinho2804`) aparece em vazamentos públicos conhecidos. O backend responde `weak_password / pwned` (erro 422). Não é bug de código: é a proteção de senhas vazadas ativa no projeto.

Além disso, a tela atual só mostra um aviso curto em toast, que some rápido — por isso parece que "nada acontece".

## O que vou fazer

### 1. Tela de autenticação mais clara
- Mostrar o erro fixo abaixo do formulário (não só toast), com texto explícito: "Essa senha aparece em vazamentos públicos. Escolha outra."
- Dica de senha visível no campo (mínimo 8 caracteres, evitar nome + data).
- Botão de mostrar/ocultar senha.
- Validação local antes de enviar (comprimento e e-mail).

Alternativa possível (só se você pedir): desligar a checagem de senhas vazadas. Não recomendo — reduz a segurança do app.

### 2. Fase 3 — Dashboards (Visão Geral, Campanhas, Decisões)
Usando as funções de servidor e o seed de demonstração já prontos:

- **Visão Geral (`/`)**: cartões com gasto, receita, ROAS, CPA, conversões e CTR do período; gráfico de evolução (14 dias); alertas do motor; últimas sincronizações; estado das integrações; badge DEMO.
- **Campanhas**: tabela unificada Meta + Google com filtro por plataforma, status e busca; colunas de gasto, receita, ROAS, CPA, CTR, frequência; ordenação; detalhe da campanha.
- **Decisões**: fila de aprovação com cartões por decisão (tipo, campanha, motivo, impacto estimado, prazo de expiração com contagem regressiva), filtros por estado (pendente, aprovada, recusada, expirada, executada) e histórico. Os botões de aprovar/recusar ficam desabilitados quando o agente está parado, com aviso.

Tudo em PT-BR, valores em R$, datas em formato brasileiro, seguindo o tema escuro já definido.

## Detalhes técnicos
- Reaproveitar `obterVisaoGeral`, `listarCampanhas`, `listarDecisoes` em `src/lib/luma.functions.ts`; adicionar funções de aprovar/recusar decisão com verificação de expiração e de `agent_stopped` no servidor.
- Gráficos com `recharts`; tabelas com componentes shadcn já presentes.
- Rotas sob `_authenticated`, dados via TanStack Query.
- `head()` próprio em cada rota.
