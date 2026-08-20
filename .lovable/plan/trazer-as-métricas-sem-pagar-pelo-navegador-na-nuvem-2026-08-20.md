# Trazer as métricas sem pagar pelo navegador na nuvem

O custo do Browser Use não vem do modelo de IA: vem do navegador que roda na nuvem deles (por isso a mensagem de "créditos"). Trocar o cérebro por GPT não elimina essa cobrança, e um navegador rodando de graça exigiria a sua máquina — que você não quer.

A saída sem custo de navegador e sem nada instalado no seu computador é deixar o painel exportar o relatório (Meta e Google Ads exportam CSV/Excel em dois cliques) e a LUMA ler esse arquivo com o GPT, usando a chave da OpenAI que já está no projeto. O trabalho de "entender a planilha" é exatamente o que a IA faz bem e custa centavos por importação.

## O que muda para você

Nas Integrações, a origem dos dados passa a ter uma quarta opção: **Importar relatório (grátis)**.

1. No Gerenciador de Anúncios (Meta) ou no Google Ads, exporte o relatório de campanhas do período desejado — ou simplesmente selecione a tabela na tela e copie.
2. Na LUMA, arraste o arquivo (CSV, TSV ou Excel) ou cole o texto no campo de importação.
3. A LUMA mostra uma prévia: quantas campanhas foram lidas, gasto, receita, ROAS e CPA por campanha, e avisa se algo ficou sem entender.
4. Você confirma e os números entram como dados reais — as mesmas telas de Visão Geral, Campanhas, Decisões e Diagnóstico passam a usá-los.

Detalhes que evitam dor de cabeça:

- A IA reconhece os cabeçalhos em português e inglês (Gasto/Amount spent/Cost, Compras/Conversões/Conversions, Valor de conversão/Purchase conversion value), números no formato brasileiro (1.234,56) e moeda com R$.
- Importar de novo o mesmo período **substitui** aquelas campanhas em vez de somar, então não há risco de duplicar. Se quiser começar do zero, a limpeza de dados já criada continua disponível ao lado.
- Como é dado real, o modo demonstração pode ser desligado com essa origem ativa (hoje isso só vale para API e navegador).
- A coleta por navegador continua existindo, mas deixa de ser a única alternativa à API oficial e passa a avisar, antes de disparar, que aquele caminho consome créditos pagos do serviço.

## Sobre as outras opções gratuitas

- **API oficial (Meta e Google Ads)**: é a única forma 100% automática sem custo por coleta. Exige cadastrar as credenciais de desenvolvedor, algo que já está pronto na tela de chaves.
- **Navegador na nuvem**: automático, mas sempre pago por sessão, seja qual for o modelo de IA usado.
- **Importar relatório**: sem custo de infraestrutura, só o custo baixo da leitura pelo GPT; precisa dos seus dois cliques para exportar.

## Detalhes técnicos

- Novo valor `IMPORT` no enum `collection_mode` (migração), reaproveitando a tabela `browser_collections` como configuração de origem por plataforma.
- Nova tabela `import_batches` (workspace, plataforma, período, quantidade de campanhas, resumo) com RLS por dono, para registrar cada importação no histórico e no Diagnóstico.
- `src/lib/luma/importacao.server.ts`: recebe o conteúdo colado ou o arquivo já convertido em texto, monta o prompt de normalização, chama `chamarIa` em modo JSON estrito e devolve `CampanhaExterna[]`; ids estáveis no formato `import-<plataforma>-<hash do nome>` para que reimportações substituam em vez de duplicar.
- Arquivos Excel são convertidos para texto no navegador (biblioteca de leitura de planilha no cliente) antes de irem ao servidor; CSV/TSV seguem como texto puro. Limite de tamanho e de linhas por importação para não estourar o contexto do modelo, com divisão em lotes quando necessário.
- Gravação reutiliza `gravarCampanhas` de `src/lib/luma/sync.server.ts` (com `account_id` = `importacao`) e registra um `sync_runs` com status `SUCCESS`.
- Novas server functions em `src/lib/luma.functions.ts`: `analisarImportacao` (prévia, não grava) e `confirmarImportacao` (grava), ambas com `requireSupabaseAuth`.
- Novo componente `src/components/luma/ImportarRelatorio.tsx` na página de Integrações, ao lado da coleta por navegador.
- `alternarPreferenciaWorkspace` passa a aceitar origem `IMPORT` como fonte real ao desligar o modo demonstração; `ColetaNavegador` ganha o aviso de custo antes de iniciar a coleta paga.
