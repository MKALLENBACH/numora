# Score, flags e encaminhamento interno

## Score determinístico

O score interno varia de 0 a 100 e não usa LLM para atribuição de pontos.

| Dimensão | Peso |
| --- | ---: |
| Aderência NUMORA | 20 |
| Clareza do problema | 15 |
| Impacto operacional | 20 |
| Impacto financeiro | 15 |
| Urgência | 10 |
| Decisão e execução | 10 |
| Dados e viabilidade | 10 |

Cada critério pontuado precisa de evidência confirmada. Informação ausente não ganha nem perde pontos; reduz o peso avaliado.

Campos estruturados são preenchidos automaticamente somente com extração de alta confiança (`>= 0,85`) e fonte confirmável. Extrações médias permanecem `NOT_CONFIRMED`; extrações abaixo de `0,60`, inferências, respostas puladas, sentinelas de desconhecimento e conteúdo redigido não preenchem campos nem pontuam.

```text
normalizedScore = earnedPoints / assessedWeight * 100
finalScore = min(normalizedScore, completenessCap)
```

Caps de completude: alta `100`, média `79`, baixa `59` e insuficiente sem score final. Resultados intermediários usam duas casas e o score final é arredondado ao inteiro mais próximo.

## Classificação

- `PRIORITY`: 80–100
- `QUALIFIED`: 60–79
- `INVESTIGATION`: 40–59
- `LOW_FIT`: 0–39

Classificação e score são internos.

## Flags

Flags são determinísticas, versionadas, auditáveis e não descontam score silenciosamente. Uma flag ativa é única por diagnóstico/código e mudanças geram eventos append-only.

- S0: informativa.
- S1: atenção.
- S2: revisão manual obrigatória e sem encaminhamento automático.
- S3: impeditiva ou terminal conforme regra explícita.

`COMMERCIAL_CONTACT_NOT_ACCEPTED` não bloqueia conclusão, mas impede contato. `TEMPORARY_EMAIL` bloqueia a identificação até correção.

## Rota interna

A precedência é `BLOCKED`, `OUT_OF_SCOPE`, `NO_CONTACT`, `MANUAL_REVIEW`, `NURTURE` e somente então rota por score. Nenhuma rota cria reunião ou compromisso automático.

## Como alterar regras

1. Crie uma nova versão do score ou catálogo de flags.
2. Mantenha a matriz de critérios explícita.
3. Adicione testes para pontos, evidências, cap, precedência e não duplicidade.
4. Não recalcule diagnósticos históricos sem migração e decisão de produto documentadas.
