# ADM 04 — Workflow humano: implementação e validação

Data: 15/10/2026 · Ambiente: DEV · Projeto Supabase: `tbioidswvkfbnyedulrg`.

O workflow humano está implementado e homologado com banco e funções no Supabase DEV e frontend estático local conectado a esse ambiente. Foram aprovados 17 testes automatizados, a suíte SQL local e remota, 31 cenários HTTP, a regressão pública completa e as verificações visuais descritas abaixo.

Fonte funcional: [plano aprovado](adm-04-workflow-humano-plano.md). Evidências: [pasta ADM 04](evidencias/adm-04/).

## A. Ambiente

| Componente | Ambiente utilizado |
|---|---|
| Workspace | `C:\Users\kalle\OneDrive\Área de Trabalho\numora\numora-main\numora-main` |
| Origem do checkout | Cópia local sem diretório `.git`; sem commit ou push nesta execução |
| Runtime | Node.js 24.19.0; dependências instaladas pelo lockfile |
| Aplicação | Next.js 16.3.0, React 19, export estático e trailingSlash |
| Banco isolado | PGlite com pgcrypto/citext, aplicando todo o histórico de migrations |
| Banco DEV | Supabase PostgreSQL `17.6.1.155` |
| Vínculo CLI | `supabase/.temp/project-ref` aponta para `tbioidswvkfbnyedulrg` |
| Frontend DEV | Servidor local em `127.0.0.1:3000`, conectado ao Supabase DEV |
| Base path homologado | `/numora` no export estático |

Foram lidos `AGENTS.md` e os guias locais da versão instalada do Next.js sobre export estático, basePath e componentes cliente. A configuração pública de DEV foi salva em `.env.local`, ignorado. Credenciais de serviço foram usadas somente em memória pelos scripts de homologação.

## B. Migrations aplicadas

Antes do rollout, as 13 migrations históricas locais coincidiam com o histórico remoto. As quatro tabelas novas estavam ausentes, não havia múltiplos briefings FINAL por diagnóstico nem referências atuais inconsistentes de avaliação/briefing no preflight.

| Migration incremental | Conteúdo | DEV |
|---|---|---|
| `20261015000100_admin_workflow_schema.sql` | Estado, notas, overrides, hipóteses, auditoria, snapshots, proteção de artefatos e inicialização SYSTEM | Aplicada |
| `20261015000200_admin_workflow_commands.sql` | Autorização, policy SQL, fontes, locks, idempotência, recibos e comandos transacionais | Aplicada |
| `20261015000300_admin_workflow_read_models.sql` | Lista compatível, detalhe v4, notas e históricos paginados | Aplicada |
| `20261015000400_admin_workflow_conflict_transport.sql` | Conflitos de domínio com SQLSTATE de aplicação e lock compatível com verificações de FK | Aplicada |
| `20261015000500_admin_workflow_hypothesis_shapes.sql` | Leitura/revisão de hipóteses públicas em objeto com `text` e legadas em string | Aplicada |

A quarta migration foi acrescentada após a homologação concorrente: o retorno de um conflito com SQLSTATE `40001` demorava pela API. O conflito de domínio passou a usar `P0001`, mantendo a mensagem `STATE_CONFLICT`/`STALE_STATE` e o HTTP 409 da Edge. O lock do diagnóstico passou a `FOR NO KEY UPDATE`, que serializa escritores sem disputar os locks KEY SHARE das FKs de idempotência. O CLAIM concorrente foi repetido e aprovado no DEV.

A quinta migration mantém compatibilidade com o formato real do gerador público: objetos `{text, sourceType, confirmed}` e strings legadas são identificados pelo texto e seu hash. Nenhum corpo histórico foi convertido. A leitura e a decisão humana dos dois formatos foram testadas localmente e na suíte SQL remota, sem alteração de score.

A correção de `criterion_evidence_links_evidence_item_id_fkey` foi explicitamente aprovada pelo PO: `NO ACTION DEFERRABLE INITIALLY DEFERRED` substitui RESTRICT na migration nova. A remoção isolada de evidência referenciada continua rejeitada; a exclusão transacional do diagnóstico completo funciona.

Schema final:

| Estrutura | Resultado |
|---|---|
| `diagnostic_review_states` | Relação 1:1; nove estados, quatro prioridades, responsável, versões, revisões analíticas e archive administrativo |
| `diagnostic_internal_notes` | Append-only; seis categorias; texto entre 1 e 4.000 caracteres; autoria/data/comando |
| `diagnostic_field_overrides` | SET/REVERT append-only, cadeia por campo/versão, base, valores, motivo, fonte e suporte |
| `diagnostic_hypothesis_reviews` | Decisões append-only por origem/hash/versão; ausência de decisão representa PENDING |
| `admin_audit_events` | Estrutura existente ampliada; recibo durável, entidade, versões e motivo |
| `diagnostic_flag_events` | REOPENED, ator, perfil, comando e suporte; razão original da flag preservada |
| Snapshots e artefatos | Referências de input, hash/dependências e origem de geração; proteção do conteúdo histórico |
| Segurança | RLS habilitado e forçado nas tabelas novas; grants do navegador revogados; RPCs reservadas ao serviço |

Evidências: [histórico local/remoto](evidencias/adm-04/migrations-dev.txt), [SHA-256 das migrations novas](evidencias/adm-04/migration-hashes.json), [schema/RLS/grants](evidencias/adm-04/schema-dev.json), [SQL DEV](evidencias/adm-04/sql-dev.txt).

## C. Edge/functions publicadas

| Função | Versão observada | Estado |
|---|---:|---|
| `admin-diagnostic-workflow` | 3 | ACTIVE |
| `admin-diagnostic-detail` | 3 | ACTIVE |
| `admin-diagnostics-list` | 4 | ACTIVE |

Deploy pelo CLI com `--use-api --import-map supabase/functions/deno.json`. O primeiro deploy, sem import map explícito, foi rejeitado pelo bundler; a publicação com o mapa existente foi confirmada. O inventário publicado está em [functions-dev.json](evidencias/adm-04/functions-dev.json).

As funções administrativas usam `verify_jwt=false` no gateway e validam explicitamente o Bearer com `auth.getUser`, perfil ativo e role dentro do handler existente. Anônimo, visitante sem perfil, VIEWER escritor e perfil inativo foram recusados. O serviço permanece exclusivamente no backend.

Método, origem, JSON, limite de 32 KiB, schemas estritos, rate limit por ator/ação e respostas `no-store` são verificados. Os origins locais e `https://mkallenbach.github.io` receberam OPTIONS 204 com a configuração remota existente.

`ADMIN_WORKFLOW_COMMANDS_ENABLED=true` foi configurado somente no DEV. Ausência da configuração ou valor `false` bloqueia mutations e mantém as leituras.

Comandos implementados:

```text
CLAIM · ASSIGN · UNASSIGN · SET_STATUS · SET_PRIORITY · ADD_NOTE
CREATE_OVERRIDE · REVERT_OVERRIDE · REVIEW_HYPOTHESIS
RESOLVE_FLAG · REOPEN_FLAG
RECALCULATE_QUALIFICATION · REGENERATE_BRIEFING · ARCHIVE · REOPEN
```

As leituras `READ`, `HISTORY` e `LIST_ASSIGNEES` têm projeções próprias. O diretório limita páginas a 50 perfis ativos elegíveis; os históricos usam cursor timestamp/UUID com páginas de 25.

## D. Cenários testados

| Verificação | Resultado | Evidência |
|---|---|---|
| Testes Node/TSX de domínio, SQL integrado e frontend | 17 aprovados, zero falhas | [test-results.txt](evidencias/adm-04/test-results.txt) |
| Reconstrução de todas as 18 migrations e cenários SQL | Aprovada | [sql-local.txt](evidencias/adm-04/sql-local.txt) |
| Mesmos cenários SQL no PostgreSQL remoto, com rollback | Aprovados | [sql-dev.txt](evidencias/adm-04/sql-dev.txt) |
| Cenários HTTP autenticados no DEV | 31 aprovados | [http-results.json](evidencias/adm-04/http-results.json) |
| Recálculo e briefing após o último deploy | Ambos criaram v3 | [final-edge-check.json](evidencias/adm-04/final-edge-check.json) |
| Fluxo público de ponta a ponta | Aprovado | [public-results.json](evidencias/adm-04/public-results.json) |
| Lint e tipos frontend/Edge | Aprovados | [static-checks.txt](evidencias/adm-04/static-checks.txt) |
| Build com `/numora` | Aprovado; 13 páginas estáticas | [build-basepath.txt](evidencias/adm-04/build-basepath.txt) |
| Chave service_role DEV no export estático | Zero ocorrências em 90 arquivos | [bundle-check.json](evidencias/adm-04/bundle-check.json) |

Os cenários cobrem payload adulterado, paths proibidos, valores incompatíveis, permissões, concorrência, replay, key reuse, rollback de auditoria, privacidade, contatos, evidências de outro diagnóstico, snapshots, versões, retenção, histórico e compatibilidade dos contratos anteriores.

## E. Matriz de permissões validada

| Operação | VIEWER | CONSULTANT | ADMIN |
|---|---|---|---|
| Ler projeções permitidas | Sim | Sim | Sim |
| CLAIM sem responsável | Não | Para si, fora de BLOCKED/ARCHIVED | Para si, nas mesmas condições |
| ASSIGN/reassign/unassign | Não | Não | Destino ADMIN/CONSULTANT ativo; motivo na redistribuição/remoção |
| Operar caso de outro responsável | Não | Não | Conforme elegibilidade/estado |
| LOW/NORMAL/HIGH | Não | Caso próprio, sem retirar URGENT | Sim |
| Definir/retirar URGENT | Não | Não | Motivo obrigatório |
| Notas/overrides/hipóteses | Não | Caso próprio elegível | Caso elegível |
| Flags S0–S2 não críticas | Não | Caso próprio elegível | Sim, com condições da fonte |
| S3, CONSENT e SECURITY | Não | Não | Suporte e validação reforçados |
| Recalcular/regenerar | Não | Caso próprio concluído/elegível | Caso concluído/elegível |
| Archive/reopen e BLOCKED | Não | Não | Motivo e condições atuais |

Perfil inativo e visitante não operam. Nenhuma dessas permissões altera consentimentos, respostas originais ou dispara contato externo. O navegador VIEWER foi inspecionado e apresentou zero controles de escrita: [evidência](evidencias/adm-04/viewer-readonly.jpg).

## F. Concorrência

Toda mutation verifica as versões esperadas do workflow e do diagnóstico após adquirir os locks e revalidar o perfil. Artefatos computados fora da transação também exigem o fingerprint atual das fontes no commit.

Duas requisições HTTP simultâneas de CONSULTANT disputaram o mesmo diagnóstico sem responsável: exatamente uma venceu; a outra recebeu `STATE_CONFLICT`/409. Fontes alteradas entre preparação e commit foram rejeitadas sem inserir avaliação. Não há overwrite silencioso.

## G. Idempotência

Ator/diagnóstico/comando são associados à chave do cliente e ao hash do pedido. O sucesso, o recibo e o audit são gravados juntos. O recibo durável na auditoria permite replay após a limpeza do cache de idempotência. Replay revalida as permissões atuais e não duplica notas, avaliações ou briefings.

Reusar a chave com outro conteúdo foi recusado. Timeout e falha de rede preservaram a mesma chave e versões no teste do hook; editar o conteúdo gerou nova tentativa. Recarregar após conflito atualizou as versões e limpou a tentativa antiga.

## H. Auditoria

Um trigger de teste forçou falha na inserção do audit. Nota, versão e idempotência sofreram rollback na mesma transação. O corpo completo das notas não é copiado para `admin_audit_events`; o evento referencia entidade, categoria, comando e versões permitidas.

A timeline paginada reúne origens pública e administrativa em projeção explícita. Notas, overrides, hipóteses e eventos continuam append-only. A limpeza final das fixtures preservou 21 recibos históricos: [cleanup-dev.json](evidencias/adm-04/cleanup-dev.json).

## I. Overrides/evidência

O resolvedor canônico é compartilhado pelo detalhe, recálculo e briefing. Aplica override vigente compatível com a fonte, depois base estruturada válida e resposta original elegível. Se a base mudar, o override antigo fica desatualizado e deixa de ser aplicado.

A allowlist tem 26 paths de empresa/cargo, desafio, processo, impacto, contexto de compra e contexto técnico. IDs, autenticação, consentimentos, status público, score, rotas, flags, e-mail e telefone ficam excluídos.

UNVERIFIED pode aparecer internamente, mas remove a evidência anterior daquele campo do cálculo. VERIFIED exige suporte e gera evidência própria SYSTEM_DERIVED, sem reutilizar a prova do valor antigo ou criar resposta falsa de visitante. Prova de outro diagnóstico foi rejeitada.

SET/REVERT preservam raw/normalized/display originais e a confirmação do visitante, registram motivo, autoria, versão, fonte e suporte, incrementam a revisão analítica e tornam dependentes stale. REVERT volta à base atual, sem reviver um SET antigo.

O formulário mostra original permitido, estruturado, override, efetivo, versão, data e motivo. O histórico paginado expõe autoria e cadeia: [override mobile](evidencias/adm-04/override-320.jpg).

## J. Flags

Os únicos estados continuam ACTIVE/RESOLVED. REOPENED é evento, com autoria, comando, motivo e suporte. Eventos UPDATED representam mudanças relevantes, e a razão original da flag é preservada quando uma pessoa resolve/reabre.

Resolver exige condição canônica satisfeita. S3/CONSENT/SECURITY exigem ADMIN e suporte. A resolução de `COMMERCIAL_CONTACT_NOT_ACCEPTED` não concede autorização de contato. A Edge antiga recebe REOPENED projetado como UPDATED quando o pedido não usa a versão nova do contrato.

## K. Qualification

Reutiliza a matriz determinística existente. Cada recálculo cria novo snapshot de input, avaliação, dimensões, critérios, links exatos de evidência e novo ponteiro vigente. O conteúdo anterior fica preservado. O commit confere fontes e versões antes da troca.

O snapshot registra schema, hash, versão do diagnóstico, revisão analítica, dados estruturados, dependências de evidência/overrides/hipóteses/consentimentos e referências dos artefatos atuais. Nome pessoal, e-mail e telefone não são incluídos na projeção estruturada desse snapshot administrativo.

QUALIFIED administrativo exige conclusão pública, avaliação atual compatível, informação suficiente, contato permitido e ausência de S3. Um teste com score 10 confirmou que não foi criado threshold fixo para a decisão humana. Mudanças relevantes preservam a decisão histórica e sinalizam “Decisão precisa de revisão”.

## L. Briefing

A regeneração cria snapshot e nova versão FINAL, liga a anterior como SUPERSEDED e troca o ponteiro atomicamente. A origem por artefato é registrada como DETERMINISTIC e `fallbackUsed=false`; artefatos legados sem registro exibem origem não registrada.

Notas não são usadas na geração. Overrides sem verificação e inferências não entram silenciosamente como fatos. Decisões de hipóteses são rastreadas por origem/hash/versão; confirmar não altera score. Hipóteses rejeitadas permanecem no histórico, e a geração determinística não as reapresenta como fatos nem herda decisões por similaridade.

Campos longos são resumidos na cópia narrativa conforme os limites dos contratos existentes; o input integral permanece no snapshot. Recusa de contato força NO_OFFER. S3 ativo mantém bloqueio na rota.

## M. Archive/reopen

Archive usa somente o estado/timestamp administrativos, exige ADMIN e motivo e preserva prioridade, assignment e histórico. Novas operações operacionais ficam bloqueadas. Foi confirmado por SQL e HTTP que `diagnostics.status`, `diagnostics.archived_at` e a versão pública não são alterados pelo archive.

REOPEN calcula BLOCKED para impedimento crítico atual, depois NO_CONTACT_PERMISSION quando não há contato permitido e, nos demais casos, UNDER_REVIEW. Não restaura uma decisão QUALIFIED antiga.

## N. Mobile/a11y

Verificações realizadas no navegador com a aplicação conectada ao DEV:

- Larguras 430, 390, 375 e 320 px sem overflow horizontal da página.
- Modal de override em 320 px dentro da viewport, com rolagem interna.
- Título/descrição/labels, foco inicial, ciclo Tab/Shift+Tab, Escape e retorno ao botão de origem.
- Nota adicionada pela interface, preservando autoria/data do servidor.
- VIEWER com notas legíveis e ações de escrita ausentes; logout removeu o conteúdo administrativo.
- Reflow ampliado a 200% por harness CSS `zoom:2`, com viewport interna de aproximadamente 640 px, sem overflow horizontal. O navegador embutido não aplicou o atalho de zoom nativo; esta evidência é de simulação de reflow, não de ajuste do zoom do navegador.
- Export estático: login, lista, navegação ao detalhe e assets com prefixo `/numora`.

O teste React/DOM confirmou rascunho após falha, conflito e refresh da mesma sessão; retry com chave preservada; nova chave ao editar; invalidação seletiva e limpeza no logout. Foram corrigidos o carregamento interrompido pelo replay de effects e o close prematuro do diálogo no StrictMode.

Evidências: [dialog 320](evidencias/adm-04/dialog-320.jpg), [notas 320](evidencias/adm-04/notes-320.jpg), [reflow 200%](evidencias/adm-04/reflow-200-percent.jpg), [export estático](evidencias/adm-04/static-basepath.jpg).

## O. Regressão

ADM 01: login, validação de perfil, roles, refresh, logout, guard e shell reutilizados. ADM 02: listagem, filtros, paginação, cards e contratos anteriores preservados; workflow acrescenta status, prioridade, responsável real e filtro de archive. ADM 03: sete seções com NOTES e leitura lazy; seções não afetadas permanecem no cache e as afetadas são invalidadas.

O roteiro público remoto executou autenticação anônima, start, dois consentimentos, identificação, entrevista dinâmica, revisão, confirmação, conclusão e retry da conclusão. A resposta pública permaneceu sem score, flags, briefing ou metadados administrativos; o diagnóstico novo recebeu NEW/NORMAL/sem responsável independentemente da avaliação automática.

A janela de rate limit existente foi respeitada, incluindo espera e retry da mesma solicitação. Os cenários não exigiram desativar proteção ou publicar alterações no fluxo público.

O build normal e o build com `/numora` foram aprovados. A navegação estática foi testada em servidor local; a publicação em GitHub Pages não foi executada nesta cópia sem metadados Git.

## P. Limitações

- Homologação realizada com contas sintéticas descartáveis no DEV, frontend local e backend remoto. Produção e GitHub Pages não foram publicados nesta execução.
- As verificações mobile usam viewport de desktop. Teclado virtual e leitores de tela em aparelhos físicos não foram ensaiados; a verificação de reflow ampliado está descrita em N.
- O mecanismo de briefing administrativo do MVP é determinístico. Não foi acrescentada integração de IA ou integração comercial externa.
- As versões legadas mantêm as projeções resumidas de histórico. A interface nova oferece histórico completo paginado pela operação HISTORY.
- Não foi criado usuário administrativo permanente. A homologação e suas credenciais temporárias foram removidas ao final.

## Q. Pendências e operação

Nenhum bloqueio funcional encontrado para o escopo implementado no DEV. A publicação externa do frontend depende do checkout Git e do pipeline da equipe. O acesso operacional requer um perfil interno permanente provisionado pelo processo do ADM 01.

Para executar localmente com a configuração pública já presente em `.env.local`:

```powershell
npm run dev
# Acesso de desenvolvimento: http://localhost:3000/adm/

# Export com a estrutura usada no GitHub Pages:
$env:NEXT_PUBLIC_BASE_PATH = '/numora'
npm run build
npm run preview:dev
# Preview: http://127.0.0.1:3000/numora/adm/
```

Os comandos equivalentes executados nesta estação usaram o Node/CLI local porque npm não estava no PATH padrão. `test`, `test:sql` e `preview:dev` foram acrescentados ao package.json.

Rollback operacional no DEV:

```powershell
npx supabase secrets set ADMIN_WORKFLOW_COMMANDS_ENABLED=false --project-ref tbioidswvkfbnyedulrg
```

Isso desabilita comandos sem remover schema, dados ou histórico. Para uma nova homologação descartável, executar `node scripts/homologate-admin-workflow-dev.mjs`, opcionalmente o roteiro público, e finalizar com `node scripts/homologate-admin-workflow-dev.mjs --cleanup`. Os scripts exigem o ref DEV exato e mantêm credenciais temporárias somente na pasta ignorada `.temp` até a limpeza.

## R. Resultado final e entrega

**ADM 04 — WORKFLOW HUMANO: IMPLEMENTADO E HOMOLOGADO EM DEV? SIM**, no ambiente e nos limites de validação documentados acima.

| Requisito | Status | Evidência |
|---|---|---|
| 1. Resumo executivo | Concluído | Introdução e resultado desta seção |
| 2. Arquivos criados | Entregues | Inventário abaixo |
| 3. Arquivos alterados | Entregues | Inventário abaixo |
| 4. Migrations | 5 aplicadas | B e histórico remoto |
| 5. Schema final | Implantado | B; SQL local/DEV |
| 6. Edge de workflow | ACTIVE v3 | C e inventário de funções |
| 7. Quinze commands | Implementados | C; SQL e HTTP |
| 8. Permissões | Validadas | E; VIEWER no navegador |
| 9. Workflow/transições | Implementados | Estados aprovados; SQL de transições inválidas, gates e motivos |
| 10. Assignment/claim | Implementados | SQL e disputa HTTP com um vencedor |
| 11. Notas | Append-only | Retry, audit rollback, paginação e nota criada na UI |
| 12. Overrides | Rastreáveis | I; originais preservados e prova própria |
| 13. Hipóteses | Revisão humana | SQL/HTTP e histórico separado, sem alteração automática de score |
| 14. Flags | ACTIVE/RESOLVED | J; REOPENED, S3 e razão original |
| 15. Qualification | Versionada | Avaliações v1–v3; snapshots; stale commit recusado |
| 16. Briefing | Versionado | Briefings v1–v3, SUPERSEDED e NO_OFFER |
| 17. Archive/reopen | Administrativo | M; status público preservado |
| 18. Concorrência | Aprovada | F; CLAIM real e versões |
| 19. Idempotência | Aprovada | G; recibo durável e key reuse |
| 20. Auditoria | Transacional | H; rollback forçado e 21 recibos preservados |
| 21. Segurança | Validada no escopo | RLS/grants, schemas, sessão/perfil, CORS e serviço fora do browser |
| 22. Mobile/a11y | Verificado conforme N | Screenshots e testes de foco/teclado |
| 23. Testes | 17 + SQL + 31 HTTP aprovados | D e pasta de evidências |
| 24. Lint | Aprovado | static-checks.txt |
| 25. Typecheck frontend | Aprovado | static-checks.txt |
| 26. Typecheck Edge | Aprovado | static-checks.txt |
| 27. Build | Aprovado | build-basepath.txt e screenshot do export |
| 28. Rollout DEV | Concluído | Migrations, funções e comandos habilitados; frontend estático validado |
| 29. Limitações | Explicitadas | P |
| 30. Pendências | Sem bloqueio funcional DEV | Q; publicação externa/acesso permanente são passos operacionais |

### Arquivos criados

```text
supabase/migrations/20261015000100_admin_workflow_schema.sql
supabase/migrations/20261015000200_admin_workflow_commands.sql
supabase/migrations/20261015000300_admin_workflow_read_models.sql
supabase/migrations/20261015000400_admin_workflow_conflict_transport.sql
supabase/migrations/20261015000500_admin_workflow_hypothesis_shapes.sql
supabase/functions/admin-diagnostic-workflow/index.ts
supabase/functions/_shared/admin-workflow-contract.ts
supabase/functions/_shared/admin-workflow-policy.ts
supabase/functions/_shared/admin-effective-data.ts
supabase/functions/_shared/admin-workflow-artifacts.ts
src/features/admin/workflow-contract.ts
src/features/admin/admin-workflow-client.ts
src/features/admin/useAdminWorkflow.ts
src/features/admin/AdminWorkflowActions.tsx
src/features/admin/AdminWorkflowDialog.tsx
src/features/admin/AdminInternalNotes.tsx
src/features/admin/AdminFieldOverrideDialog.tsx
src/features/admin/AdminHypothesisReview.tsx
src/features/admin/AdminWorkflowHistory.tsx
scripts/test-admin-workflow-sql.mjs
scripts/homologate-admin-workflow-dev.mjs
scripts/homologate-public-dev.mjs
scripts/serve-static-dev.mjs
tests/admin-workflow/database.ts
tests/admin-workflow/workflow.test.ts
tests/admin-workflow/frontend.test.tsx
supabase/tests/admin_workflow.sql
docs/adm-04-workflow-humano-validacao.md
docs/evidencias/adm-04/*
```

O plano `docs/adm-04-workflow-humano-plano.md` foi entregue na etapa anterior.

### Arquivos alterados

```text
.env.example
package.json
package-lock.json
tsconfig.json
supabase/config.toml
supabase/functions/_shared/admin-diagnostic-detail-contract.ts
supabase/functions/_shared/admin-diagnostics-contract.ts
supabase/functions/admin-diagnostic-detail/index.ts
src/features/admin/admin-diagnostic-detail-client.ts
src/features/admin/admin-diagnostics-client.ts
src/features/admin/admin-transport.ts
src/features/admin/AdminAuthProvider.tsx
src/features/admin/AdminDiagnosticDetail.tsx
src/features/admin/AdminDiagnostics.tsx
src/app/adm/admin.css
```

Os arquivos gerados de domínio não foram editados manualmente. A aplicação de migrations foi incremental e preservou as migrations históricas.
