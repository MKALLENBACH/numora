# Deploy do diagnóstico

## 1. Criar e preparar o Supabase

1. Crie um projeto separado por ambiente.
2. Habilite Anonymous Sign-Ins em Authentication.
3. Defina URLs permitidas e proteção contra abuso.
4. Vincule o repositório: `npx supabase login` e `npx supabase link --project-ref <ref>`.
5. Revise e aplique migrations: `npx supabase db push --linked`.
6. Execute lint e testes de banco antes de continuar.

Não coloque credenciais reais em arquivos versionados.

## 2. Configurar Edge Functions

Configure secrets server-side pelo CLI ou Dashboard:

```text
SUPABASE_URL
SUPABASE_ANON_KEY ou publishable key
SUPABASE_SERVICE_ROLE_KEY
AI_ENABLED
AI_PROVIDER
AI_ALLOW_EXTERNAL_OPERATIONAL_DATA
AI_API_URL
AI_MODEL
AI_API_KEY
AI_TIMEOUT_MS
AI_MAX_RETRIES
ALLOWED_ORIGINS
variáveis de limites e retenção
```

Publique cada função em `supabase/functions/` mantendo JWT verification habilitada. Teste CORS tanto para o domínio oficial quanto para os origins locais aprovados.

## 3. Configurar o GitHub Pages

Disponibilize ao workflow de build, por GitHub Variables/Secrets:

```text
NEXT_PUBLIC_PRIVACY_POLICY_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Somente a URL, a publishable/anon key e a URL da política podem ser públicas. A service role e a chave de IA pertencem exclusivamente ao Supabase.

O `NEXT_PUBLIC_BASE_PATH` continua vindo de `actions/configure-pages`.

## 4. Critérios para ativar o CTA

Ative `diagnosticConfig.enabled` somente depois de evidenciar:

- política aprovada e acessível;
- Auth anônimo funcionando;
- migrations e RLS aplicadas;
- Edge Functions publicadas com CORS correto;
- fluxo sem IA e fallback funcionando;
- revisão, correção, conclusão e retomada validadas;
- cross-user access negado;
- lint, typecheck, unitários, integração, E2E e build aprovados;
- ausência de score, flags, briefing, ADM, agenda e secrets no bundle.

Antes disso, mantenha o CTA no estado de preparação e a rota fora do sitemap.

## 5. Rollback

- Frontend: reverta o commit ou desative o CTA e publique novamente.
- Edge Functions: publique a versão anterior.
- Banco: prefira migrations corretivas; não edite uma migration já aplicada.
- Preserve diagnósticos históricos e versões de catálogo durante rollback.

## 6. Produção

Após o deploy, execute o fluxo completo com consentimento comercial aceito e recusado, valide retomada no mesmo navegador, teste rate limit seguro e confirme que o documento privado continua ausente do artefato público.
