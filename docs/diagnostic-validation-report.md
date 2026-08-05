# Relatório de validação do MVP de diagnóstico

Data da validação local: 5 de agosto de 2026.

## Decisão de liberação

O código está apto a ser versionado e publicado com `diagnosticConfig.enabled = false`. A rota estática `/diagnostico` existe, permanece `noindex` e exibe um erro recuperável quando o ambiente público ainda não foi configurado.

O produto não está liberado para ativação. Não há neste ambiente um projeto Supabase configurado, migrations aplicadas, Edge Functions publicadas, Auth anônimo homologado, CORS validado no domínio oficial ou política de privacidade aprovada. O CTA deve permanecer desativado até essa homologação.

## Gates executados

| Gate | Resultado | Evidência local |
| --- | --- | --- |
| Lint | Aprovado | `npm run lint` |
| TypeScript Next/domínio | Aprovado | `npm run typecheck` |
| TypeScript Edge Functions | Aprovado | `npm run typecheck:edge` |
| Unitários e verificações estáticas | 44/44 aprovados | `npm run test:unit` |
| Paridade catálogo/runtime | 5/5 aprovados | `npm run diagnostic:check-generated` |
| Export estático | 11/11 aprovados | `npm run test:site` |
| E2E público isolado | 10/10 aprovados | `npm run test:e2e`, backend isolado por mocks de rede |
| Build GitHub Pages | Aprovado | `/`, `/diagnostico`, `robots.txt` e `sitemap.xml` exportados com base path `/numora` |
| Dependências | Aprovado | `npm audit --audit-level=high`: 0 vulnerabilidades |
| Formatação do diff | Aprovado | `git diff --check` |
| Integração PostgreSQL/pgTAP | Não executado | Supabase CLI não conectou em `127.0.0.1:54322`; stack Docker/PostgreSQL indisponível |
| Supabase remoto | Não executado | credenciais e projeto remoto ausentes |

As evidências visuais do Playwright ficam em `playwright-report/evidence/` e são artefatos locais ignorados pelo Git.

## Matriz de requisitos

| Requisito | Status | Evidência |
| --- | --- | --- |
| Next.js estático no GitHub Pages | Implementado e validado localmente | `next.config.ts`, workflow e build |
| Rota `/diagnostico` | Implementada; não liberada | `src/app/diagnostico/`, export estático e `noindex` |
| Supabase Auth anônimo | Implementado; não homologado | cliente chama `signInAnonymously`; falta projeto real |
| 11 Edge Functions | Implementado; não implantado | `supabase/functions/diagnostic-*` |
| Banco e migrations | Implementado; não executado | cinco migrations versionadas e 24 tabelas |
| RLS e isolamento | Coerente estaticamente; não provado em runtime | RLS em 24 tabelas, grants limitados, seis policies de leitura própria e pgTAP |
| Idempotência e concorrência | Implementado estaticamente | chaves por ação, replay, `row_version`, advisory lock e revisão validada sob lock |
| Catálogo e orquestração determinísticos | Aprovado | 44 perguntas, regras canônicas e paridade gerada |
| Extração e confiança | Aprovado estaticamente | somente alta confiança preenche dados; média/baixa fica não confirmada |
| Score, flags e briefing | Implementado e privado | runtime canônico, RPC de conclusão e ausência no bundle público |
| IA desativada/fallback | Aprovado em testes | provider determinístico, mock e fallback do provider externo |
| Minimização para IA externa | Implementado; exige aprovação | opt-in explícito e remoção de identidade/PII antes do envio |
| Consentimentos | Implementado; não homologado | privacidade bloqueante, contato independente e histórico append-only |
| Retomada no mesmo navegador | Implementada no contrato e E2E isolado | Supabase session + identificadores locais |
| Revisão, correção e confirmação | Aprovado no E2E isolado | review versionada, edição e confirmação transacional |
| Acessibilidade e responsividade | Aprovado no escopo automatizado | teclado, foco, dialogs, 320/390 px, sem overflow; sem teste manual com leitor de tela |
| Documento estratégico privado | Aprovado | hash inalterado e nenhum conteúdo no diretório `out` |
| Ausência de ADM, agenda e CRM | Aprovado | varredura do bundle sem rotas ou integrações fora do escopo |
| Ausência de secrets e artefatos internos | Aprovado estaticamente | varredura de `out`; service role e chave de IA somente server-side |
| CTA institucional | Desativado corretamente | `src/config/diagnostic.ts` |

## Limitações e pendências para liberação

1. Aprovar e publicar a política de privacidade.
2. Criar/configurar o projeto Supabase e habilitar Anonymous Sign-Ins.
3. Aplicar as migrations em banco limpo e executar pgTAP, RLS cross-user e rollback.
4. Publicar as Edge Functions e homologar JWT, CORS, rate limits, retenção e fallback real.
5. Configurar as variáveis do GitHub Pages e executar o fluxo real com contato aceito e recusado.
6. Executar validação manual com leitor de tela e nos demais viewports especificados.
7. Implementar seleção de runtime por `interview_version` antes da primeira alteração incompatível do catálogo.
8. Reidratar o painel visual de respostas anteriores após reload/retomada; os dados já permanecem no servidor.
9. Somente depois desses itens, alterar `diagnosticConfig.enabled` para `true`.
