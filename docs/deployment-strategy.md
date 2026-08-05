# Estratégia de publicação da NUMORA

## Estado atual

O site institucional é exportado como HTML estático pelo Next.js e publicado no GitHub Pages. Essa arquitetura é adequada para a experiência pública atual: conteúdo institucional, navegação interna, metadados, imagens e o modal que comunica que o diagnóstico digital ainda está em preparação.

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

## Recomendação

Para a futura entrevista guiada por IA, a recomendação é a Opção A: runtime de servidor integrado. Ela reduz a complexidade operacional e oferece uma fronteira mais clara para segredos, sessões, streaming e regras privadas. A Opção B continua viável se houver um motivo organizacional forte para manter o GitHub Pages.

Nenhuma migração deve ocorrer agora. O GitHub Pages permanece como publicação oficial até a aprovação da arquitetura da entrevista, dos requisitos de dados e do provedor de runtime.
