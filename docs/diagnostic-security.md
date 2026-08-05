# Segurança, privacidade e abuso

## Autenticação e autorização

O navegador usa Supabase Auth anônimo. Esses usuários assumem o papel PostgreSQL `authenticated`; policies devem validar `auth.uid()` e, quando necessário, o claim `is_anonymous`.

Edge Functions mantêm verificação JWT habilitada, validam o usuário e conferem ownership em toda operação. Service role é usada somente no runtime server-side e nunca é devolvida, logada ou incorporada ao frontend.

## RLS

Todas as tabelas públicas têm RLS. O visitante acessa somente o próprio diagnóstico, sessão, respostas e resumo público. Score, flags, evidências, auditoria, erros e briefing não possuem policy de leitura pelo visitante.

Policies não substituem validação de estado. Owner, status terminal, versões e rota interna não são campos controlados pelo cliente.

## Consentimento

Consentimentos são append-only, possuem versão da política e podem superseder registros anteriores sem apagá-los. Nenhum lead ou PII é criado antes do aceite de privacidade. A recusa bloqueia o diagnóstico; a recusa comercial permite conclusão sem contato.

## Conteúdo sensível

Senhas, tokens, chaves, bearer tokens, private keys e outros segredos são removidos antes da persistência e substituídos por marcador seguro. O sistema não repete nem registra o valor bruto. Exposição grave interrompe o fluxo.

O provider externo de IA permanece desabilitado por padrão. Além de `AI_ENABLED=true` e da seleção do provider, exige a aprovação explícita `AI_ALLOW_EXTERNAL_OPERATIONAL_DATA=true`. Antes do envio, empresa, participantes e contexto de decisão são omitidos, e e-mails, telefones, URLs e dados pessoais rotulados são removidos dos demais campos. Essa proteção técnica não substitui aprovação de privacidade, contrato com o operador e revisão do fluxo real.

## Idempotência e concorrência

Mutações exigem `clientRequestId` e chave composta por usuário, diagnóstico e ação. Repetições retornam o resultado anterior. `row_version` detecta concorrência; a versão da revisão é conferida novamente sob lock na transação de atualização. O início usa um advisory lock transacional derivado do owner para que chamadas simultâneas não criem dois diagnósticos ativos. Em conflito, o cliente preserva o texto local e recarrega o estado sem reenviar automaticamente.

## Rate limit e abuso

Defaults técnicos:

- 30 requisições por minuto por usuário;
- 10 submissões de resposta por minuto;
- 3 inícios por hora;
- honeypot e tempo mínimo plausível de submissão.

Prompt injection não altera catálogo, estado, score ou persistência. Tentativas persistentes e abuso são bloqueados com mensagem pública genérica.

## Retenção

Os períodos em `.env.example` são defaults técnicos sujeitos a aprovação. A função de limpeza deve anonimizar ou excluir por status e também remover usuários anônimos expirados quando permitido. Não trate os defaults como parecer jurídico.

## Revisão antes de produção

- aprovar política e versão;
- revisar origins de CORS;
- habilitar Auth anônimo e proteção contra abuso no Supabase;
- aplicar migrations em banco limpo;
- executar pgTAP/RLS cross-user;
- verificar ausência de secrets e dados internos no bundle;
- revisar logs e retenção.
