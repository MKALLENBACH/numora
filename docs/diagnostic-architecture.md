# Arquitetura da entrevista de diagnóstico

## Fronteiras

```text
Navegador
  Next.js estático + Supabase Auth anônimo
        |
        | HTTPS + JWT + idempotency key
        v
Supabase Edge Functions
  validação, ownership, estado, rate limit e redação
        |
        | operações atômicas
        v
PostgreSQL/Supabase
  RLS, constraints, histórico, auditoria e dados internos
        |
        | somente quando AI_ENABLED=true
        v
Provider de IA server-side com timeout, retry e fallback
```

O frontend nunca executa backend do Next.js. Route Handlers e Server Actions não são usados porque o deploy oficial é estático.

## Fonte da verdade

O servidor determina estado, etapa, pergunta atual e transição permitida. O cliente mantém somente rascunhos e dados necessários para preservar a edição durante uma falha recuperável.

A máquina de estados segue esta sequência principal:

```text
INTRODUCTION -> PRIVACY_CONSENT -> COMMERCIAL_CONSENT -> IDENTIFICATION
-> CHALLENGE -> CURRENT_PROCESS -> IMPACT -> BUYING_CONTEXT
-> REVIEW_GENERATING -> REVIEW_PENDING -> COMPLETING
-> COMPLETED | COMPLETED_NO_CONTACT
```

Estados terminais adicionais: `BLOCKED`, `EXPIRED` e `ABANDONED`.

## Separação pública e interna

Contratos públicos podem retornar identificação da sessão, estado público, etapa, pergunta, progresso, revisão e capacidades de navegação. Eles não podem conter:

- score ou classificação;
- flags ou motivos internos;
- evidências;
- rota comercial;
- briefing;
- prompt, provider ou erro técnico.

Os módulos de score, flags e briefing não são importados por Client Components.

## Fluxo de mutação

1. Validar payload com Zod.
2. Validar JWT e obter `auth.uid()`.
3. Aplicar CORS e rate limit.
4. Verificar ownership e estado atual.
5. Validar idempotency key e `row_version`; na edição da revisão, conferir também a versão esperada dentro da mesma transação que bloqueia e substitui a revisão atual.
6. Redigir conteúdo sensível antes de persistir.
7. Executar a operação em transação/RPC.
8. Registrar evento e auditoria sem conteúdo analítico bruto.
9. Retornar somente o estado público atualizado.

## Versionamento

Diagnóstico, catálogo, árvore de decisão, score, flags, mensagens, schema e política possuem versão persistida. Cada resposta registra ainda `question_version` e um mapa normalizado `caminho -> valor`, usado para reconstruir todos os campos extraídos ao retomar a entrevista; respostas legadas sem esse mapa recorrem ao valor bruto no caminho principal. O MVP opera com o catálogo `1.0.0`. Antes da primeira alteração incompatível, a Edge Function deverá selecionar o runtime pela `interview_version` registrada ou encerrar com segurança os diagnósticos ainda ativos; a versão persistida, sozinha, não torna o runtime atual retrocompatível.

O catálogo e o runtime determinístico usados pelas Edge Functions são gerados a partir dos módulos canônicos em `src/features/diagnostic/domain`. Rode `npm run diagnostic:generate` após uma mudança e `npm run diagnostic:check-generated` para verificar a paridade.
