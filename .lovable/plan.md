# Corrigir a página inicial do Meta Ads no navegador na nuvem

Hoje, ao conectar/coletar, a sessão abre direto em `adsmanager.facebook.com/adsmanager/manage/campaigns`. Sem sessão salva, a Meta redireciona para `business.facebook.com/business/loginpage/`, que é uma tela pouco amigável e às vezes trava o agente.

A correção é partir da página oficial do Gerenciador de Anúncios em português e, a partir dela, seguir para o painel.

## O que muda

- Passo **Conectar conta (Meta)**: a janela ao vivo abre em `https://pt-br.facebook.com/business/tools/ads-manager`. Você clica em "Ir para o Gerenciador de Anúncios" / faz login e o 2FA ali dentro. O agente aguarda, sem digitar nada, até o painel logado aparecer, e então marca a conta como conectada.
- Passo **Coletar agora (Meta)**: se a sessão já estiver logada, o agente vai direto ao painel de campanhas; se cair na página inicial ou na tela de login, ele parte de `https://pt-br.facebook.com/business/tools/ads-manager`, entra no Gerenciador e continua a leitura dos números.
- Google Ads continua como está.

## Detalhes técnicos

- `src/lib/luma/browser.server.ts`:
  - `urlInicial('META', conta)` passa a devolver `https://pt-br.facebook.com/business/tools/ads-manager`; o ID numérico da conta (`act_...`), quando existir, deixa de ir na URL e passa a ser instrução textual ("no seletor de contas escolha a conta X").
  - `iniciarLogin` usa a mesma URL inicial para META, com instrução em PT-BR: abrir a página, clicar no botão de acesso ao Gerenciador, aguardar o login manual, confirmar que o painel de campanhas carregou e responder `LOGADO`.
  - `instrucao('META', ...)` ganha um primeiro passo explícito: "a partir desta página, entre no Gerenciador de Anúncios (botão de acesso); se cair em tela de login, aguarde a pessoa entrar" antes de ir para Campanhas e ajustar o período.
- Sem mudanças de banco, de UI ou de fluxo de estados.
