# LUMA v3 — Fase 1: Fundação, autenticação e layout

Escopo desta fase: base visual, login/cadastro e navegação. Sem tabelas de domínio, sem motor de regras, sem integrações.

## 1. Backend (Lovable Cloud)

Ativar o backend integrado (banco, autenticação, funções). Nesta fase apenas:

- Tabela `workspaces`: `id`, `owner_id`, `name` ("Meu workspace"), `demo_mode` (true), `onboarding_completed` (false), `agent_stopped` (false), `profile_color` ('#6f8cff'), `profile_avatar` ('user'), timestamps.
- RLS por dono: cada usuário só lê/edita o próprio workspace (GRANTs explícitos).
- Trigger em novo usuário: cria automaticamente o workspace com os defaults acima.
- Autenticação e-mail/senha com confirmação automática de e-mail ligada (para não travar testes).

## 2. Identidade visual

Design system em `src/styles.css` (dark por padrão, tokens semânticos — nada hardcoded):

- fundo `#090b10`, superfície `#111621`, borda `#273144`
- acento `#6f8cff`, link `#82aaff`
- sucesso emerald-500, alerta amber-500, perigo red-500
- densidade alta, tipografia técnica, estética Linear/Vercel, sem ilustrações

## 3. Telas de autenticação

Rota pública `/auth` com abas Entrar / Criar conta, 100% PT-BR, validação de formulário, mensagens de erro traduzidas, redirecionamento para `/` após login.

## 4. Layout do app

Subárvore protegida (redireciona para `/auth` sem sessão) com:

- **Sidebar fixa** (ícones lucide): Visão Geral, Campanhas, Decisões, Estrategista, Agente de Navegador, Integrações, Notas, Configurações, Diagnóstico.
- **Topbar**: badge DEMO (amber, enquanto `demo_mode`), nome do workspace, avatar com a cor do perfil, e botão vermelho fixo **PARAR AGENTE**.
- **PARAR AGENTE**: diálogo de confirmação; grava `agent_stopped=true`; quando parado, exibe faixa "Agente parado" com botão Reativar. Presente em todas as páginas.

## 5. Páginas

Cada rota da sidebar recebe uma página com cabeçalho, selo visível `NOT_IMPLEMENTED` e descrição curta do que a fase futura entrega. `/` é a Visão Geral (substitui o placeholder do template).

## Detalhes técnicos

- Rotas: `src/routes/auth.tsx` (pública) e `src/routes/_authenticated/*` sob o layout gerenciado com `ssr: false`.
- Estado do workspace via TanStack Query (`useSuspenseQuery` + loader), assinando Realtime só nas fases seguintes.
- `head()` próprio em cada rota (título/descrição PT-BR).
- Formatação e métricas ficam para a Fase 3; nada de números fictícios em tela nesta fase.

## Fora do escopo (fases seguintes)

Schema completo + seed demo + tour (F2), Visão Geral/Campanhas reais (F3), motor de regras e decisões (F4), OAuth e sync (F5), execução real (F6), IA (F7), notas/diagnóstico/companion (F8).
