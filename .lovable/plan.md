# Conectar a conta do Meta Ads no navegador antes de coletar

Hoje o botão "Coletar agora" cria uma tarefa na nuvem e a tela só mostra "Em andamento" para sempre: não existe passo de login, o link da sessão ao vivo quase nunca aparece (o serviço devolve o endereço da sessão em outra consulta, que o código não faz) e não há prazo máximo. Sem login na Meta, o agente fica parado numa tela de entrar e a coleta nunca termina.

A correção é separar em dois passos explícitos: **1) Conectar conta** (você entra no Meta/Google dentro da janela do navegador na nuvem, e o login fica salvo no perfil) e **2) Coletar agora** (só habilitado depois que a conta está conectada).

## O que muda na tela de Integrações

- Cada plataforma em modo "Navegador na nuvem" ganha o estado da conta: **Não conectada** / **Conectada em <data>**.
- Botão **"Conectar conta do Meta Ads"**: abre uma sessão de navegador na nuvem já na página de login e mostra a janela ao vivo **embutida na própria tela** (com link para abrir em aba nova). Você digita e-mail/senha e faz o 2FA ali dentro, como se fosse seu navegador.
- Assim que o agente detecta que o Gerenciador de Anúncios abriu logado, a sessão encerra sozinha, a conta é marcada como conectada e o perfil (cookies/sessão) fica salvo para as próximas coletas.
- **"Coletar agora"** fica desabilitado enquanto a conta não estiver conectada, com o motivo escrito abaixo do botão. Depois de conectada, roda sem pedir login de novo.
- Durante a coleta a mesma janela ao vivo é exibida, com o passo atual em português — dá para ver o que o robô está fazendo.
- Prazo máximo: se a conexão passar de 10 minutos ou a coleta passar de 15 minutos sem terminar, a execução é marcada como falha com explicação ("o login não foi concluído a tempo"), em vez de ficar girando eternamente.
- Botão **"Desconectar conta"**: apaga o perfil salvo no serviço e volta o estado para não conectada.

## Observações

- O login é feito por você, dentro da sessão; a LUMA não guarda e-mail nem senha da Meta/Google — só a referência do perfil no serviço de navegador.
- Cada sessão do navegador na nuvem consome créditos do Browser Use; a conexão é rápida e acontece uma vez só (até a Meta expirar a sessão).

## Detalhes técnicos

- `src/lib/luma/browser.server.ts`:
  - nova `obterSessao(chave, sessionId)` chamando `GET /sessions/{id}` para pegar `liveUrl`/`publicShareUrl`; `iniciarColeta` e `consultarColeta` passam a devolver também `sessionId` e a resolver o `liveUrl` por essa rota quando a resposta da tarefa não trouxer.
  - nova `iniciarLogin({ chave, plataforma, perfilId })`: tarefa com instrução em PT-BR ("abra a página de login, aguarde a pessoa entrar, confirme que o Gerenciador carregou e finalize"), `maxSteps` baixo, sem `structuredOutput`, e saída simples `{ logado: boolean }`.
  - nova `excluirPerfil(chave, perfilId)` para o botão de desconectar.
- Migração: em `browser_collections`, colunas `connected_at timestamptz` e `session_id text`; em `browser_collection_runs`, coluna `kind text not null default 'COLLECT'` (`LOGIN`|`COLLECT`) e `session_id text`. RLS/GRANTs seguem o padrão já usado nessas tabelas.
- `src/lib/luma/coleta.server.ts`:
  - `dispararLogin(sb, ws, plataforma)` cria/reaproveita o perfil e registra a execução com `kind = 'LOGIN'`.
  - `dispararColeta` passa a exigir `connected_at` preenchido, com mensagem orientando a conectar primeiro.
  - `acompanharColeta` trata os dois tipos: em `LOGIN` concluído grava `connected_at`; aplica os limites de tempo (10 min login / 15 min coleta) marcando `FAILED` com mensagem em PT-BR; sempre atualiza `live_url`.
  - `desconectarConta(sb, ws, plataforma)` limpa `profile_id`/`connected_at` e apaga o perfil no serviço.
- `src/lib/luma.functions.ts`: `conectarContaNavegador` e `desconectarContaNavegador` (com `requireSupabaseAuth` e bloqueio pelo botão PARAR AGENTE); `obterColetaNavegador` devolve o estado de conexão por plataforma.
- `src/components/luma/ColetaNavegador.tsx`: selo de conexão, botão conectar/desconectar, `iframe` da sessão ao vivo (com fallback em link), motivo do botão desabilitado e polling já existente reaproveitado para os dois tipos de execução.
