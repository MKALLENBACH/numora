# Catálogo de perguntas

## Princípios

O catálogo é declarativo, tipado, versionado e independente de React, Supabase e IA. Cada pergunta declara etapa, texto, finalidade, tipo de resposta, criticidade, validação, condições, limites de esclarecimento, destinos estruturados e dimensões de score relacionadas.

## Ordem e limites

O orquestrador prioriza consentimento, identificação, perguntas críticas, obrigatórias, condicionais de alto valor, específicas por área e opcionais. A meta é de 12 a 18 perguntas; após 18, perguntas opcionais e específicas são omitidas; após 20, apenas críticas; em 24, a coleta termina e as lacunas são registradas.

Perguntas específicas por área são limitadas a duas. Esclarecimentos são limitados por pergunta e a quatro por sessão.

## Condições

Uma condição somente pode usar fatos confirmados, estado atual e contadores fornecidos ao orquestrador. Ausência não equivale a `false`. Campos desconhecidos devem permanecer `null` ou usar enum explícito de desconhecido.

## Como adicionar uma pergunta

1. Adicione uma entrada com identificador estável e versão do catálogo.
2. Declare validação e condição sem acessar banco, relógio global ou IA.
3. Mapeie os `targetPaths` permitidos.
4. Defina prioridade e criticidade.
5. Adicione testes para exibição, omissão, ordem, limite e esclarecimento.
6. Atualize a documentação e incremente a versão do catálogo.

Não altere uma pergunta já utilizada sem avaliar compatibilidade com diagnósticos em andamento.

## Tipos de resposta

O renderer público suporta texto curto/longo, escolha única/múltipla, número, número com unidade, faixa monetária, data, sim/não, escala e confirmação. Valores persistidos usam códigos estáveis; rótulos em português ficam no catálogo público.

