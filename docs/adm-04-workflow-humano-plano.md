# ADM 04 — Workflow humano
## NUMORA · ADM MVP · Planejamento técnico e funcional

**Data:** 15/10/2026  
**Situação:** proposta para aprovação; implementação em tarefa separada.  
**Base:** inspeção do código e das migrations presentes no repositório após ADM 03.  
**Entrega desta tarefa:** somente este documento, conforme solicitação posterior do PO por um arquivo Markdown. Não foram implementadas funcionalidades, executadas migrations, realizados deploys, commits ou pushes.

Este documento distingue **existente** de **proposto**. A inspeção local não comprova quais migrations estão aplicadas no Supabase DEV nem substitui testes no ambiente publicado. Não foi consultado ou alterado banco remoto.

## A. ESTADO ATUAL RELEVANTE

### A.1. ADM 01–03 encontrados

| Área | Estado encontrado | Consequência para ADM 04 |
|---|---|---|
| ADM 01 | admin_profiles, ADMIN/CONSULTANT/VIEWER, is_active, autenticação, recuperação, sessão, logout, shell e guard de navegação | Reutilizar a fundação; acrescentar autorização por comando |
| Autorização real | requireAdminUser valida Bearer com Auth getUser, rejeita usuário anônimo e consulta perfil ativo; requireRole verifica role | Toda mutation deve passar por esses helpers e por validação transacional |
| Proteção de rotas | AdminRouteGuard é client-side; recursos administrativos são protegidos no backend | O HTML estático não é uma fronteira de autorização |
| Sessões | Cliente administrativo usa storageKey própria: numora.admin.auth.v1 | Preservar separação entre visitante e equipe |
| ADM 02 | Edge admin-diagnostics-list, RPC administrativa, filtros, paginação, tabela e cards mobile | Estender a projeção existente com workflow; não recriar a listagem |
| Assignment na lista | Contrato e UI já possuem assignee; a RPC retorna null | Preencher o contrato existente com responsável real |
| ADM 03 | Edge admin-diagnostic-detail, RPC por seção, contratos Zod compartilhados, seis abas | Estender o detalhe e seu carregamento seletivo |
| Abas | OVERVIEW, INTERVIEW, QUALIFICATION, FLAGS, BRIEFING, AUDIT | Manter as abas; acrescentar NOTES/“Notas internas” como seção sob demanda |
| Transport | adminFunctionJson/adminFunctionFetch, Bearer, no-store, AbortController e timeout padrão de 20 s | Reutilizar; ampliar erros e suporte ao resultado de comandos |
| UI | Cards, badges, estados de carregamento/erro, abas por hash e retorno ao detalhe após autenticação | Evoluir o padrão visual atual |
| Dialogs | A lista usa dialog nativo, showModal, título associado e retorno de foco | Extrair componente reutilizável para formulários de mutation |
| Hosting | Next.js com output: export, trailingSlash, basePath e GitHub Pages | Backend continua em Supabase; sem Server Actions ou Route Handlers dinâmicos |

**Referências principais:**  
[supabase/functions/_shared/admin-auth.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/admin-auth.ts>)  
[supabase/migrations/20260922000100_admin_foundation.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260922000100_admin_foundation.sql>)  
[supabase/migrations/20260923000200_admin_diagnostics_list.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260923000200_admin_diagnostics_list.sql>)  
[supabase/migrations/20260925000100_admin_diagnostic_detail.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260925000100_admin_diagnostic_detail.sql>)  
[src/features/admin/AdminDiagnosticDetail.tsx](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/AdminDiagnosticDetail.tsx>)  
[src/features/admin/admin-transport.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/admin-transport.ts>)  
[next.config.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/next.config.ts>)  
[docs/deployment-strategy.md](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/docs/deployment-strategy.md>)

### A.2. Schema e conceitos existentes

| Estrutura | Conteúdo relevante real |
|---|---|
| diagnostics | status público, owner_user_id do visitante, row_version, current_assessment_id, current_briefing_id, recommended_route, archived_at |
| diagnostic_sessions | Estado e progresso da sessão pública, expiração e row_version |
| interview_answers | raw_value, normalized_value, display_value, validation_status, source_type, confirmed, revision, is_current e redacted |
| diagnostic_reviews | Resumo revisado/confirmado pelo visitante; DRAFT, PENDING_CONFIRMATION, CONFIRMED, SUPERSEDED; version e row_version |
| qualification_assessments | Avaliações versionadas, classificação, confiança, rota, is_current e índice único parcial da avaliação vigente |
| qualification_dimension_results / qualification_criterion_results / criterion_evidence_links | Decomposição da pontuação e ligação às evidências |
| evidence_items / evidence_sources | Evidência, target_path, source_type, confiança, confirmed, redacted e localizador de origem |
| diagnostic_flags | ACTIVE ou RESOLVED; severidade S0–S3; source, reason, scheduling_effect, resolution_condition e metadados |
| diagnostic_flag_events | Histórico append-only; eventos TRIGGERED, UPDATED, RESOLVED; trigger automático |
| commercial_briefings | Versões, DRAFT/FINAL/SUPERSEDED, superseded_by_id; initial_hypotheses é array JSON, projetado como strings |
| diagnostic_snapshots | Payload versionado, hash, schema_version e ligação de substituição; aproveitar para entradas de análise interna |
| consent_records | Histórico append-only com supersedes_id |
| audit_events | Auditoria pública/produto; actor_type limitado a ANONYMOUS_USER, SYSTEM e SERVICE |
| admin_audit_events | Auditoria interna já existente, atualmente limitada a login, logout, acesso negado e recuperação |
| idempotency_records | Chave única por owner_user_id + idempotency_key, hash, ação, status, resposta e expiração padrão de 24 h |
| rate_limit_counters | Contadores compartilháveis por usuário e escopo |

Não foram encontradas tabelas de estado administrativo, notas internas, overrides ou decisões humanas sobre hipóteses. Não foram encontrados status administrativos NEW/UNDER_REVIEW etc. implementados no ADM 03.

**Não confundir:**

- diagnostic_reviews é a revisão do visitante, não o workflow da equipe.
- diagnostics.owner_user_id não é o consultor responsável.
- A classificação automática QUALIFIED não é uma decisão administrativa QUALIFIED.
- A prioridade declarada projetada no ADM é uma escala de 1 a 5, distinta da prioridade interna proposta.
- admin_audit_events já existe: será ampliada, não recriada.

### A.3. Restrições que influenciam a solução

1. diagnostics.archived_at já exclui registros das consultas administrativas e participa da descoberta do diagnóstico público. Usá-lo diretamente para arquivamento interno alteraria o comportamento público.
2. A projeção administrativa de contato verifica consentimentos vigentes, anonimização de lead/empresa e COMPLETED_NO_CONTACT. Essa semântica deve ser centralizada e preservada.
3. O trigger de flag registra alterações de status, mas não mantém uma trilha completa de mudanças de severidade/motivo. Seu reason atual vem da flag, não necessariamente da justificativa humana.
4. O cálculo ignora evidências AI_INFERENCE e NOT_CONFIRMED e exige confiança mínima de 0,6. Um override visual, isoladamente, não corrige o cálculo.
5. createInterviewContext descarta evidências sem answer_id. Correções administrativas podem precisar de evidência própria, sem inventar uma resposta do visitante.
6. diagnostic_complete exige status público COMPLETING e conclui a sessão. Não deve ser chamado para recálculo administrativo.
7. A geração de briefing na conclusão pública é determinística. O adaptador externo existente em ai.ts revisa o resumo do visitante, não constitui um gerador administrativo de briefing pronto.
8. writeAdminAuditEvent é best-effort e não é transacional com mutations de domínio. Não será usado para confirmar sozinho a auditoria das novas escritas.
9. A migration de retenção apaga idempotency_records expirados; reutilização simples da chave não garante deduplicação após essa limpeza.
10. Os contratos administrativos usam Zod strict: Edge, RPC e frontend precisam evoluir de forma coordenada.
11. O detalhe mantém dados em memória por seção e remonta por usuário/diagnóstico. A renovação da autenticação hoje pode desmontar o conteúdo; preservar rascunhos durante refresh válido requer cuidado.
12. node_modules/next/dist/docs não estava disponível nesta cópia. Não houve escrita de código Next.js. Na implementação, instalar as dependências e ler os guias locais exigidos pelo AGENTS.md antes de programar.

**Referências de domínio:**  
[supabase/migrations/20260805000100_diagnostic_schema.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260805000100_diagnostic_schema.sql>)  
[supabase/migrations/20260805000200_diagnostic_integrity.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260805000200_diagnostic_integrity.sql>)  
[supabase/migrations/20260805000400_diagnostic_rls.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260805000400_diagnostic_rls.sql>)  
[supabase/migrations/20260805000500_diagnostic_retention.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260805000500_diagnostic_retention.sql>)  
[supabase/migrations/20260923000100_admin_audit_identity_retention.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260923000100_admin_audit_identity_retention.sql>)  
[supabase/migrations/20260814000400_fix_completion_criterion_link.sql](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/migrations/20260814000400_fix_completion_criterion_link.sql>)  
[supabase/functions/_shared/interview.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/interview.ts>)  
[src/features/diagnostic/domain/scoring.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/diagnostic/domain/scoring.ts>)  
[supabase/functions/_shared/handler.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/handler.ts>)

## B. MODELO DE WORKFLOW

Criar estado interno independente do status público. A lista abaixo é **proposta**, pois não há nomenclatura equivalente implementada.

| Estado | Significado | Transições permitidas | Motivo obrigatório |
|---|---|---|---|
| NEW | Ainda não analisado pela equipe | UNDER_REVIEW, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para BLOCKED e ARCHIVED |
| UNDER_REVIEW | Análise humana em andamento | NEEDS_INFORMATION, QUALIFIED, NOT_QUALIFIED, OUT_OF_SCOPE, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para NOT_QUALIFIED, OUT_OF_SCOPE, BLOCKED e ARCHIVED |
| NEEDS_INFORMATION | Faltam dados para concluir análise; não dispara contato | UNDER_REVIEW, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para BLOCKED e ARCHIVED |
| QUALIFIED | Decisão humana favorável, sujeita às condições vigentes | UNDER_REVIEW, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para retorno a análise, BLOCKED e ARCHIVED |
| NOT_QUALIFIED | Decisão humana desfavorável | UNDER_REVIEW, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para retorno a análise, BLOCKED e ARCHIVED |
| OUT_OF_SCOPE | Demanda fora do escopo NUMORA | UNDER_REVIEW, NO_CONTACT_PERMISSION, BLOCKED, ARCHIVED | Para retorno a análise, BLOCKED e ARCHIVED |
| NO_CONTACT_PERMISSION | Caso separado operacionalmente pela ausência de autorização de contato | UNDER_REVIEW, BLOCKED, ARCHIVED | Para saída do estado, BLOCKED e ARCHIVED |
| BLOCKED | Operação interna suspensa por impedimento explicitado | UNDER_REVIEW, NO_CONTACT_PERMISSION, ARCHIVED | Sempre para entrada e saída |
| ARCHIVED | Caso retirado da fila operacional e preservado para consulta | UNDER_REVIEW, NO_CONTACT_PERMISSION ou BLOCKED, exclusivamente por REOPEN | Sempre |

Regras gerais:

- Apenas as arestas desta tabela são válidas. Não há retorno a NEW nem salto direto de NEW para QUALIFIED.
- ASSIGN/CLAIM não muda status automaticamente. Assumir e iniciar análise são ações distintas.
- CONSULTANT opera somente casos atribuídos ao próprio perfil. ADMIN opera todos os casos elegíveis.
- Entrar/sair de BLOCKED, sair de NOT_QUALIFIED ou OUT_OF_SCOPE para reanálise e archive/reopen são exclusivos de ADMIN.
- Retorno de QUALIFIED para UNDER_REVIEW pode ser realizado pelo consultor responsável, com motivo.
- Uma transição para o mesmo estado, com nova chave, retorna ACTION_NOT_APPLICABLE; retry da operação original retorna o sucesso original.
- Motivos: 10–1.000 caracteres após trim. Não aceitar apenas espaços.
- QUALIFIED exige entrevista COMPLETED ou COMPLETED_NO_CONTACT, avaliação vigente e atualizada, informação suficiente, ausência de S3 ativo e contactAllowed=true. Não exige copiar um limiar de score: é uma decisão humana explícita.
- Entrada em NO_CONTACT_PERMISSION exige contactAllowed=false. A saída para UNDER_REVIEW exige contactAllowed=true; BLOCKED e ARCHIVED continuam possíveis.
- Contato não autorizado é uma restrição independente e aparece em qualquer estado. NEW não vira automaticamente NO_CONTACT_PERMISSION enquanto a entrevista ainda está coletando consentimento.
- Ao reabrir ARCHIVED, calcular o destino: BLOCKED se houver impedimento crítico vigente; senão NO_CONTACT_PERMISSION se contato não estiver autorizado; senão UNDER_REVIEW.
- Nenhuma transição altera diagnostics.status, status de sessão, consentimento ou score.
- Alterações de dados podem tornar uma decisão QUALIFIED desatualizada. Preservar a decisão histórica, sinalizar “Decisão precisa de revisão” e impedir tratá-la como liberação operacional vigente.
- BLOCKED permite somente leitura, notas e ações de saneamento por ADMIN, além das transições permitidas. ARCHIVED é somente leitura até reabertura.
- Para diagnóstico em preenchimento: permitir organização interna e notas; bloquear overrides, recálculo e regeneração. Para EXPIRED/ABANDONED ou público BLOCKED, permitir triagem e saneamento autorizado, mas não reabrir a entrevista nem qualificá-la como concluída.

Persistir também a revisão de dados sobre a qual uma decisão conclusiva foi tomada. Isso permite distinguir decisão histórica de decisão ainda compatível com os dados atuais.

## C. MATRIZ DE PERMISSÕES

“Próprio” significa diagnóstico atribuído ao perfil ativo do consultor. Todas as permissões abaixo continuam subordinadas ao estado, privacidade, concorrência e regras específicas.

| Ação | VIEWER | CONSULTANT | ADMIN |
|---|---|---|---|
| Ler lista, detalhe, notas e histórico administrativo | Sim | Sim | Sim |
| Assumir diagnóstico sem responsável | Não | Sim, para si, fora de BLOCKED/ARCHIVED | Sim |
| Atribuir, reatribuir ou remover responsável | Não | Não | Sim |
| Alterar LOW/NORMAL/HIGH | Não | Próprio | Sim |
| Definir ou retirar URGENT | Não | Não | Sim, com motivo |
| NEW → UNDER_REVIEW; NEEDS_INFORMATION ↔ UNDER_REVIEW | Não | Próprio | Sim |
| Registrar QUALIFIED/NOT_QUALIFIED/OUT_OF_SCOPE | Não | Próprio, a partir de UNDER_REVIEW | Sim, mesmas condições de domínio |
| Registrar NO_CONTACT_PERMISSION | Não | Próprio, se contato não autorizado | Sim |
| Reanalisar QUALIFIED | Não | Próprio, com motivo | Sim |
| Reanalisar NOT_QUALIFIED/OUT_OF_SCOPE | Não | Não | Sim, com motivo |
| Entrar/sair de BLOCKED | Não | Não | Sim, com motivo e validação do impedimento |
| Adicionar nota | Não | Próprio, não bloqueado/arquivado | Sim, exceto arquivado |
| Criar ou reverter override | Não | Próprio e elegível | Sim e elegível |
| Confirmar/rejeitar hipótese | Não | Próprio e elegível | Sim e elegível |
| Resolver/reabrir flag S0–S2 não crítica | Não | Próprio e elegível | Sim |
| Resolver/reabrir S3, SECURITY ou CONSENT | Não | Não | Sim, sem poder contrariar a fonte canônica |
| Recalcular qualificação | Não | Próprio, concluído e elegível | Sim, concluído e elegível |
| Regenerar briefing | Não | Próprio, concluído e elegível | Sim, concluído e elegível |
| Arquivar/reabrir diagnóstico | Não | Não | Sim, com motivo |
| Alterar consentimento ou resposta original | Não | Não | Não por este módulo |
| Contato comercial, agenda, CRM, envio | Fora do escopo | Fora do escopo | Fora do escopo |

Essas permissões de escrita são novas. O código atual confirma as três roles e seus helpers, mas não implementa essa matriz de workflow.

## D. MODELO DE DADOS

### D.1. Novas tabelas necessárias

| Tabela | Finalidade | Campos | Constraints | Índices | Histórico | Concorrência |
|---|---|---|---|---|---|---|
| diagnostic_review_states | Estado administrativo 1:1 | diagnostic_id como PK; status; priority; assignee_profile_id; assigned_at; assigned_by; row_version; analysis_revision; decision_analysis_revision; created_at; updated_at; updated_by; archived_at administrativo | FK diagnostic_id; enums por CHECK; versões positivas; assignee nullable; consistência entre assignment e timestamps; archived_at somente em ARCHIVED | PK; status/updated_at; assignee/status/updated_at; priority/updated_at | Transições em admin_audit_events | row_version por comando; analysis_revision para mudanças dos insumos analíticos |
| diagnostic_internal_notes | Notas internas append-only | id; diagnostic_id; category; body; author_user_id; author_profile_id; created_at; command_id | FK diagnóstico; categoria em allowlist; body 1–4.000 caracteres após trim; UUID de comando | diagnostic_id/created_at/id; unicidade de comando/autoria | Cada nota é imutável; correção por nova nota | Lock do estado + expectedReviewVersion; deduplicação pelo comando |
| diagnostic_field_overrides | Histórico de correções e reversões por path | id; diagnostic_id; field_path; operation SET/REVERT; version; previous_effective_value; new_value; previous_override_id; reverted_override_id; reason; source_answer_id quando existir; verification_status; evidence_ids; evidence_note; author_user_id; author_profile_id; created_at; command_id | FK diagnóstico; autor histórico; JSON validado; path em allowlist; unique diagnostic_id/path/version; referências do mesmo diagnóstico/path; REVERT aponta o SET vigente | diagnostic_id/path/version DESC; diagnostic_id/created_at; índice por comando | Append-only; ACTIVE/SUPERSEDED/REVERTED derivados da cadeia, não apagados por UPDATE | Lock do estado; versão global e head do path |
| diagnostic_hypothesis_reviews | Decisão humana sobre hipótese identificável | id; diagnostic_id; source_kind BRIEFING/EVIDENCE; briefing_id ou evidence_item_id; hypothesis_index quando briefing; source_hash; version; status; reason; supporting_evidence_ids; author_user_id; author_profile_id; created_at; command_id | Exatamente uma origem; FK e pertencimento ao diagnóstico; índice válido; hash da fonte imutável; status CONFIRMED/REJECTED; unique origem/version | Origem/version DESC; diagnostic_id/created_at; comando | Append-only; PENDING é ausência de decisão para aquela origem/versão | Lock do estado + versão da origem e revisão administrativa |

A ausência de row_version nas três tabelas append-only é intencional: não há atualização de conteúdo. A concorrência é validada no agregado diagnostic_review_states e, quando necessário, na cabeça da cadeia da entidade.

**FKs e identidade:**

- Novos registros de domínio referenciam diagnostics. A exclusão só acompanha o procedimento técnico de retenção já existente, nunca o comando ARCHIVE.
- UUIDs de autoria são históricos, sem FK que provoque SET NULL em linhas imutáveis, seguindo a correção já aplicada em admin_audit_events.
- assignee_profile_id é referência viva a admin_profiles. Ao remover um perfil, limpar assignment em fluxo controlado, incrementar versão e registrar DIAGNOSTIC_UNASSIGNED; um eventual ON DELETE SET NULL deve passar pela mesma regra transacional de auditoria.
- Perfil inativo pode continuar identificado como responsável histórico/atual inativo, mas não pode receber nova atribuição nem operar; ADMIN deve redistribuir.
- Referências a answers, evidence e briefings devem validar pertencimento ao mesmo diagnóstico, com FK composta quando aplicável ou validação SQL equivalente.
- Na limpeza de retenção, referências internas não podem gerar atualizações proibidas em eventos append-only ou bloquear a exclusão em cascata. Cobrir isso com teste de integração.

**Grants/RLS comuns:** ENABLE e FORCE RLS; revogar acesso de anon/authenticated; operações apenas por backend confiável e RPCs concedidas a service_role. A UI não recebe SELECT direto dessas tabelas.

### D.2. Estruturas existentes a ampliar ou reutilizar

| Tabela | Finalidade no ADM 04 | Campos/constraints adicionais | Índices | Histórico | Concorrência |
|---|---|---|---|---|---|
| admin_audit_events | Fonte de auditoria humana e recibo durável | diagnostic_id histórico nullable, command_id, request_hash, entity_type/id, before/after resumidos, reason sanitizado, metadata allowlisted; ampliar CHECK de eventos | diagnostic_id/created_at/id; unique parcial actor_user_id/command_id para sucesso de comando | Append-only; preservar eventos e identidades antigos | Inserção na mesma transação da mutation |
| diagnostic_flag_events | Histórico de resolução/reabertura e mudanças relevantes | REOPENED no CHECK; actor_user_id/profile_id históricos; command_id; evidence_ids; motivo da ação separado da razão original; contexto da regra | Reutilizar índice ADM 03; acrescentar comando se necessário | Append-only; único produtor de evento por mudança | Lock do diagnóstico/estado/flag |
| diagnostic_flags | Estado atual da flag | Reutilizar ACTIVE/RESOLVED e campos existentes; não criar DISMISSED nem REOPENED como estado | Manter único ativo por diagnóstico/code | Histórico em flag_events | Lock + versão do agregado; alterações públicas também detectadas via diagnostics.row_version |
| diagnostic_snapshots | Entrada consistente de cálculo/briefing | Reutilizar snapshot_type, revision, payload, payload_hash, schema_version; tipos internos ADMIN_QUALIFICATION_INPUT e ADMIN_BRIEFING_INPUT | diagnostic_id/snapshot_type/revision; unicidade por tipo/revisão | Conteúdo de snapshot interno imutável | Captura consistente + comparação de dependências no commit |
| qualification_assessments | Nova avaliação administrativa | input_snapshot_id nullable para legado; versão da política de cálculo registrada no snapshot; origem/autor via audit | Índices de versão e vigente já existentes | Resultado imutável; só is_current muda por substituição controlada | Lock e unique diagnostic_id/version |
| commercial_briefings | Nova versão administrativa | input_snapshot_id; generation_mode DETERMINISTIC/EXTERNAL nullable para legado; fallback_used nullable; não inventar origem de versões antigas | Versão única existente; acrescentar índice único parcial FINAL após saneamento de eventuais legados | Corpo imutável; status/superseded_by_id só mudam por substituição | Lock e unique diagnostic_id/version |
| evidence_items / evidence_sources | Evidência efetiva de correção e de avaliação | Reutilizar estruturas e source_locator; vincular origem administrativa como admin_override:<uuid>; adicionar integridade SQL da referência | Reutilizar e completar índice por evidência/localizador se necessário | Novas evidências, sem reescrever as antigas | Persistência junto ao override e/ou snapshot de cálculo |
| idempotency_records | Deduplicação rápida | Reutilizar tabela/helpers; namespace administrativo e validação de diagnostic_id no wrapper | Índice único existente | Cache de recibo por 24 h; recibo durável em admin_audit_events | begin/finish dentro da transação final |
| rate_limit_counters | Limites por usuário/ação | Novos scopes; nenhuma tabela nova | Índice existente | Não é histórico de negócio | RPC de consumo existente |

Sem nova tabela de assignment history, auditoria, jobs ou estados de flags. O histórico de assignment/status/prioridade está em admin_audit_events.

## E. ARQUITETURA DE MUTATIONS

| Decisão | Alternativas | Escolha | Justificativa |
|---|---|---|---|
| API administrativa | Edge por ação; Edge por domínio; command bus genérico; Edge + RPC | Uma Edge admin-diagnostic-workflow com comandos discriminados, apoiada em RPCs | Coerente com ADM 01–03, poucos endpoints e regras explícitas |
| Escritas simples | Updates separados na Edge; RPC por entidade; RPC transacional | admin_apply_diagnostic_command, com dispatch fechado e helpers SQL privados | Estado, conteúdo, versão, audit e recibo são atômicos |
| Artefatos | Executar tudo no SQL; chamar fluxo público; Edge + commit RPC | Captura de entrada consistente, cálculo na Edge, commit específico | Reutiliza motor TypeScript sem transação aberta durante processamento |
| Recálculo | diagnostic_complete; nova RPC administrativa | admin_commit_qualification | diagnostic_complete altera o fluxo público e exige COMPLETING |
| Briefing | Sobrescrever; nova versão | admin_commit_briefing | Preserva conteúdo, ponteiros e histórico |
| Leitura de workflow | Novo endpoint para tudo; extensão do detalhe | Ampliar admin-diagnostic-detail e adicionar seção NOTES | Aproveita transporte, contratos e leitura seletiva |
| Diretório de responsáveis | SELECT direto de admin_profiles; endpoint isolado; operação de leitura no domínio | Operação LIST_ASSIGNEES autenticada, paginada e limitada ao necessário | Perfil atual só permite leitura do próprio perfil; não ampliar essa política ao navegador |
| Assíncrono | Fila/job persistente; chamada limitada | Síncrono com tempo limitado e determinístico no MVP | Não existe fila/worker necessário ao escopo; timeout usa recibo para reconciliar |
| Origem dos dados | Resolvedores diferentes na UI e cálculo; resolvedor comum | Projeção interna canônica compartilhada | Evita divergência entre detalhe, qualificação e briefing |

**Comandos fechados:** CLAIM, ASSIGN, UNASSIGN, SET_STATUS, SET_PRIORITY, ADD_NOTE, CREATE_OVERRIDE, REVERT_OVERRIDE, REVIEW_HYPOTHESIS, RESOLVE_FLAG, REOPEN_FLAG, RECALCULATE_QUALIFICATION, REGENERATE_BRIEFING, ARCHIVE e REOPEN.

**Envelope:** diagnosticId, command, clientRequestId UUID, expectedReviewVersion, expectedDiagnosticVersion e payload tipado. Não aceitar actor, role, score, SQL, paths livres nem resultado de IA enviados pelo navegador.

**Resposta:** commandId, replayed, versões confirmadas, resumo atualizado do workflow, referências dos artefatos criados e invalidatedSections. Validar requisição e resposta com Zod strict.

**Fluxo simples:**

1. Validar origem, método, tamanho e JSON.
2. requireAdminUser e requireRole.
3. Consumir rate limit.
4. Executar RPC com ator derivado da sessão.
5. Na RPC, reler perfil e role, verificar autorização atual, deduplicar, bloquear registros, validar versões/estado, aplicar mudança, auditar e finalizar recibo.
6. Retornar somente projeção administrativa permitida.

Para artefatos, preparar insumos no banco em snapshot consistente, processar fora da transação e repetir validações no commit. O payload calculado só é aceito de service_role, nunca como comando do cliente.

## F. ASSIGNMENT

- CLAIM exige responsável nulo, perfil ativo elegível e versão esperada. Dois consultores concorrentes resultam em um sucesso e um conflito.
- ADMIN pode atribuir para ADMIN ou CONSULTANT ativos; VIEWER nunca é destino válido.
- REASSIGN exige motivo; UNASSIGN também. A primeira atribuição pode ter motivo opcional.
- Persistir assignee_profile_id, assigned_at e assigned_by. Ao remover, limpar os três campos atuais e preservar autor/data anteriores no audit.
- Guardar antes/depois e IDs de envolvidos, sem copiar e-mails ou dados de autenticação.
- O consultor não ganha permissão sobre caso de outro consultor por conhecer o UUID.
- UI: “Assumir diagnóstico” apenas quando não atribuído; ADMIN recebe seletor de responsável e opção explícita de remover.
- Reatribuição durante uma edição invalida a autorização anterior; o backend rejeita a gravação e a UI preserva o rascunho apenas enquanto o usuário ainda puder ler o caso.

## G. NOTAS

Categorias: GENERAL, COMMERCIAL, TECHNICAL, RISK, FOLLOW_UP e DECISION, com rótulos em português.

- Texto simples, 1–4.000 caracteres após trim; escapar na renderização, sem HTML arbitrário.
- Autor e data vêm do servidor.
- Append-only: não editar nem apagar pelo ADM. Corrigir por nova nota, podendo indicar a nota anterior.
- Nenhuma nota entra automaticamente no resolvedor de fatos, no score, em evidências ou em prompts.
- As categorias COMMERCIAL/FOLLOW_UP não iniciam contato.
- Não incluir conteúdo de nota no audit; registrar noteId e categoria.
- Aplicar prevenção de segredos antes de persistir, com mensagem segura para corrigir o texto.
- Seção com paginação, empty state “Nenhuma nota interna registrada”, contador, loading e retry.
- Falha preserva texto e categoria; retry reutiliza o clientRequestId enquanto o conteúdo não mudar.
- Em privacyRestricted, não expor notas potencialmente identificáveis nem permitir nova nota narrativa; manter apenas metadados operacionais seguros onde necessário.

## H. OVERRIDES

### H.1. Escopo e precedência

Regra única para **consumo interno**:

**Override vigente aplicável → valor estruturado vigente válido → resposta original sanitizada e elegível.**

Essa é uma regra de precedência de valor, não uma autorização automática para pontuar. Valor, fonte, confiança e elegibilidade da evidência são resolvidos juntos.

- Reutilizar a projeção e as regras de esclarecimentos de createInterviewContext, com extração de uma parte pura reutilizável quando necessário.
- Respostas SKIPPED, INVALID, redacted ou inferências não confirmadas não podem reaparecer pelo fallback como fatos.
- Considerar apenas a revisão corrente e a precedência atual de esclarecimentos válidos.
- Resolver um único valor e conjunto de evidências vigentes por path.
- Não usar textos de diagnostic_reviews como substituto indiscriminado dos campos estruturados.
- Detalhe, cálculo, briefing e futuras exportações deverão consumir o mesmo resultado canônico no backend. A UI não recalcula precedência.

**Allowlist inicial:** paths existentes do catálogo e dos tipos estruturados de lead empresarial/cargo, challenge, currentProcess, impact, buyingContext e technicalContext que tenham validação de tipo definida.

**Exclusões explícitas:** consentimentos, owner_user_id, status público, score, classificação, rota, prioridade administrativa, IDs, tokens, flags, timestamps e campos de autenticação. Identificadores/canais de contato como e-mail e telefone ficam fora dos overrides no MVP. Não permitir paths arbitrários ou prototype pollution.

### H.2. Evidência e rastreabilidade

- previous_effective_value é calculado no servidor; não confiar no “valor anterior” enviado pelo browser.
- Não modificar raw_value, normalized_value, display_value nem a confirmação do visitante.
- Cada correção registra motivo, fonte original, novo valor tipado, autor e versão.
- Correção pode ficar UNVERIFIED; nesse caso ela aparece como correção interna pendente de comprovação e sua evidência não pontua.
- Para VERIFIED, exigir evidência de suporte do mesmo diagnóstico ou justificativa de verificação humana explícita, com limite de 500 caracteres e origem rastreável.
- A projeção administrativa pode produzir evidência SYSTEM_DERIVED, identificada como derivada do override verificado, sem relabelar a evidência original como REPORTED_FACT. A confiança/eligibilidade deve seguir regra explícita; não elevar inferência antiga apenas por copiar seu valor.
- Nunca reutilizar a evidência do valor substituído como prova do novo valor sem comprovação.
- O resolvedor administrativo deve aceitar evidências de override sem answer_id e manter a ligação via evidence_sources.
- Reverter adiciona evento REVERT para o SET vigente; volta à base estruturada atual. Não reativa silenciosamente uma correção anterior.
- Se a resposta base tiver mudado, o override precisa de revisão/rebase explícito; não aplicá-lo silenciosamente sobre outra revisão.
- SET/REVERT incrementam analysis_revision e marcam qualificação, briefing e eventual decisão conclusiva como desatualizados.

### H.3. Dialog

Título: **Corrigir dado estruturado**

Aviso: **A resposta original será preservada. A correção altera apenas o valor utilizado na análise interna.**

Exibir valor original permitido, valor estruturado atual, override atual, valor efetivo, novo valor e motivo. Acrescentar origem de verificação quando o operador quiser tornar a correção elegível para análise quantitativa.

CTA: **Salvar correção**. Secundário: **Cancelar**.

“Valor original” usa somente a projeção sanitizada autorizada. O ADM 04 não libera raw_value pelo endpoint.

## I. HIPÓTESES

Há duas origens existentes relevantes: initial_hypotheses de uma versão de briefing e evidence_items de natureza inferencial/não confirmada. Não há entidade universal de hipótese com ID próprio.

- Identificar item de briefing por briefing_id + índice + hash do texto, validado no backend.
- Para evidência, usar evidence_item_id e hash da origem.
- PENDING é o estado sem revisão humana; CONFIRMED/REJECTED são decisões append-only.
- Mostrar **“Hipótese não confirmada”** para PENDING.
- Exigir motivo tanto para confirmar quanto para rejeitar; confirmar exige evidência/justificativa de suporte.
- Nova decisão sobre a mesma origem cria nova versão; não apaga a anterior.
- Nova versão do briefing não herda confirmação apenas por repetir texto semelhante.
- Hipótese rejeitada permanece no histórico e é identificada como rejeitada; não será usada como fato nem reapresentada como confirmada na regeneração.
- Hipótese confirmada aparece como “Confirmada por revisão humana”, com fonte e autor. Isso não altera o source_type original.
- **No ADM 04, revisão de hipótese não altera diretamente a pontuação.** Para influenciar um critério estruturado, executar correção explícita do path com evidência elegível e depois recálculo.
- A decisão atualiza a revisão analítica e torna o briefing desatualizado; o snapshot distingue alteração de contexto narrativo de alteração pontuável.

## J. FLAGS

Manter os estados reais **ACTIVE** e **RESOLVED**.

**REOPENED será evento**, com novo estado ACTIVE. Não introduzir DISMISSED no MVP: resolver já cobre o fechamento com justificativa; um conceito de dispensa permanente exigiria regras próprias.

| Ação | Quem | Pré-condições | Motivo/evidência | Resultado |
|---|---|---|---|---|
| Resolver S0–S2 não crítica | Responsável CONSULTANT ou ADMIN | Flag ACTIVE; condição de resolução atendida | Motivo obrigatório; evidência/justificativa verificável | RESOLVED e resolved_at |
| Reabrir S0–S2 não crítica | Responsável CONSULTANT ou ADMIN | RESOLVED; nenhum outro ativo do mesmo code | Motivo obrigatório; referência ao novo indício | ACTIVE; limpar resolved_at atual; evento REOPENED |
| Resolver/reabrir S3 | ADMIN | Validação reforçada; sem contrariar fonte de consentimento/segurança | Motivo e suporte obrigatórios | Alteração transacional e audit |
| Operar flag CONSENT/SECURITY | ADMIN | Regra canônica continua soberana, independentemente da severidade | Motivo e suporte obrigatórios | Nunca transforma recusa em aceite |
| Reavaliação por recálculo | Backend autorizado | Insumos vigentes, mesma revisão validada | Contexto determinístico da regra | Eventos de domínio para mudanças reais |

Cuidados de implementação:

- Resolver COMMERCIAL_CONTACT_NOT_ACCEPTED não pode autorizar contato. Se a recusa continua vigente, a resolução é rejeitada.
- Resolver uma S3 não desbloqueia automaticamente o status público ou o estado administrativo.
- Flag cuja condição determinística continua presente não é resolvida só por texto livre. Para condições humanas, validar a evidência exigida pelo catálogo.
- Recalcular com a condição crítica novamente presente mantém/reabre o bloqueio; não existe supressão permanente silenciosa.
- A reavaliação preserva flags MANUAL/SECURITY e não faz exclusão em massa. Ausência de uma regra no novo resultado não prova resolução de toda flag antiga.
- Registrar mudanças relevantes de severidade/motivo/efeito como UPDATED; não apenas mudanças de status.
- Evoluir record_flag_event para receber contexto transacional confiável de autor, commandId e motivo. Não inserir evento manual e deixar o trigger duplicá-lo.
- Preservar diagnostic_flags.reason como razão do achado; justificar resolução/reabertura no evento.
- Reabertura de flag antiga, quando já houver outra ACTIVE do mesmo code, retorna conflito aplicável; não viola o índice único.
- Atualizar analysis_revision e invalidar rota/qualificação/briefing conforme dependências. Revalidar impedimentos atuais mesmo que o score exibido ainda seja o anterior.

## K. RECÁLCULO DE QUALIFICAÇÃO

Reutilizar calculateQualification, evaluateFlags e determineInternalRoute a partir das fontes de domínio. Não copiar a matriz em uma nova implementação.

**Elegibilidade:** diagnóstico público concluído, consentimento de privacidade válido, identidade disponível, estado administrativo não arquivado/bloqueado e autorização atual. Falta de consentimento comercial não impede análise interna autorizada, mas mantém a restrição de contato e oferta.

Fluxo:

1. Autenticar, verificar permissão e consultar recibo da operação.
2. Capturar insumos em uma leitura transacional consistente: respostas, evidências, consentimentos, versões, overrides e decisões relevantes.
3. Construir a projeção canônica e o fingerprint das dependências. Não carregar dados por consultas desconectadas sem um marcador comum de consistência.
4. Calcular determinística e exclusivamente no backend.
5. No commit, bloquear diagnóstico e estado; reler perfil; comparar versões e dependências. Insumo alterado gera conflito, sem publicar o resultado antigo.
6. Persistir snapshot interno e evidências efetivas necessárias.
7. Criar assessment em max(version)+1 sob lock; criar dimensões, critérios e links **das evidências realmente utilizadas**, não de todas as evidências históricas de um path.
8. Marcar avaliação anterior is_current=false; apontar diagnostics.current_assessment_id para a nova; persistir rota coerente e manter automatic_scheduling_eligible=false.
9. Reconciliar flags com as regras da seção J.
10. Gravar QUALIFICATION_RECALCULATED, finalizar idempotência e incrementar revisão administrativa.
11. Marcar briefing dependente como desatualizado. Não regenerá-lo automaticamente.

Snapshot registra versão do algoritmo, versões das fontes, IDs de overrides/evidências e referências de consentimento. Resultados anteriores e seus links não são reescritos.

A função de domínio pode retornar uma versão da política; ela não substitui a sequência de versões persistidas da avaliação.

**Transação final única:** snapshot + evidências + assessment + dimensões/critérios/links + reconciliação necessária de flags + ponteiro/rota + versões + audit + recibo. Se qualquer parte falhar, rollback integral.

Dialog:

- Título: **Recalcular a qualificação**
- Texto: **Uma nova avaliação será criada com base nos dados vigentes. A avaliação anterior será preservada no histórico.**
- Loading bloqueia envio duplicado.
- Score atual permanece visível até confirmação do backend.
- Na falha, manter versão anterior e o aviso de desatualização; não simular sucesso.
- Após sucesso, informar versão criada e carregar somente seções afetadas.

## L. REGENERAÇÃO DO BRIEFING

- Reutilizar DeterministicInterviewAIService.generateBriefing e a projeção interna canônica.
- Não copiar um resumo antigo como se já incorporasse os overrides: recompor os campos narrativos a partir dos valores efetivos, preservando o resumo confirmado do visitante como fonte histórica identificada.
- Exigir avaliação vigente compatível com os insumos para compor score/rota/oferta. Se estiver desatualizada, pedir recálculo primeiro.
- Criar nova versão FINAL, marcar anterior SUPERSEDED, ligar superseded_by_id e atualizar current_briefing_id na mesma transação.
- Registrar input_snapshot_id, modo de geração e fallbackUsed reais.
- Versões antigas sem origem conhecida continuam “Origem não registrada”; não rotular retroativamente como IA ou determinísticas.
- Separar fatos, estimativas e hipóteses com decisões humanas. Notas internas não entram automaticamente.
- Sem contato autorizado, manter a sinalização e NO_OFFER; nunca sugerir que o texto concede autorização comercial.
- Consentimento, redaction e minimização são aplicados também ao artefato gerado.

**IA opcional:** o caminho completo do ADM 04 funciona com geração determinística. Não criar nova integração externa nesta etapa. O contrato comporta modo externo/fallback, mas a ativação de redação externa de briefing fica fora desta implementação até existir adaptador adequado; o adaptador atual de review não deve ser reutilizado como se já validasse briefing.

Dialog com confirmação, texto de preservação da versão anterior, loading e tratamento de conflito. Falha mantém briefing anterior. Resultado de fallback, quando aplicável, é um sucesso identificado, não um erro oculto.

O fluxo atual cabe em execução síncrona limitada. Se futuramente a latência exigir jobs, será necessária decisão arquitetural específica; não inserir uma fila sem consumidor no MVP.

## M. ARQUIVAMENTO

Usar **diagnostic_review_states.status=ARCHIVED** e seu timestamp administrativo. Não preencher diagnostics.archived_at pelo comando administrativo.

A separação é necessária porque o campo legado já controla consultas públicas e administrativas. O novo campo significa retirada da fila interna, não indisponibilidade técnica do diagnóstico público.

- Somente ADMIN, com motivo, versão e idempotência.
- Arquivar preserva responsável, prioridade e todo histórico; bloqueia novas mutations operacionais.
- Lista padrão exclui arquivados administrativamente; filtro “Arquivados” permite consulta e reabertura.
- Detalhe continua acessível a roles de leitura, com marcação visível.
- Reabrir exige motivo e deriva destino pelas condições atuais, conforme seção B.
- Não restaura automaticamente um status QUALIFIED antigo.
- Não apaga respostas, score, flags, briefing, notas ou auditoria.
- Não modifica retenção nem promete retenção indefinida. A limpeza técnica segue procedimento separado.
- Registros com diagnostics.archived_at legado não serão “desarquivados” automaticamente pelo workflow novo.

## N. AUDITORIA

Ampliar admin_audit_events e manter audit_events para o fluxo público existente. A aba AUDIT apresenta ambas as origens em uma timeline paginada, com discriminador e projeção explícita.

**Eventos de workflow propostos:**

- REVIEW_STATE_INITIALIZED
- DIAGNOSTIC_ASSIGNED
- DIAGNOSTIC_REASSIGNED
- DIAGNOSTIC_UNASSIGNED
- REVIEW_STATUS_CHANGED
- ADMIN_PRIORITY_CHANGED
- INTERNAL_NOTE_CREATED
- FIELD_OVERRIDE_CREATED
- FIELD_OVERRIDE_REVERTED
- HYPOTHESIS_CONFIRMED
- HYPOTHESIS_REJECTED
- FLAG_RESOLVED
- FLAG_REOPENED
- QUALIFICATION_RECALCULATED
- BRIEFING_REGENERATED
- DIAGNOSTIC_ARCHIVED
- DIAGNOSTIC_REOPENED

São nomes novos a acrescentar ao CHECK existente; os quatro eventos de autenticação permanecem.

Cada comando bem-sucedido produz **um evento raiz de auditoria**, usado também como recibo durável. Mudanças derivadas, como flags recalculadas, ficam em diagnostic_flag_events ligadas ao mesmo commandId. Archive/reopen não precisam gerar dois eventos raiz para a mesma mudança de status.

Conteúdo permitido: ator e perfil históricos, diagnosticId, commandId, ação, entidade, IDs de resultado, versões antes/depois, enums alterados, motivo sanitizado e hash da requisição.

Não copiar corpo de nota, respostas, valores integrais de override, prompt, briefing, JWT, senha ou tokens. Os valores completos necessários à rastreabilidade ficam nas tabelas internas específicas e com as mesmas restrições de privacidade.

Falha ao gravar auditoria de sucesso implica rollback da mutation. Negativas de acesso e falhas técnicas são eventos sanitizados separados, sem fingir que houve mudança de negócio.

Não recolocar FKs de identidade removidas pela migration de retenção. diagnostic_id histórico na auditoria também não deve provocar alteração de evento imutável durante limpeza; manter referência histórica sem conteúdo pessoal.

## O. CONCORRÊNCIA

Usar duas versões distintas:

- expectedDiagnosticVersion: detecta mudanças do fluxo público e dos ponteiros existentes.
- expectedReviewVersion: controla o agregado administrativo.

analysis_revision identifica mudanças nos insumos analíticos, sem tornar uma avaliação obsoleta apenas porque uma nota ou prioridade mudou.

**Ordem de locks:** recibo idempotente → diagnóstico → estado administrativo → entidades dependentes em ordem estável. Validar o perfil sob proteção transacional compatível com desativação/rebaixamento de role.

- Reutilizar bump_row_version onde apropriado; não somar manualmente e também por trigger.
- Todos os comandos confirmados incrementam row_version administrativo uma vez.
- Notes/assignment/prioridade não incrementam analysis_revision.
- Overrides, decisões de hipóteses e mudanças de flags alteram as revisões/dependências relevantes.
- Calcular com fontes capturadas em snapshot; o commit revalida versões, IDs correntes e fingerprint. Todos os escritores que alteram essas fontes devem obedecer à mesma disciplina de lock/versionamento.
- Enquanto o processamento da Edge ocorre, nenhuma transação fica aberta.
- Se o perfil perde role, é desativado, o caso é reatribuído ou arquivado durante o cálculo, o commit é rejeitado.

No cenário A/B, a tentativa de A com versão antiga retorna HTTP 409, sem sobrescrever B:

**Este diagnóstico foi atualizado por outro usuário. Recarregue os dados antes de continuar.**

A UI oferece recarregar, preserva texto em memória e exige nova revisão antes de reenviar. Não faz merge automático de status, flags ou decisões. Após mudança de payload/versão, cria novo clientRequestId.

## P. IDEMPOTÊNCIA

Reutilizar idempotency_records e begin_idempotency/finish_idempotency com wrapper administrativo.

- Nesse uso, owner_user_id da tabela de idempotência é o usuário interno autenticado que executa o comando, não diagnostics.owner_user_id.
- Namespace: admin + ator + diagnóstico + clientRequestId.
- Hash canônico inclui command, diagnosticId, payload e versões esperadas. Ordenar propriedades de forma determinística.
- Mesma chave e mesmo hash: retornar recibo existente.
- Mesma chave e hash/diagnóstico/ação diferentes: rejeitar como IDEMPOTENCY_KEY_REUSED.
- Autenticar e verificar permissão vigente antes de entregar replay. Perfil revogado não usa o recibo para recuperar dados.
- Para comando já concluído, checar recibo antes de comparar versões antigas; o retry legítimo não vira falso conflito.
- Nenhum retry cria outra nota, override, avaliação, briefing ou evento raiz.
- Operações rápidas reservam e finalizam idempotência na mesma transação; rollback remove a reserva não confirmada.
- O processamento de artefatos pode ser repetido em memória por concorrência, mas o commit é deduplicado e só uma versão é persistida.
- Não usar PROCESSING da infraestrutura atual como se já fosse uma fila com lease/heartbeat.

**Após 24 h:** manter recibo compacto e único no evento raiz de admin_audit_events. Se o registro rápido expirou, consultar esse recibo para impedir uma segunda execução. A limpeza de idempotency_records não apaga a prova do comando.

O recibo contém IDs/versões, não payload pessoal completo. Se a entidade já foi removida pela retenção ou deixou de ser acessível, retornar resultado seguro indicando indisponibilidade; nunca executar novamente a mesma operação para “reconstruir” conteúdo.

Timeout, cancelamento no browser ou perda de rede não provam rollback. A UI usa a mesma chave para reconciliar o resultado. Se o usuário mudar o conteúdo, não reutiliza a chave anterior.

## Q. SEGURANÇA

1. JWT verificado por requireAdminUser em toda operação; não confiar em decode local do token.
2. Perfil ativo e role atual validados novamente no commit.
3. Autor derivado no backend; corpo do cliente não define identidade ou permissões.
4. RLS, revogações e RPCs service_role-only; service role nunca no frontend.
5. Manter o padrão de verify_jwt=false das Edges administrativas apenas com autenticação explícita obrigatória dentro do handler, como já ocorre no ADM.
6. Reutilizar assertAdminOrigin/adminCorsHeaders; allowlist por ambiente, no-store e Vary: Origin.
7. Zod strict na entrada/saída; limites de bytes e listas; validação SQL das invariantes.
8. Restrição de path, IDs de entidades do mesmo diagnóstico, UUIDs e JSON tipado; SQL estático, sem campo de query dinâmica.
9. Proposta inicial de limites: 30 comandos simples/minuto/usuário, 5 gerações/minuto/usuário; limites configuráveis e refinados em DEV. Reutilizar os scopes do rate limiter.
10. Respostas 429 com Retry-After e retryAfterSeconds no contrato para uso pelo browser.
11. Reutilizar redaction/secret guards em texto livre; não registrar request bodies ou prompts em logs.
12. Erros técnicos com código de referência, sem detalhes SQL, credenciais ou conteúdo sensível.
13. Centralizar contactAllowed e privacyRestricted com a regra ADM 03. Ausência ou inconsistência de consentimento não concede permissão.
14. contactAllowed=false mantém **Contato não autorizado** visível e bloqueia qualquer futura autorização comercial, independentemente de status, flag resolvida ou score.
15. privacyRestricted bloqueia leitura narrativa e mutations de conteúdo; ADMIN conserva apenas operações mínimas de organização/saneamento que não reconstruam dados protegidos.
16. Cache/rascunhos em memória isolados por usuário/diagnóstico; limpar em logout, troca de conta ou perda de acesso. Não adicionar cache persistente de dados administrativos.
17. Snapshots internos não contêm raw_value ou segredos desnecessários e não são expostos em endpoints públicos.
18. Nenhum comando altera consent_records, eleva role ou modifica owner_user_id.

## R. UI/UX

### R.1. Header e organização

Separar dois blocos:

- **Análise interna:** status administrativo, prioridade interna, responsável.
- **Diagnóstico recebido:** situação pública, prioridade declarada, classificação automática e score.

Manter empresa, data, breadcrumb e “Contato não autorizado” visíveis. Header com ação primária contextual “Assumir diagnóstico” ou “Alterar status”; prioridade em controle compacto e demais ações em “Mais ações”.

Ações de correção, hipótese, flag, recálculo e briefing ficam próximas do conteúdo relevante. VIEWER vê dados e histórico, sem controles de escrita. Restrições relevantes devem ter explicação textual.

A presença/ausência de botões usa capabilities retornadas pelo backend como auxílio de UX; cada comando é validado novamente no servidor.

### R.2. Formulários e estados

- Labels explícitos, indicação de obrigatório e ajuda sobre motivo/evidência.
- Erro de validação junto ao campo e resumo acessível.
- Durante envio, impedir duplicidade; não fechar dialog antes da confirmação.
- Sucesso mostra o resultado confirmado, incluindo versão de artefato.
- Cancelar preserva ou descarta rascunho de forma explícita; confirmação adicional somente se houver conteúdo não salvo.
- Não inserir nota ou trocar status/score de forma otimista antes do sucesso.
- Não ocultar histórico atrás apenas de mensagens transitórias.

### R.3. Erros

| Situação | Contrato/HTTP proposto | Comportamento |
|---|---|---|
| Sessão inválida | UNAUTHORIZED / 401 | Revalidar autenticação; não afirmar que comando falhou sem consultar recibo depois |
| Role/perfil/assignment sem permissão | ACCESS_DENIED / 403 | Explicar restrição e atualizar capabilities |
| Diagnóstico inexistente/inacessível | NOT_FOUND / 404 | Estado seguro, sem revelar conteúdo |
| Concorrência | STATE_CONFLICT / 409 | Mensagem padrão, recarregar e preservar rascunho autorizado |
| Fonte/artefato desatualizado | STALE_STATE / 409 | Identificar dependência; recarregar ou recalcular |
| Ação incompatível com estado | ACTION_NOT_APPLICABLE / 409 | Mostrar condição atual |
| Reutilização indevida de chave | IDEMPOTENCY_KEY_REUSED / 409 | Não repetir; revisar conteúdo e gerar nova operação |
| Campos inválidos | VALIDATION_ERROR / 422 | Associar mensagens aos campos |
| Limite | RATE_LIMITED / 429 | Informar espera; preservar rascunho e chave |
| Backend | BACKEND_FAILURE / 503 | Código de referência e retry seguro |
| Timeout do servidor | QUERY_TIMEOUT / 504 | Resultado pode exigir reconciliação |
| Timeout/rede no cliente | REQUEST_TIMEOUT / NETWORK_ERROR | Não concluir que houve rollback; consultar/repetir mesma operação |

### R.4. Invalidação seletiva

| Mutation | Atualizar/invalidate |
|---|---|
| Assignment, status, prioridade, archive/reopen | Metadados/header, OVERVIEW, AUDIT e resultado da lista ao retornar |
| Nota | NOTES e AUDIT |
| Override/reversão | INTERVIEW/projeção efetiva, OVERVIEW, AUDIT; marcar QUALIFICATION e BRIEFING stale |
| Hipótese | BRIEFING, AUDIT e contexto narrativo dependente |
| Flag | FLAGS, OVERVIEW, AUDIT; marcar artefatos afetados stale |
| Recálculo | QUALIFICATION, FLAGS quando alteradas, OVERVIEW/header, AUDIT; BRIEFING stale |
| Regeneração | BRIEFING, OVERVIEW quando resume o briefing, AUDIT |

Manter hash da aba, scroll quando possível e dados não afetados. Seção inativa é marcada para recarregar na próxima abertura, sem disparar todas as consultas.

Cancelar leituras antigas com AbortController e ignorar respostas de gerações/versões anteriores, impedindo que um GET anterior à mutation substitua o resultado novo.

Preservar rascunhos apenas durante refresh da mesma sessão autorizada. Como o provider atual limpa session durante refresh, ajustar seu ciclo para não perder texto por simples renovação de token, sem relaxar a limpeza em logout/troca de usuário.

## S. MOBILE E ACESSIBILIDADE

Validar em **430, 390, 375 e 320 px**, além de desktop e zoom de 200%.

- Ações secundárias em menu acessível; botões podem quebrar linha sem aumentar largura da página.
- Dialog nativo reutilizável, com largura limitada à viewport, altura em dvh e rolagem interna.
- Footer de ações acessível com teclado virtual aberto; respeitar safe area.
- Textarea com largura 100%, min-width:0 e quebra de palavras longas; limite visível.
- Selects com labels, opções legíveis e valor longo sem overflow.
- Histórico em cards no mobile; não forçar tabela larga.
- Abas continuam navegáveis e podem ter rolagem própria, sem overflow horizontal da página.
- Título associado por aria-labelledby; descrição por aria-describedby.
- Foco inicial adequado; focus trap, Escape e retorno ao acionador.
- Escape fecha a interação, mas não cancela um comando já recebido pelo backend. Estado pendente/recibo continua reconciliável.
- Labels e erros ligados ao input; aria-invalid quando aplicável.
- Live region para sucesso, conflito e atualização; evitar anunciar o conteúdo inteiro de notas.
- Confirmações de archive/reopen, reversão de override e decisões críticas nomeiam a ação e seu efeito.
- Não depender só de cor; usar texto/ícone.
- Alvos de toque de pelo menos 44 px como padrão de projeto.
- Testar navegação somente por teclado e leitor de tela.
- Respeitar prefers-reduced-motion.

## T. MIGRATIONS NECESSÁRIAS

Propor três migrations incrementais, com prefixos de timestamp definidos na implementação. Não editar migrations históricas já aplicáveis.

1. **admin_workflow_schema**
   - Criar as quatro tabelas novas, constraints, índices e triggers de integridade/imutabilidade.
   - Ampliar admin_audit_events e diagnostic_flag_events.
   - Acrescentar referências de snapshot e metadados de geração aos artefatos.
   - Aplicar grants/RLS e proteção de textos/JSON.
   - Inicializar estados administrativos de diagnósticos elegíveis em NEW/NORMAL, sem responsável.
   - Registrar inicialização como SYSTEM, sem inventar admin em updated_by.
   - Criar inicialização para novos diagnostics em trigger mínimo, sem alterar status público.
   - Não converter automaticamente classificação, prioridade declarada ou consentimento em decisão humana.
   - Inventariar versões FINAL legadas antes de impor unicidade de briefing; saneamento usa o ponteiro vigente e preserva corpos/histórico.

2. **admin_workflow_commands**
   - Criar helpers privados de autorização, política, versões, recibos e resolução de fontes.
   - Criar RPC de comandos, preparação de insumos e commits de qualificação/briefing.
   - Atualizar trigger de eventos de flags para ator/motivo/reabertura e mudanças relevantes.
   - Garantir auditoria obrigatória e recibo durável em cada transação.
   - Proteger conteúdo histórico de snapshots/artefatos contra alterações fora das substituições permitidas.

3. **admin_workflow_read_models**
   - Estender lista/detalhe, assignment, estado, prioridade, revisões, capabilities, stale e seção NOTES.
   - Ampliar timeline e histórico de flags/hipóteses/overrides.
   - Adicionar filtro administrativo de arquivados.
   - Centralizar consentimento/projeção efetiva para leitura e geração.
   - Paginar históricos, sem depender apenas dos limites fixos atuais de 25/100 itens.

Não criar novo admin_audit_events, novo enum de status público, tabela de responsável duplicada, fila sem consumidor ou estrutura de dashboard.

Validar todas as migrations desde banco vazio e sobre cópia de schema/dados anteriores ao ADM 04. Verificar a compatibilidade da limpeza de retenção com novas FKs e triggers.

## U. ARQUIVOS

Os nomes novos abaixo são proposta de organização. O único arquivo criado nesta tarefa é este plano.

| Arquivo | Criar/Alterar | Responsabilidade |
|---|---|---|
| supabase/migrations/<timestamp>_admin_workflow_schema.sql | Criar | Tabelas, integridade, auditoria, snapshots, grants/RLS e inicialização |
| supabase/migrations/<timestamp>_admin_workflow_commands.sql | Criar | RPCs transacionais, políticas, deduplicação e eventos |
| supabase/migrations/<timestamp>_admin_workflow_read_models.sql | Criar | Projeções de lista/detalhe e históricos |
| supabase/functions/admin-diagnostic-workflow/index.ts | Criar | Entrada autenticada, dispatch fechado, rate limit e erros |
| supabase/functions/_shared/admin-workflow-contract.ts | Criar | Schemas de comandos, respostas, capabilities e erros |
| supabase/functions/_shared/admin-workflow-policy.ts | Criar | Política de domínio usada pela Edge, alinhada às invariantes SQL |
| supabase/functions/_shared/admin-effective-data.ts | Criar | Resolvedor interno de valores, evidências e proveniência |
| supabase/functions/_shared/admin-workflow-artifacts.ts | Criar | Cálculo e preparação de briefing, usando motor existente |
| [supabase/functions/_shared/admin-auth.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/admin-auth.ts>) | Alterar | Tipos de auditoria compartilhados e helpers compatíveis; não usar logger best-effort para commit |
| [supabase/functions/_shared/admin-diagnostic-detail-contract.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/admin-diagnostic-detail-contract.ts>) | Alterar | Estado, notas, overrides, hipóteses, capacidades e stale |
| [supabase/functions/_shared/admin-diagnostics-contract.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/admin-diagnostics-contract.ts>) | Alterar | Filtros/campos administrativos; preencher assignee existente |
| [supabase/functions/admin-diagnostic-detail/index.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/admin-diagnostic-detail/index.ts>) | Alterar | Projeções novas e composição com resolvedor quando necessária |
| [supabase/functions/admin-diagnostics-list/index.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/admin-diagnostics-list/index.ts>) | Alterar | Filtros e projeções do workflow |
| [supabase/functions/_shared/interview.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/functions/_shared/interview.ts>) | Alterar minimamente, se necessário | Extrair projeção pura reutilizável; preservar comportamento público |
| [supabase/config.toml](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/supabase/config.toml>) | Alterar | Registrar nova Edge com autenticação explícita |
| src/features/admin/workflow-contract.ts | Criar | Reexportar contrato compartilhado, seguindo padrão atual |
| src/features/admin/admin-workflow-client.ts | Criar | Envio, idempotência, reconciliação e tratamento de conflitos |
| src/features/admin/useAdminWorkflow.ts | Criar | Estado de comandos, rascunhos e invalidação seletiva |
| src/features/admin/AdminWorkflowActions.tsx | Criar | Header, status, prioridade e assignment |
| src/features/admin/AdminWorkflowDialog.tsx | Criar | Dialog acessível compartilhado e formulários |
| src/features/admin/AdminInternalNotes.tsx | Criar | Notas e paginação |
| src/features/admin/AdminFieldOverrideDialog.tsx | Criar | Correção, evidência e reversão rastreáveis |
| src/features/admin/AdminHypothesisReview.tsx | Criar | Decisões por origem/versão |
| [src/features/admin/AdminDiagnosticDetail.tsx](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/AdminDiagnosticDetail.tsx>) | Alterar | Integrar ações, abas, histórico e invalidation |
| [src/features/admin/AdminDiagnostics.tsx](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/AdminDiagnostics.tsx>) | Alterar | Estado, prioridade, responsável e filtro de arquivados |
| [src/features/admin/admin-transport.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/admin-transport.ts>) | Alterar | Novos códigos, retryAfter e timeout/reconciliação |
| [src/features/admin/AdminAuthProvider.tsx](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/AdminAuthProvider.tsx>) | Alterar de forma pontual | Preservar rascunhos em refresh válido e limpar na troca de identidade |
| [src/features/admin/diagnostic-detail-navigation.ts](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/features/admin/diagnostic-detail-navigation.ts>) | Alterar | Nova aba de notas sem perder basePath/hash |
| [src/app/adm/admin.css](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/src/app/adm/admin.css>) | Alterar | Controles, dialogs e estados responsivos |
| supabase/tests/admin_workflow.sql | Criar | Testes transacionais, RLS, concorrência e invariantes |
| tests/admin-workflow/ | Criar | Testes de contratos, precedência, geração e fluxos de UI críticos |
| [package.json](<C:/Users/kalle/OneDrive/Área de Trabalho/numora/numora-main/numora-main/package.json>) | Alterar se necessário | Comandos de teste escolhidos na implementação |
| docs/adm-04-workflow-humano-plano.md | Criado nesta tarefa | Plano para aprovação |
| docs/adm-04-workflow-humano-validacao.md | Criar na implementação | Evidências de testes, limitações e rollout DEV |

Arquivos gerados de domínio só devem mudar pelo gerador, se as fontes compartilhadas precisarem mudar. Não editar manualmente domain-runtime.js.

## V. ORDEM DE IMPLEMENTAÇÃO

1. Aprovar este plano e abrir tarefa separada de implementação.
2. Conferir migrations aplicadas em DEV, versões de dependências e instruções locais do Next.js.
3. Fixar contratos, transições, capabilities, paths editáveis e exemplos de erro.
4. Escrever cenários críticos de autorização, atomicidade, idempotência e evidência.
5. Implementar schema e integridade em migrations incrementais; validar em ambiente isolado.
6. Implementar autorização SQL, locks e recibo durável antes de expor comandos.
7. Implementar assignment, status e prioridade.
8. Implementar notas append-only.
9. Implementar resolvedor canônico e overrides com proveniência.
10. Implementar hipóteses e regras humanas de flags.
11. Implementar recálculo atômico e validação dos insumos usados.
12. Implementar regeneração determinística com versionamento e stale.
13. Implementar archive/reopen administrativo.
14. Evoluir contratos/projeções de leitura e timeline.
15. Integrar UI, dialogs, rascunhos, conflitos e invalidação seletiva.
16. Validar segurança, acessibilidade, larguras mobile e regressão do fluxo público.
17. Executar lint, typecheck, typecheck:edge, testes SQL/integração e build estático com basePath.
18. Fazer rollout DEV coordenado entre schema, Edge e frontend, com roteiro de rollback por desativação de comandos; não apagar histórico para reverter frontend.
19. Entregar evidências de aceite e limitações. Dashboard e integrações permanecem fora desta etapa.

## W. CRITÉRIOS DE ACEITE DA FUTURA IMPLEMENTAÇÃO

### Funcionais

- Estados e transições correspondem à tabela B; transições não listadas são recusadas.
- Prioridade interna não muda score ou prioridade declarada.
- CLAIM concorrente atribui exatamente um responsável.
- CONSULTANT não reassume caso de outro consultor nem opera fora do assignment permitido.
- Motivos obrigatórios são validados em UI, Edge e banco.
- Notas permanecem append-only e internas.
- Override não modifica qualquer resposta original e expõe sua proveniência.
- Reversão de override restaura a base vigente sem reviver cadeia antiga silenciosamente.
- Hipótese não confirmada permanece identificada; confirmar não altera score automaticamente.
- Resolução/reabertura de flags respeita severidade, consentimento e unicidade de ativo.
- Arquivar preserva conteúdo e permite consulta/reabertura administrativa.

### Integridade e segurança

- VIEWER, visitante anônimo, usuário sem perfil, inativo e role inválida não conseguem executar comandos por chamada direta.
- Desativação/rebaixamento ou reatribuição durante processamento invalida o commit.
- Falha na auditoria faz rollback da mutation.
- Duas requisições iguais geram um único resultado, inclusive após expiração do cache de idempotência.
- Chave repetida com outro payload é rejeitada.
- Conflito de versão não grava mudança parcial.
- Evidência de diagnóstico diferente é rejeitada.
- Dados redacted, hipóteses e respostas inválidas não reaparecem como fatos pelo fallback.
- Recusa de contato não pode ser anulada por status, override, flag ou geração de briefing.
- Nenhuma chave privilegiada ou dado administrativo vaza no bundle/export/endpoints públicos.
- Retenção e remoção de identidade não entram em conflito com novos triggers append-only.

### Artefatos

- Recálculo cria nova versão, com dimensões, critérios e evidências coerentes.
- Ponteiros pertencem ao mesmo diagnóstico e apontam para uma única versão vigente.
- Resultado calculado sobre fonte antiga nunca é publicado após alteração concorrente.
- Briefing novo preserva corpo anterior e identifica a origem da geração.
- Fallback determinístico produz artefato válido sem IA externa.
- Mudança de dados marca artefatos/decisões dependentes como desatualizados.
- Histórico antigo não muda ao recalcular ou regenerar.
- Rotas e restrições atuais não são inferidas apenas de score/briefing antigos.

### UX e regressão

- Layout funciona em 430/390/375/320 px, teclado virtual e zoom.
- Dialogs funcionam por teclado, com foco/erros/live region adequados.
- Conflitos preservam texto autorizado e não reenviam automaticamente a decisão.
- Timeout não duplica ações e não anuncia falha definitiva sem reconciliação.
- Aba e dados não afetados são preservados; não recarrega todas as seções.
- Troca de usuário não reaproveita cache/rascunhos.
- Build estático e links com basePath continuam funcionando.
- Fluxo público mantém estados, respostas e conclusão anteriores.
- Testes e validações acima são evidenciados na tarefa de implementação; não foram executados nesta tarefa documental.

## X. RISCOS E PENDÊNCIAS

P0 bloqueia disponibilização de mutations; P1 deve ser resolvido para aceite do ADM 04; P2 é refinamento controlável sem alterar a segurança do núcleo.

| Prioridade | Risco/pendência | Tratamento |
|---|---|---|
| P0 | service_role ignora a fronteira normal de RLS | Edge autentica e SQL revalida ator/role/estado; grants mínimos; testes de chamada direta |
| P0 | Misturar consentimento, status humano e autorização comercial | Gate canônico independente e não sobrescrevível |
| P0 | Override alterar valor sem evidência compatível | Resolvedor valor+proveniência; elegibilidade explícita; links exatos no cálculo |
| P0 | Publicar cálculo com entrada alterada durante processamento | Snapshot consistente, fingerprint e versões revalidadas sob lock |
| P0 | Auditoria separada da mudança ou duplicação após retry | Audit e recibo na mesma transação; recibo durável após 24 h |
| P0 | Arquivamento humano afetar fluxo público | Usar estado administrativo; não escrever diagnostics.archived_at |
| P0 | Hipótese confirmada virar fato automaticamente | Revisão narrativa separada de override/evidência pontuável |
| P1 | Trigger de flag perder autor/motivo ou duplicar eventos | Evoluir único produtor e validar mudança derivada por recálculo |
| P1 | Fonte vigente no detalhe diferir da usada no score/briefing | Resolvedor compartilhado e testes de precedência/esclarecimentos |
| P1 | Profiles/removal/retention atualizarem linhas append-only | IDs históricos sem FK mutável e testes de retenção |
| P1 | Contratos strict quebrarem durante rollout | Backend/projeções compatíveis primeiro; frontend coordenado; smoke tests |
| P1 | Novo tratamento de evidência sem answer_id divergir do fluxo público | Adaptador interno específico e regressão pública |
| P1 | Refresh de sessão descartar texto digitado | Preservação em memória para a mesma identidade, limpeza nas demais situações |
| P1 | Schema real de DEV diferir das migrations locais | Conferência de histórico e constraints antes da implementação |
| P1 | Guias Next.js e dependências locais indisponíveis | Instalar dependências e ler guias antes de escrever código |
| P1 | Briefing externo ser assumido como funcional sem existir | Caminho determinístico completo; nenhuma integração nova |
| P2 | Grande volume de histórico/paginação | Cursor, índices e consultas por seção |
| P2 | Muitos conflitos por versão agregada | Medir em DEV; não fragmentar versões prematuramente |
| P2 | UI excessiva no header | Uma ação primária contextual; demais junto ao domínio/“Mais ações” |
| P2 | Métricas futuras confundirem status humano e automático | Campos distintos, timestamps e eventos explícitos para ADM 05 |

A autorização de CONSULTANT somente sobre casos próprios, a reserva de URGENT a ADMIN e a ausência de efeito direto de hipótese no score são decisões propostas neste plano, não regras já encontradas no código.

Não há dashboard, CRM, agenda, e-mail, WhatsApp, propostas, financeiro, automação comercial ou novas integrações externas neste escopo.

## Y. PERGUNTAS PARA O PO

**Nenhuma pergunta bloqueante para o PO.**

As escolhas funcionais estão explicitadas nas seções B–C e podem ser aprovadas ou ajustadas junto com o plano. A implementação só começará em tarefa separada após aprovação.

## Z. RESUMO EXECUTIVO

- Arquitetura: uma Edge administrativa de comandos, contratos Zod e RPCs transacionais.
- Workflow: nove estados internos, separados do status público e da classificação automática.
- Roles: VIEWER lê; CONSULTANT opera casos próprios; ADMIN controla reatribuição, bloqueios e archive/reopen.
- Dados: quatro novas tabelas; reutilização de auditoria, flags, evidências, snapshots e idempotência.
- Mutations: assignment, status, prioridade, notas, overrides, hipóteses, flags e artefatos versionados.
- Correções preservam respostas originais e exigem proveniência coerente para participar do score.
- Hipóteses revisadas não se tornam fatos pontuáveis automaticamente.
- Concorrência: versões pública/administrativa, snapshot consistente e revalidação no commit.
- Idempotência: recibo transacional e durável, inclusive após limpeza do cache de 24 horas.
- Riscos centrais: autorização, consentimento, evidência, concorrência e atomicidade da auditoria.
- Hosting: manter export estático/basePath; nenhuma nova integração comercial.
- Próximo passo: aprovação deste plano e implementação em uma tarefa separada.

