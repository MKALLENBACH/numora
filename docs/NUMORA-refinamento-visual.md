# NUMORA — Implementação do refinamento visual

Base: `4ca701e`. Data: 16/10/2026. Direção aprovada: **Precisão operacional — clareza para decidir**.

## Divergências identificadas durante a execução

- **E02 — indicação do módulo ativo com `/numora`:** a implementação instalada do Next remove o basePath antes de fornecer `usePathname()`. O menu administrativo comparava esse valor com URLs prefixadas. O ajuste é restrito à comparação que define `aria-current`; os destinos continuam usando `withBasePath`.
- **E01 — overflow com dados preenchidos:** a matriz identificou um elemento visualmente oculto da tabela fora do contêiner em 1024 px e conteúdo longo do briefing excedendo a largura em 320 px. O contêiner posicionado e a quebra de linhas resolvem os dois casos sem truncar informações.

## Implementação por tarefa

| ID | Problema / resultado | Arquivos principais |
|---|---|---|
| A01 | Tokens semânticos compartilhados para superfícies, texto, ações, contornos, foco e estados; aliases do diagnóstico e ADM apontam para a base comum. | `src/styles/tokens.css`, `src/app/diagnostico/diagnostic.css`, `src/app/adm/admin.css` |
| A02 | Inter entregue localmente; escalas distintas para marketing, entrevista e administração. | `src/app/layout.tsx`, `src/app/fonts/`, `src/styles/base.css`, `src/styles/tokens.css` |
| B01 | Controles com hierarquia, alvo de 44 px e estados consistentes; botões novos do workflow e de recuperação de erro recebem acabamento próprio. | `src/styles/components.css`, `src/app/diagnostico/diagnostic.css`, `src/app/adm/admin.css` |
| B02 | Contorno funcional de campos e foco escuro em superfícies claras; foco ciano nas escuras. Região da tabela acessível por teclado. | Estilos compartilhados, `src/features/admin/AdminDiagnostics.tsx` |
| C01 | Hero com texto e mapa, escala de até 64 px e CTA aprovado com apoio; destino preservado. | `src/app/page.tsx`, `src/config/diagnostic.ts`, `src/styles/sections.css` |
| C02 | Oito blocos principais, 12 âncoras preservadas; jornada integrada à abordagem, diferenciais aos critérios e filosofia ao diagnóstico. Numeração decorativa removida das categorias. | `src/app/page.tsx`, `src/styles/sections.css` |
| C03 | Mapa existente refinado com entrada, núcleo e resultados; relação horizontal compacta no celular e descrição acessível. | `src/components/sections/OperationalDiagram.tsx`, `src/styles/responsive.css` |
| D01 | Entrevista em superfície plana; formulário mais legível, largura controlada e títulos menores. Halo e sombra externa removidos. | `src/app/diagnostico/diagnostic.css` |
| D02 | Ordem visual móvel acompanha o DOM; foco acompanha mudanças de etapa/erro e preserva retorno dos diálogos. As seis etapas públicas continuam sendo fornecidas pelo componente existente. | `src/components/diagnostic/DiagnosticPage.tsx`, `src/app/diagnostico/diagnostic.css` |
| ADM01 | Títulos operacionais, controles do workflow, espaçamento de procedência e menor acúmulo de caixas internas. | `src/app/adm/admin.css` |
| ADM02 | Entrada descreve o módulo implementado e oferece acesso à listagem existente; filtros e tabela com densidade útil. | `src/features/admin/AdminOverview.tsx`, `src/features/admin/AdminDiagnostics.tsx`, `src/app/adm/admin.css` |
| E01 | Regras para 320, 390, 768, 900, 1024 e 1440 px; menu administrativo existente passa a ser utilizado até 900 px. | `src/styles/responsive.css`, estilos do ADM e diagnóstico |
| E02 | Login, recuperação e privacidade harmonizados; aviso de política em revisão e configuração DEV preservados. Indicação do módulo atual corrigida com basePath. | `src/app/politica-de-privacidade/policy.module.css`, `src/features/admin/AdminShell.tsx`, estilos do ADM |
| F01 | Regressão técnica, exportação nas duas bases e matriz visual com interceptação de rede e fixtures locais. | `scripts/check-visual-refinement.mjs`, `docs/evidencias/refinamento-visual/` |

## Decisões de implementação

A identidade oficial foi mantida: logotipo, Inter, azul-marinho `#0B1F33` e ciano `#3DD9EB`. A composição se apoia no conteúdo e no mapa operacional existente. Superfícies claras e linhas de organização substituem a repetição de cartões e espaçamentos excessivos. O contrato visual está em [`DESIGN.md`](../DESIGN.md).

As listas de capacidades, entregáveis, critérios, perfis, setores e decisores continuam vindo dos mesmos arrays de conteúdo. A numeração continua visível nas sequências reais da jornada e da abordagem. As âncoras antigas podem estar em grupos internos para manter links existentes.

O CTA usa “Resolva o seu problema agora!” e o apoio “Comece pelo diagnóstico inicial da sua operação.”. O botão da introdução continua “Começar diagnóstico”. O comportamento configurado para disponibilidade e diálogo foi preservado.

A fonte variável ocupa 352.240 bytes, está versionada com a licença SIL OFL e dispensa requisição a um provedor externo. SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`. Origem: [Inter oficial](https://github.com/rsms/inter/tree/master/docs/font-files).

## Preservação funcional

O diff de produção está concentrado em CSS, composição institucional, texto da entrada administrativa, indicação de navegação e gerenciamento de foco. Não houve edição de Supabase, funções, migrações, contratos, autenticação, catálogo de perguntas, validações, consentimentos, persistência, qualificação, capabilities, concorrência, idempotência ou auditoria.

As alterações já existentes em `.agents/` e `skills-lock.json` foram preservadas. Nenhuma biblioteca de UI ou dependência foi acrescentada. O trabalho permanece local para revisão.

## Validação técnica e visual

| Verificação executada | Resultado |
|---|---|
| ESLint do repositório | Passou, sem erros; cinco avisos de variáveis não utilizadas no scanner da skill instalada, preservada nesta entrega. |
| TypeScript da aplicação (`tsc --noEmit`) | Passou. |
| TypeScript das Edge Functions (`tsc -p supabase/functions/tsconfig.check.json`) | Passou. |
| Testes existentes (`workflow.test.ts` e `frontend.test.tsx`) | 17 passaram; zero falhas. |
| Validação de configuração de build | Passou. |
| Exportação estática com basePath vazio | Passou; rotas principais retornaram 200, CTA e fonte local conferidos. |
| Exportação estática com `/numora` | Passou; rotas principais retornaram 200. A exportação final em `out/` usa esse prefixo. |
| Matriz final Playwright/Chrome com `/numora` | **161 verificações passaram, 115 screenshots, zero erros de JavaScript e zero solicitações externas encaminhadas.** |
| Matriz administrativa sem basePath | 59 verificações passaram, 51 screenshots. |
| Scanner de design | 92 arquivos, zero P0, zero P1; 11 sinais P2 revisados, descritos abaixo. |
| `git diff --check` | Passou. |

Os scripts do `package.json` foram executados pelos seus entrypoints locais com Node, pois `npm`/`npx` não estão disponíveis no PATH desta sessão. Nenhuma alteração de dependência foi necessária.

As seis larguras **320, 390, 768, 900, 1024 e 1440 px** foram verificadas no site, introdução, identificação, privacidade, recuperação, login, entrada administrativa, listagem e entrevista administrativa. Estados adicionais incluem consentimento, nove tipos de pergunta presentes no catálogo, revisão, edição do resumo, conclusão com e sem contato, bloqueio, falha de salvamento, falha no login, filtros, falha de consulta, qualificação, flags, briefing, notas, auditoria, correção e status. Esses estados adicionais têm capturas em 320 e 1440 px; revisão e filtros incluem larguras intermediárias.

A automação conferiu âncoras, CTA no primeiro viewport móvel, carregamento da fonte, menu e Escape, foco por etapa, consentimentos sem pré-seleção, validação de identificação, rascunho na retomada e após falha, retorno de foco dos diálogos, menu administrativo em 900 px, abas por End/Enter e visibilidade das ações por perfil. Os cenários de concorrência, idempotência, privacidade e consentimento também continuam cobertos pela suíte existente de 17 testes.

Os oito pares de contraste medidos passaram pelos limites aplicáveis: texto principal 16,69:1; secundário 5,93:1; links 4,71:1; contornos funcionais 3,58:1; foco em fundo escuro 9,80:1; estados de sucesso, atenção e erro acima de 6:1. Isso verifica os tokens selecionados e não constitui certificação integral de acessibilidade.

O scanner identifica como P2 rótulos acessíveis do tipo “NUMORA — início” e metadados separados por ponto médio. Eles foram mantidos porque identificam marca, versões, estado e procedência. O alerta sobre o `span` do hero foi marcado com uma exceção documentada: o trecho tem a mesma cor do título e apenas controla a quebra de linha. A inspeção visual confirmou a coerência com a direção aprovada.

### Comparação visual

| Largura | Altura anterior da página | Altura refinada | Redução |
|---|---:|---:|---:|
| 1440 px | 12.282 px | 8.143 px | 33,7% |
| 390 px | 17.082 px | 13.388 px | 21,6% |

As medidas representam a composição da página, não indicadores comerciais. A redução vem da consolidação narrativa e do espaçamento. O CTA continua visível no primeiro viewport móvel.

| Experiência | Antes | Depois |
|---|---|---|
| Institucional desktop | [Página anterior](evidencias/refinamento-visual/antes-site-1440.png) | [Página refinada](evidencias/refinamento-visual/depois-site-1440.png) |
| Institucional móvel | [Página anterior](evidencias/refinamento-visual/antes-site-390.png) | [Página refinada](evidencias/refinamento-visual/depois-site-390.png) |
| Diagnóstico móvel | [Introdução anterior](evidencias/refinamento-visual/antes-diagnostico-390.png) | [Introdução refinada](evidencias/refinamento-visual/depois-diagnostico-intro-390.png) |
| Login móvel | [Login anterior](evidencias/refinamento-visual/antes-login-390.png) | [Login refinado](evidencias/refinamento-visual/depois-login-390.png) |
| Workspace administrativo | [Evidência histórica ADM 04](evidencias/adm-04/workflow-desktop.jpg) | [Entrevista refinada](evidencias/refinamento-visual/depois-adm-entrevista-1440.png) |
| Diálogo em 320 px | [Evidência histórica ADM 04](evidencias/adm-04/dialog-320.jpg) | [Correção refinada](evidencias/refinamento-visual/depois-adm-correcao-320.png) |

As capturas institucionais, de introdução e login anteriores foram registradas da exportação local disponível antes de reconstruir o projeto. A comparação administrativa usa evidências históricas, com dados e enquadramentos diferentes; serve para avaliar escala e controles, não como comparação pixel a pixel.

Evidências estruturadas: [matriz final](evidencias/refinamento-visual/resultados.json), [matriz administrativa na raiz](evidencias/refinamento-visual/resultados-raiz.json), [exportação na raiz](evidencias/refinamento-visual/exportacao-raiz.json), [exportação com prefixo](evidencias/refinamento-visual/exportacao-numora.json), [contrastes](evidencias/refinamento-visual/contrastes.json), [comparação de dimensões](evidencias/refinamento-visual/comparacao.json), [scanner](evidencias/refinamento-visual/scanner.json).

### Reprodução

1. Executar os scripts usuais de lint, tipos, testes e build do `package.json`.
2. Gerar a exportação com `NEXT_PUBLIC_BASE_PATH=/numora`.
3. Iniciar `node scripts/serve-static-dev.mjs` com o mesmo valor de basePath.
4. Executar `node node_modules/tsx/dist/cli.mjs scripts/check-visual-refinement.mjs`.

O teste requer Playwright disponível no ambiente. Quando ele estiver fora do projeto, `PLAYWRIGHT_MODULE` recebe o caminho do módulo existente; `BROWSER_EXECUTABLE` pode apontar para Chrome/Chromium já instalado. Para a raiz, definir `NEXT_PUBLIC_BASE_PATH` como string vazia no build, preview e teste. `VISUAL_ADMIN_ONLY=1` permite repetir apenas a parte administrativa. O script bloqueia encaminhamento de rede externa e fecha o banco em memória ao terminar.

## Inventário de arquivos

- Fundamentos: `src/styles/tokens.css`, `base.css`, `components.css`, `layout.css`, `sections.css` e `responsive.css`.
- Fonte e layout global: `src/app/layout.tsx`, `src/app/fonts/InterVariable.woff2` e `src/app/fonts/OFL.txt`.
- Institucional: `src/app/page.tsx`, `src/config/diagnostic.ts` e `src/components/sections/OperationalDiagram.tsx`.
- Diagnóstico: `src/components/diagnostic/DiagnosticPage.tsx` e `src/app/diagnostico/diagnostic.css`.
- Administração: `src/app/adm/admin.css`, `src/features/admin/AdminOverview.tsx`, `AdminDiagnostics.tsx` e `AdminShell.tsx`.
- Privacidade: `src/app/politica-de-privacidade/policy.module.css`.
- Documentação e evidências: `DESIGN.md`, este relatório, `scripts/check-visual-refinement.mjs` e `docs/evidencias/refinamento-visual/`.

## Limitações e próximos passos de revisão

- A automação visual usa Chromium/Chrome no Windows. Safari, Firefox e leitores de tela não foram exercitados nesta execução.
- Login, respostas públicas e estados administrativos são simulados no navegador. Os dados administrativos são gerados pelas migrações e funções existentes em PGlite, em memória, incluindo qualificação, briefing e notas. Nenhuma solicitação externa é encaminhada pelo teste.
- A rodada visual não substitui uma homologação integrada do backend. Os testes de workflow existentes fornecem a regressão funcional local.
- A política continua marcada como versão em revisão, conforme o estado real do projeto. A preparação jurídica e a promoção do ambiente para produção seguem como trabalhos próprios.
- As capturas com “fixture” contêm dados sintéticos de teste. Eles não representam métricas ou clientes da NUMORA e não integram a exportação do produto.
- Revisão final de qualidade pelo Astra e decisão de publicação permanecem como próximos passos.
