# Estratégia de publicação da NUMORA

## Estado atual

O site institucional é exportado como HTML estático pelo Next.js e publicado no GitHub Pages. A arquitetura aprovada para o diagnóstico mantém esse frontend estático e adiciona Supabase Auth anônimo, Edge Functions e PostgreSQL como backend externo.

O GitHub Pages serve somente arquivos estáticos. Ele não executa código de servidor, não mantém sessões, não protege segredos de API e não oferece banco de dados ou funções backend. Uma rota de entrevista com IA, autenticação ou persistência não deve colocar chaves e regras privadas no navegador.

## Opção A — runtime de servidor integrado

Publicar a aplicação em Vercel, Cloudflare, Netlify ou plataforma equivalente, mantendo frontend e endpoints de servidor no mesmo projeto.

Vantagens:

- Um único deploy para site, entrevista e APIs;
- Segredos e integrações executados no servidor;
- Suporte mais direto a sessões, streaming e observabilidade;
- Menor complexidade de CORS, versões e URLs entre frontend e backend.

Pontos de atenção:

- Migração do domínio e da automação de deploy;
- Custos e limites variam por provedor;
- A escolha deve considerar runtime, região, logs e política de dados.

## Opção B — GitHub Pages com backend externo

Manter o site no GitHub Pages e implementar a entrevista em Supabase Edge Functions, API serverless ou serviço backend independente.

Vantagens:

- Preserva a publicação estática já validada;
- Separa o ciclo de vida do site institucional do serviço de diagnóstico;
- Permite escolher banco, autenticação e processamento de forma independente.

Pontos de atenção:

- Dois deploys, duas configurações e duas superfícies de observabilidade;
- CORS, autenticação, rate limiting e versionamento precisam ser coordenados;
- O frontend continua público e nunca pode conter segredos;
- Falhas ou mudanças no backend precisam ser tratadas sem quebrar o site estático.

## Decisão aprovada para o MVP

A Opção B foi escolhida para o MVP: GitHub Pages com backend Supabase. O Next.js continua sem Route Handlers ou Server Actions dinâmicos. JWT, regras de negócio, score, flags, briefing, service role e IA permanecem nas Edge Functions e no banco.

O CTA institucional só pode ser ativado depois que política de privacidade, Auth anônimo, migrations, RLS, Edge Functions, CORS e testes críticos forem validados no ambiente publicado. O procedimento completo está em `docs/diagnostic-deployment.md`.
