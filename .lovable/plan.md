# Ajustes na coleta por navegador

Três pontos travam o uso hoje: o campo de conta parece obrigatório, o botão "Coletar agora" fica desabilitado e o modo demonstração não pode ser desligado quando a origem escolhida é o navegador.

## 1. Campo de conta deixa de ser exigência

- O campo passa a se chamar **"Conta (opcional)"**, com texto de ajuda: o navegador usa a conta em que você já está logado; preencha só se a sua conta de anúncios tiver várias contas e você quiser fixar uma.
- Sem preenchimento, a tarefa abre o painel padrão do usuário (já é o comportamento do backend) e a instrução para o agente diz para usar a conta ativa.
- Se o campo for preenchido na Meta, aceitar tanto `act_123...` quanto só o número, e também o nome da conta — sem bloqueio por formato.

## 2. "Coletar agora" sempre disponível quando faz sentido

- O botão só fica desabilitado quando o serviço de navegador não está configurado ou já há coleta rodando.
- Ao clicar, a configuração atual (origem, conta, período) é salva automaticamente antes de disparar — some a dependência de clicar em "Salvar configuração" primeiro.
- Se a origem escolhida não for "Navegador na nuvem", o clique explica em uma mensagem curta que é preciso escolher essa origem, em vez de o botão ficar morto sem explicação.
- Quando o botão estiver desabilitado, mostrar o motivo abaixo dele.

## 3. Modo demonstração pode ser desligado com coleta por navegador

- A regra atual só aceita sair do modo demonstração se existir uma integração conectada por API. Passa a aceitar também quando alguma plataforma estiver com origem "Navegador na nuvem" salva.
- Ao salvar a origem como navegador, a plataforma é registrada como conta conectada (origem: navegador), para que Visão Geral, Campanhas, Sincronização e Diagnóstico reconheçam esses dados como reais.
- A sincronização deixa de simular números para as plataformas em modo navegador: ela usa os dados da última coleta em vez de gerar variações fictícias.
- A mensagem de erro passa a citar as duas saídas: conectar por API oficial ou configurar a coleta por navegador.

## Detalhes técnicos

- `src/components/luma/ColetaNavegador.tsx`: rótulos/ajuda do campo de conta, regra de habilitação do botão, salvar-antes-de-coletar, motivo do bloqueio.
- `src/lib/luma/coleta.server.ts`: `salvarColeta` cria/atualiza a linha em `integrations` (status `CONNECTED`, metadados indicando origem navegador) quando o modo é `BROWSER`, e volta a `DISCONNECTED` quando sai desse modo.
- `src/lib/luma.functions.ts` (`alternarPreferenciaWorkspace`): aceitar coleta por navegador como fonte real ao desligar o modo demonstração.
- `src/lib/luma/sync.server.ts`: plataformas em modo `BROWSER` não entram na simulação; a sincronização informa que os números vêm da coleta por navegador.
- `src/lib/luma/browser.server.ts`: normalizar a conta informada (aceitar com ou sem `act_`) e ajustar a instrução quando não houver conta.
