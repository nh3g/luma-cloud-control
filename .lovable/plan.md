# Limpeza da ficção + conferência completa da LUMA

As 9 fases do plano original estão concluídas, então não há "próxima fase". Esta rodada faz duas coisas: remover o que não tem como funcionar de verdade e conferir, tela por tela, se tudo o que ficou realmente funciona.

## 1. Remover o Agente de Navegador (dispositivos e computadores)

Sai por completo: era um painel para parear um aplicativo instalado no seu computador, e esse aplicativo não existe.

- Tela "Agente de Navegador" e o item no menu lateral.
- Ponte de comunicação com o dispositivo (endpoint de heartbeat, logs e pedidos de aprovação do robô).
- Motor de intenção de tarefa em linguagem natural do robô local e o pareamento por código de 8 dígitos.
- Tabelas de dispositivos, execuções, logs e aprovações do robô no banco.
- Bloco de "dispositivo" na tela de Diagnóstico e qualquer referência sobrante.

Fica mantido: canal de execução por API/simulado nas decisões (isso funciona), Acesso MCP (é um endereço web real que assistentes externos consultam) e o modo demonstração com dados fictícios brasileiros, com o selo bem visível.

## 2. Conferência completa, tela por tela

Cada item abaixo é testado no navegador com uma conta real de teste, incluindo caso de erro:

- **Entrar / criar conta**: cadastro, login, senha fraca, e-mail já usado, sair da conta.
- **Visão Geral**: números batendo com o banco, gráfico legível, avisos de decisão pendente/aprovada, tour de boas-vindas.
- **Campanhas**: busca, filtros de plataforma e status, ordenação por cada coluna, estado vazio.
- **Decisões**: aprovar, recusar, expirar sozinha, executar, bloqueio quando o agente está parado, mensagem quando a campanha mudou.
- **Relatórios**: períodos, comparativo e download do CSV.
- **Estrategista**: conversa nos dois modos, proposta caindo na fila de aprovação, mensagem clara se a IA falhar.
- **Integrações**: gravar chaves Meta e Google, conectar/desconectar, switch de sincronização automática, switch de modo demonstração (com aviso do porquê quando não pode desligar), sincronizar agora, histórico.
- **Configurações**: cada campo do motor de regras salva e valida limites; gerar e revogar chave MCP.
- **Notas**: criar, renomear, salvar sozinho, apagar, limite de 20.
- **Parar agente**: bloqueia análise, execução, estrategista e sincronização enquanto ligado.

Toda falha encontrada é corrigida na mesma rodada. Onde hoje um campo aceita valor inválido sem avisar, entra validação com mensagem em português dizendo o formato esperado.

## 3. Chaves reais de Meta e Google

Você disse que tem as credenciais mas ainda não cadastrou. A tela de Integrações vai ganhar, em cada plataforma, a explicação curta de qual valor colar em cada campo e onde encontrá-lo, além de um teste de conexão que responde "credencial válida" ou o motivo exato da recusa — assim dá para saber se o problema é a chave ou a aplicação. Quando você cadastrar, eu valido a busca real de campanhas.

## Detalhes técnicos

- Remoção: `src/routes/_authenticated/agente-navegador.tsx`, `src/lib/luma/companion.server.ts`, `src/lib/luma/roteador.ts`, `src/routes/api/public/companion/rpc.ts`, funções de companion em `src/lib/luma.functions.ts`, ferramentas de companion em `mcp.server.ts`, item do menu em `AppLayout.tsx`, bloco correspondente em `diagnostico.tsx`.
- Migração: `DROP TABLE` de `browser_agent_approvals`, `browser_agent_logs`, `browser_agent_runs`, `companion_devices` e dos enums exclusivos deles; `execution_channel` mantém `BROWSER` apenas se ainda houver linhas históricas, senão também sai.
- Auditoria feita com Playwright em desktop e mobile, mais checagem de tipos; correções aplicadas nos arquivos afetados.
- Teste de credenciais: nova função de servidor que faz uma chamada de leitura mínima em cada API e devolve o erro traduzido.
