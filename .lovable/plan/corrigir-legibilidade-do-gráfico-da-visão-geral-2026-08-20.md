# Corrigir legibilidade do gráfico da Visão Geral

## O problema

O gráfico "Investimento x Receita" usa cores no formato `hsl(var(--token))`, mas os tokens do tema estão definidos como hex (`#8b97ad`, `#273144`, etc.). O resultado é uma cor inválida, e o navegador cai no preto padrão do SVG — por isso os números dos eixos e as linhas de grade somem contra o fundo escuro.

## O que muda

- Trocar todas as cores do gráfico para os tokens diretos (`var(--muted-foreground)`, `var(--primary)`, `var(--border)`, `var(--card)`), de forma que eixos, grade e áreas voltem a respeitar o tema escuro.
- Aumentar o contraste dos rótulos: números dos eixos em `--foreground` levemente esmaecido, com fonte um pouco maior, e linhas de grade mais discretas.
- Tooltip legível: fundo do cartão, texto em `--foreground`, borda e sombra do tema, além do nome da série destacado.
- Adicionar uma legenda curta ("Investimento" / "Receita") para identificar as duas áreas sem depender só da cor.
- Diferenciar melhor as duas séries: Investimento em tom neutro claro, Receita no azul de acento, ambas com preenchimento em degradê suave.

## Detalhes técnicos

- Arquivo único: `src/routes/_authenticated/index.tsx` (bloco `AreaChart`, linhas ~183–227).
- Sem mudanças de dados, consultas ou lógica de negócio — apenas apresentação.
- Verificação: checagem de tipos e captura de tela do gráfico no navegador para confirmar contraste.
