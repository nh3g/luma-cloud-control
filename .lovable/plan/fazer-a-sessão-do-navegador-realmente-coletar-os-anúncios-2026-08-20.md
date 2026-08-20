# Fazer a sessão do navegador realmente coletar os anúncios

Na captura, a janela já está logada no Gerenciador de Anúncios com a campanha na tela — mas o robô continua parado ali. Motivo: a tarefa aberta é do tipo **LOGIN**, e a instrução dela manda literalmente "apenas espere, recarregando de tempos em tempos, até o painel logado aparecer". Por isso a página fica reiniciando e nada é lido: essa tarefa não tem instrução de coleta nem formato de saída.

A correção é acabar com a separação em duas tarefas cobradas e fazer **uma sessão só**: entrar (se precisar) e, assim que o painel estiver logado, ler as campanhas e devolver os números.

## O que muda para você

- Um único botão **"Abrir navegador e coletar"** por plataforma. Se a conta ainda não estiver logada, a janela ao vivo abre na tela de login, você entra (e faz 2FA) ali dentro; o robô aguarda **sem ficar recarregando** e, quando o painel aparece, segue sozinho para Campanhas, ajusta o período e lê os números.
- Ao terminar, a conta é marcada como conectada (perfil salvo) e as campanhas entram no banco na mesma execução — não precisa clicar de novo.
- Nas próximas vezes, como o login já está salvo, ele vai direto para os números.
- A janela ao vivo para de piscar/recarregar a cada consulta de andamento.
- O botão "Conectar conta" continua existindo apenas como ação opcional de login isolado; "Desconectar" segue igual.

## Detalhes técnicos

- `src/lib/luma/browser.server.ts`
  - `iniciarColeta` passa a receber o passo de login embutido: primeiro item da instrução vira "se aparecer tela de login/entrada, **não digite nada** e **não recarregue a página**; apenas aguarde (espera passiva, verificando a cada poucos segundos) até o Gerenciador de Anúncios logado aparecer, depois continue".
  - Remover das instruções (login e coleta) qualquer menção a "recarregando de tempos em tempos" — é o que causa o reinício contínuo da página.
  - Reconhecer também o painel já logado (`adsmanager.facebook.com/adsmanager/manage/campaigns`) como ponto de partida válido, sem voltar para a página institucional.
  - Aumentar `maxSteps` da coleta (60 → 120) para caber espera de login + leitura da tabela.
  - `consultarColeta`: ler o resultado também de `output.campaigns` quando vier aninhado em `doneOutput`/`result`, e registrar em `erro` quando a tarefa termina sem JSON válido.
- `src/lib/luma/coleta.server.ts`
  - `dispararColeta` deixa de exigir `connected_at` (o login acontece dentro da própria sessão).
  - Em `acompanharColeta`, quando uma execução `COLLECT` termina com campanhas, gravar `connected_at` na `browser_collections` (a sessão logada ficou salva no perfil).
  - Limite da coleta sobe de 15 para 25 minutos, já que inclui o login manual.
- `src/components/luma/ColetaNavegador.tsx`
  - Botão principal renomeado para "Abrir navegador e coletar", habilitado mesmo sem `connected_at` (só exige chave + origem "Navegador na nuvem").
  - `iframe` com `key` fixa por plataforma e `src` congelado no primeiro `live_url` recebido (via `useRef`/estado local), para não remontar a cada polling.
  - Texto de apoio explicando que, se a janela pedir login, é só entrar por ali que a coleta continua sozinha.

Sem mudanças de banco.
