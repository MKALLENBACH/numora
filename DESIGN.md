---
version: alpha
name: NUMORA
description: Precisão operacional — clareza para decidir, da apresentação institucional à análise humana.
colors:
  ground: "#FFFFFF"
  subtle: "#F7F9FB"
  ink: "#0B1F33"
  muted: "#5B6570"
  signal: "#3DD9EB"
  link: "#087589"
  control: "#7C8995"
typography:
  display:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: 600
    letterSpacing: -0.035em
  body:
    fontFamily: Inter
    fontSize: 16px
    lineHeight: 1.62
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 16px
  md: 24px
  lg: 48px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.sm}"
    padding: 0.7rem 1.15rem
---

## Overview

A NUMORA é uma consultoria de transformação operacional. Sua comunicação precisa ajudar decisores a compreender o problema, organizar informações e avaliar caminhos de execução.

A direção aprovada é **Precisão operacional — clareza para decidir**. A assinatura visual vem do mapa existente de pessoas, processos, dados e tecnologia integrados à operação. O site apresenta a abordagem; a entrevista organiza o contexto; o painel apoia a análise humana. As três experiências compartilham tokens, com densidades e escalas adequadas ao uso.

## Colors

- **Ground — #FFFFFF:** superfície predominante para leitura e trabalho.
- **Subtle — #F7F9FB:** agrupamento discreto de conteúdos e contexto do workspace.
- **Ink — #0B1F33:** cor oficial; títulos, texto de destaque, ações principais e foco em superfícies claras.
- **Muted — #5B6570:** texto secundário legível sobre branco.
- **Signal — #3DD9EB:** ciano oficial; relações no mapa, indicadores e detalhes da identidade. Texto pequeno sobre branco usa o token `link`.
- **Link — #087589:** links e indicações textuais em ciano escuro, com contraste mínimo de 4,97:1 nas superfícies claras utilizadas.
- **Control — #7C8995:** limites funcionais dos campos e botões secundários. Bordas decorativas usam `line`.

Os estados semânticos estão em `src/styles/tokens.css`: sucesso, atenção e erro têm texto e superfície próprios. Um estado sempre recebe uma descrição textual. Em superfícies escuras, o foco usa o ciano oficial.

## Typography

Inter variável, entregue localmente por `next/font/local`; pesos de 100 a 900 disponíveis no arquivo, com 400–600 predominantes na interface. A fonte e a licença SIL OFL estão em `src/app/fonts/`. Fonte original: [repositório oficial Inter](https://github.com/rsms/inter/tree/master/docs/font-files), arquivo `InterVariable.woff2`.

| Contexto | Título | Texto |
|---|---|---|
| Hero institucional | até 64 px; 38–42 px no celular | 16–18 px |
| Seção institucional | 28–44 px | 16–18 px |
| Entrevista e página auxiliar | 28–40 px | 16 px |
| Administração | H1 24–32 px; H2 20–24 px | 14–16 px; metadados a partir de 13 px |

Títulos têm peso 600 e espaçamento moderado. Rótulos usam caixa normal. Números visíveis representam sequências reais, versões, prioridades ou dados recebidos.

## Layout

Contêiner principal de até 78 rem e recuos fluidos. O hero combina texto e mapa em proporção aproximada de 7/5; o mapa mantém a relação horizontal em telas pequenas. Parágrafos de leitura usam até 60–70 caracteres por linha quando o contexto permite.

A narrativa institucional tem oito seções principais, preservando as 12 âncoras anteriores: início e posicionamento; desafios; atuação; abordagem e jornada; entregáveis; critérios e diferenciais; públicos; diagnóstico e filosofia.

A entrevista usa uma superfície plana, uma pergunta por vez e seis etapas públicas. A escala administrativa é menor para permitir comparação, leitura de procedência e acesso às ações. Até 900 px, a navegação administrativa passa para o menu móvel existente.

## Elevation & Depth

Conteúdo permanente usa bordas, alinhamento e espaço. Elevação fica reservada aos diálogos e ao menu de ações sobreposto. A entrevista dispensa halo radial e sombra de cartão. Painéis internos evitam acumular caixas dentro de caixas.

## Shapes

Raio de 4 px nos controles e 8 px em painéis e diálogos. Círculos ficam restritos a marcadores de progresso e estado. O mapa operacional usa linhas e retângulos que representam entradas, integração e resultados.

## Components

Botões principais usam azul-marinho e texto branco; secundários usam contorno funcional. Controles têm alvo de pelo menos 44 px, foco de 3 px e estados de hover, ativação e indisponibilidade. Links em conteúdo têm diferenciação textual e visual. Diálogos preservam confinamento e devolução de foco.

O CTA institucional é **“Resolva o seu problema agora!”**, acompanhado de **“Comece pelo diagnóstico inicial da sua operação.”** A entrada da entrevista permanece **“Começar diagnóstico”**. Destinos e comportamento habilitado/desabilitado continuam sendo definidos pela configuração existente.

Menu, rodapé, logotipo, mensagens de salvamento, validação e avisos de revisão usam os componentes existentes. O movimento respeita `prefers-reduced-motion`.

## Do's and Don'ts

- Reutilizar os tokens globais e seus aliases semânticos em todas as páginas.
- Preservar logotipo, Inter, azul-marinho e ciano oficiais.
- Manter estados da entrevista, análise humana, qualificação, prioridade e contato claramente identificados.
- Preservar perguntas, obrigatoriedade, consentimento, contratos e permissões.
- Usar o mapa operacional existente como assinatura; manter números apenas onde existe ordem ou dado real.
- Evitar paleta dourada, serifas, fotografias ilustrativas, KPIs inventados, gradientes decorativos e títulos com uma palavra colorida por efeito.
- Evitar numeração decorativa de categorias e a mesma aparência de cartão em todos os conteúdos.
- Manter visíveis os avisos de ambiente DEV e de política em revisão enquanto forem verdadeiros.
