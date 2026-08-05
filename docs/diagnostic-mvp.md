# MVP da entrevista de diagnóstico

## Objetivo

A rota pública `/diagnostico` organiza uma solicitação inicial sem transformar a experiência em chatbot, proposta ou diagnóstico definitivo. O fluxo coleta consentimentos, identificação profissional e contexto operacional; permite revisão e correção; e conclui com ou sem autorização de contato.

O visitante nunca recebe score, classificação, flags, rota comercial, evidências internas ou briefing.

## Arquitetura do MVP

- Frontend: Next.js com exportação estática para GitHub Pages.
- Identidade: Supabase Auth anônimo, persistido no mesmo navegador.
- API: Supabase Edge Functions autenticadas por JWT.
- Persistência: PostgreSQL/Supabase com migrations, constraints, RLS e auditoria.
- Orquestração: máquina de estados e catálogo determinísticos.
- IA: auxiliar, server-side, opcional e sempre protegida por fallback determinístico.

## Como executar o frontend

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis `NEXT_PUBLIC_*` com os valores do projeto de desenvolvimento.
3. Execute `npm install` e `npm run dev`.
4. Acesse `http://localhost:3000/diagnostico`.

Nunca use a service role no arquivo do frontend. Variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle no momento do build.

## Como executar o backend local

O Supabase CLI requer Node.js 20+ e Docker ou runtime compatível.

```text
npm run supabase:start
npm run supabase:reset
supabase functions serve --env-file supabase/.env.local
```

Use `npx supabase ...` quando o executável local não estiver disponível no `PATH`. Não versione `supabase/.env.local`.

## Testes

```text
npm run lint
npm run typecheck
npm run typecheck:edge
npm run diagnostic:check-generated
npm run test:site
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Os testes de integração e pgTAP exigem a stack Supabase local. A suíte E2E pública usa um backend Supabase isolado por mocks de rede para validar o navegador de forma reproduzível; ela não substitui a homologação das migrations, RLS, Auth anônimo, CORS e Edge Functions em um projeto Supabase real.

## Limitações assumidas

- Retomada apenas no mesmo navegador enquanto a sessão anônima existir.
- O painel de respostas anteriores representa as respostas enviadas na sessão de UI atual; após recarregar/retomar, o servidor preserva as respostas, mas o painel não repopula esse histórico no MVP.
- Diagnósticos iniciados com uma versão anterior do catálogo precisam de uma estratégia de compatibilidade antes da primeira troca de versão em produção.
- Sem ADM, agenda, CRM, notificações, upload, pagamento ou área do cliente.
- Sem garantia de contato, prazo, reunião, proposta, ROI ou implementação.
- Valores de retenção são defaults técnicos e precisam de aprovação antes de produção.
- O CTA institucional deve permanecer desativado enquanto política de privacidade, projeto Supabase e testes críticos publicados não estiverem validados.

## Próximo passo para o ADM

O futuro ADM deve usar autenticação interna separada, autorização explícita e consultas server-side. Ele poderá consumir score, flags, evidências e briefing, mas esses dados não devem ser adicionados aos contratos públicos existentes.
