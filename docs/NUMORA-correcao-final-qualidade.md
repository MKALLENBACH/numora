# NUMORA — Final Correction & Quality Assurance

Data: 19/10/2026. Base local e remota: `ae965f1010f5521e5e5af8fb57b2e9b714e453b5`.
Referência da auditoria: `7ce3ed7`. Direção preservada: **Precisão operacional — clareza para decidir.**

## 1. Resumo executivo

Correção localizada do contraste, preservando logotipo, Inter, azul-marinho `#0B1F33` e ciano `#3DD9EB`. As correções do drawer e dos cards já vieram do remoto no commit `ae965f1`; foram preservadas e submetidas a testes de regressão. Não houve redesign, alteração de contrato, regra de negócio, autorização ou persistência. Não foram criados commits nem realizadas operações no Supabase.

O escopo de produto desta entrega consiste em duas folhas CSS. Os demais arquivos são documentação e automação de testes. A decisão de aceite continua reservada à revisão independente do Astra.

### Fontes e rastreabilidade

- Planejamento original de 16/10/2026, base `4ca701e`: documento integral recuperado na auditoria anterior, disponível em `C:/Users/kalle/.codex/audits/numora-final-review-2026-10-16/planejamento-original.md`.
- Implementação: `docs/NUMORA-refinamento-visual.md`, código, histórico e diff atual.
- Auditoria final de 17/10/2026: o documento integral não foi localizado no repositório nem nas mensagens recuperadas. O pedido atual fornece expressamente NC-01, NC-02, NC-03 e QA-01, usados como escopo corretivo. Não foram reconstruídas conclusões ausentes.
- Alteração intermediária: `ae965f1`, posterior ao commit auditado, modifica somente `AdminShell.tsx` e `AdminDiagnostics.tsx`. Essas modificações não são atribuídas a esta entrega.

## 2. Correções implementadas

| Item | Problema e correção | Critério de aceite | Resultado |
|---|---|---|---|
| NC-01 | `--link` passa de `#087F92` para `#087589`. Os aliases do diagnóstico e ADM herdam a mudança. O rótulo “Retorno” usa ciano oficial sobre marinho por uma variável local de contexto. | Texto normal ≥4,5:1; marca preservada; foco perceptível. | Ver resultados de contraste e validação renderizada abaixo. |
| NC-02 | Correção remota fecha o drawer quando `matchMedia('(max-width: 900px)')` deixa de corresponder. Restaura overflow anterior e foca o link atual da sidebar visível. | Sem drawer invisível ou scroll bloqueado; cleanup; teclado/navegação preservados. | Cenários de resize, fechamento e desmontagem automatizados. |
| NC-03 | Correção remota acrescenta setor, porte e cargo ao `DiagnosticCard`, reutilizando os dados e labels existentes. | Paridade para valores presentes; ausência explícita; leitura sem overflow. | Fixtures presentes, ausentes e extensas, em sete larguras. |
| QA-01 | Ampliação da suíte existente, integração em memória e automação sobre exportação estática. | Evidência reproduzível e delimitação da cobertura. | Ver testes, limitações e handoff. |

Status de entrega: **NC-01, NC-02 e NC-03 — CORRIGIDO E VALIDADO** no escopo descrito. **QA-01 — CORRIGIDO, MAS NÃO TOTALMENTE VALIDADO**: cobertura automatizada ampliada; integração pública real e leitor de tela permanecem fora da cobertura desta rodada. Isso não é um parecer de aprovação integral do produto.

## 3. Arquivos modificados

- `src/styles/tokens.css`: um token semântico de link.
- `src/app/politica-de-privacidade/policy.module.css`: cor contextual do eyebrow; sem alteração de conteúdo ou estrutura.
- `DESIGN.md`: sincronização do token e contraste do contrato visual.
- `package.json`: inclusão dos testes corretivos no comando `test`; nenhuma dependência adicionada.
- `tests/final-corrections/contrast.test.mjs`: cálculo WCAG a partir dos tokens e superfícies do CSS; comprova que o par antigo falha.
- `tests/final-corrections/drawer.test.mjs`: montagem/desmontagem real do componente em JSDOM, restauração de overflow e remoção do listener.
- `scripts/check-visual-refinement.mjs`: reutilização da matriz existente, largura 901px, axe opcional, gravações sintéticas reais, diretório de evidência configurável e diagnóstico de falha.
- `scripts/check-final-corrections.mjs`: cenários corretivos, transições públicas simuladas, comandos administrativos em PGlite e zoom nativo em perfil temporário.
- `scripts/check-static-export.mjs`: confere rotas, referências locais de HTML/CSS, fonte e destino/texto do CTA nas duas bases.
- Este relatório e `docs/evidencias/correcao-final/`: logs, resultados e capturas.

Os arquivos de produto `AdminShell.tsx` e `AdminDiagnostics.tsx` não recebem novo diff nesta entrega; sua implementação é a do remoto.

## 4. Testes executados

Ambiente: Windows, PowerShell, Node 24.19.0, Next.js 16.3.0, React, Chrome 155.0.8059.80, Playwright do runtime disponível, PGlite em memória e JSDOM. O executável `npm` não está no PATH; foram executados diretamente os mesmos entrypoints locais definidos nos scripts, sem instalação de pacotes.

| Script solicitado | Comando equivalente utilizado | Evidência |
|---|---|---|
| `npm run lint` | `node node_modules/eslint/bin/eslint.js .` | `lint-final.log` |
| `npm run typecheck` | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | `typecheck.log` |
| `npm run typecheck:edge` | `node node_modules/typescript/bin/tsc -p supabase/functions/tsconfig.check.json` | `typecheck-edge.log` |
| `npm test` | `node node_modules/tsx/dist/cli.mjs --test tests/admin-workflow/workflow.test.ts tests/admin-workflow/frontend.test.tsx tests/final-corrections/*.test.mjs` | `tests-final.log` |
| `npm run build` | Prebuild com `--env-file-if-exists=.env.local`, seguido de `node node_modules/next/dist/bin/next build` | `build-numora.log`, `build-raiz.log` |

As variáveis `NEXT_PUBLIC_BASE_PATH='/numora'` e `NEXT_PUBLIC_BASE_PATH=''` são definidas apenas no processo de build/preview. O arquivo de configuração do produto não é alterado. O prebuild valida os valores públicos locais. As chamadas de navegador para fora da origem local são interceptadas: **nenhuma é encaminhada ao Supabase**.

Testes unitários/integração: **19 passaram**, código de saída 0. Typecheck da aplicação e Edge: saída 0. Lint: saída 0, nenhum erro e cinco avisos preexistentes no scanner da skill `avoid-ai-design`; nenhum aviso nos arquivos corretivos. A matriz visual `/numora` passou com 246 asserções e 124 capturas. Esses números são asserções de cenários e larguras, não 246 testes unitários distintos.

Os cenários corretivos `/numora` passaram com 172 asserções, 19 capturas de estado e oito capturas de zoom. As duas execuções registram 89 análises axe AA (76+13), sem violações automáticas e sem erros JavaScript. O teste estático `/numora` verificou 36 referências locais, as nove rotas principais incluindo a home, fonte e CTA. As evidências históricas do refinamento não foram contadas nestes resultados.

A exportação **sem basePath** também passou: build com saída 0, 36 referências locais verificadas e cenários de navegador com saída 0 (174 asserções, 19 capturas de estado, oito de zoom, 13 análises axe). Nessa execução foram confirmados também o carregamento da Inter e o clique do CTA até o diagnóstico. Total das três execuções finais: **102 análises axe, zero violações detectadas e zero erros JavaScript**; 178 capturas, incluindo 16 de zoom. `validacao-tecnica.json` registra os códigos de saída e arquivos de evidência.

### Reprodução da automação de navegador

1. Executar prebuild/build com a base escolhida.
2. Iniciar `node scripts/serve-static-dev.mjs` com a mesma base, porta 3000.
3. Definir `PLAYWRIGHT_MODULE` para o Playwright disponível, `BROWSER_EXECUTABLE` para o Chrome e, opcionalmente, `AXE_PATH` para `axe.min.js` disponível no ambiente.
4. Definir `FINAL_CORRECTION_QA=1` e `VISUAL_EVIDENCE_DIR` para uma pasta de saída própria.
5. Executar `node node_modules/tsx/dist/cli.mjs scripts/check-visual-refinement.mjs`.

`CORRECTIONS_ONLY=1` seleciona apenas os cenários complementares, sem reexecutar a matriz original. Axe é uma ferramenta de auditoria já disponível neste ambiente; não foi acrescentado como dependência do projeto. Sem `AXE_PATH`, suas verificações não são executadas e não devem ser inferidas.

## 5. Resultados de contraste

| Fundo real | Uso do token | Antes | Depois |
|---|---|---:|---:|
| `#FFFFFF` | Textos de orientação, links e controles em superfície branca | 4,7073:1 | **5,3625:1** |
| `#F7F9FB` | “Editar” na revisão; eyebrow do ADM fora dos painéis | 4,4603:1 | **5,0811:1** |
| `#E5FBFE` | Marcador de etapa concluída | 4,3849:1 | **4,9952:1** |
| `#E7FAFC` | Ícones de benefícios/conclusão | 4,3661:1 | **4,9738:1** |
| `#F0FCFD` | Superfície de escolha selecionada/hover | 4,4938:1 | **5,1193:1** |
| `#0B1F33` | Rótulo “Retorno” na política, agora `#3DD9EB` | 3,4020:1 | **9,7956:1** |

Mapa de consumidores: `diagnostic.css` usa `--diagnostic-cyan-dark` para etapas concluídas, marcador, indicador de salvamento, eyebrow, benefícios, links, botões de texto, bordas de seleção/foco e marca de conclusão. `admin.css` usa `--admin-cyan-dark` para eyebrow, bordas de foco, spinner, indicador de aba ativa e timeline. `sections.css` usa `--link` nos marcadores de lista. A política passa a usar o token no eyebrow claro e o ciano oficial no contexto escuro.

O texto de “Editar” é medido a partir do CSS computado no navegador nos estados normal, hover, focus e active: 5,0811:1 sobre o fundo real. O anel de foco conserva 3px. Botões e campos desabilitados são verificados nos estados busy; controles inativos não são usados para afirmar conformidade de contraste de texto ativo. Os ícones decorativos também foram incluídos no cálculo, embora nem todos sejam texto informativo.

## 6. Validação do drawer

- 900→901 e 899→1024: diálogo removido, `aria-expanded=false`, overflow anterior restaurado e foco no link atual da sidebar, visível.
- Desktop→mobile: menu retorna fechado e pode ser aberto novamente.
- Espaço abre; Tab/Shift+Tab mantêm foco no drawer; Escape fecha e devolve foco ao botão Menu.
- Ciclos de fechamento por Escape, botão e backdrop; navegação para Perfil libera a rolagem.
- Teste JSDOM desmonta o componente ainda aberto: overflow anterior `scroll` restaurado e zero listeners de breakpoint remanescentes.
- O teste de rolagem verifica deslocamento quando o documento é maior que o viewport; documentos sem conteúdo excedente não são tratados como falha de rolagem.

## 7. Paridade dos cards

Setor, porte e cargo comparados com a tabela para valores presentes. Nos cards, os três valores ausentes são explicitados; a tabela preexistente omite o porte quando ausente. Essa diferença histórica não foi alterada e não transforma ausência em zero.

Fixtures: Tecnologia/51–100/Diretor; três campos nulos; Serviços financeiros/mais de 1.000/cargo extenso. Inspeção nas larguras **320, 390, 768, 900, 901, 1024 e 1440px**. Cards até 900px; tabela a partir de 901px. Contato autorizado, avaliação, entrevista, flags, prioridades, análise, responsável, data e acesso ao detalhe permanecem disponíveis. Captura de 320px confirma a quebra do cargo extenso sem truncamento ou overflow do documento.

## 8. Regressão funcional

### Diagnóstico

A matriz cobre introdução, consentimentos sem pré-seleção, obrigatoriedade, identificação, retomada do rascunho, nove tipos de pergunta, foco no título, falha de salvamento, revisão/diálogo, conclusão com/sem contato e bloqueio. Os cenários complementares enviam consentimento e identificação com opcionais vazios, resposta obrigatória, edição da revisão, confirmação/conclusão e conflito com preservação de rascunho.

Esses são testes da interface e do transporte com respostas sintéticas válidas no contrato público. Não constituem um percurso real ponta a ponta pelo backend público ou pelo serviço de IA. A renderização das seis etapas e dos nove tipos de pergunta não significa que todas as combinações condicionais do catálogo foram percorridas.

### Administração

Leitura, tabs, histórico, procedência, revisão de dados, filtros, erros e perfis usam as funções SQL reais em PGlite. Notas são enviadas pelo navegador, validadas pelo schema de comando e persistidas no banco em memória. ADMIN escreve; CONSULTANT precisa assumir o diagnóstico antes de escrever; VIEWER lê, não recebe formulário e tem a tentativa de escrita rejeitada pelo SQL.

Os testes complementares verificam busy, ausência de envio duplicado durante bloqueio, motivo obrigatório para prioridade urgente, conflito com recarga, falha com preservação do motivo, retry bem-sucedido e versões preservadas após recálculo/regeneração. Os testes de integração existentes cobrem idempotência, concorrência por versão/fingerprint, procedência dos overrides, paginação de históricos, privacidade, consentimento e retenção exclusivamente no banco descartável.

## 9. Acessibilidade

- Contraste: cálculo dos pares reais e estados computados, teste regressivo do par antigo, axe nas interfaces de desktop/mobile.
- Teclado: Tab, Shift+Tab, Espaço, Enter e Escape nos controles exercitados; foco devolvido após diálogos e drawer; foco inicial no título da entrevista.
- Reduced motion: rolagem suave desativada quando a preferência é `reduce`.
- Zoom nativo: perfil Chrome temporário, sem alterar o perfil do usuário, sem `CSS zoom` e sem emulação de escala de dispositivo. Método baseado em [ChromeZoomLevelPrefs do Chromium](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc).
- Zoom medido em 200% e 400%: janela externa de 1296px, áreas úteis de 640 e 320 CSS px, `devicePixelRatio` 2 e 4, `visualViewport.scale=1`. Site, identificação, listagem e workflow sem overflow; campo focado do diálogo dentro da área visível. Capturas de zoom representam o viewport físico, não a página completa.
- Reflow: sete larguras, transições de breakpoint e medidas do documento; a inspeção visual complementa a ausência de overflow.
- Leitor de tela: não executado. Nenhuma sessão de NVDA, JAWS ou Narrator estava disponível; a integração com tecnologia assistiva permanece uma validação manual.
- Os itens `incomplete` do axe são preservados no JSON. Incluem glifos decorativos e não equivalem a violações confirmadas nem a aprovação automática. Não se declara conformidade integral WCAG.

## 10. Evidências visuais

Resultados e capturas finais ficam em `docs/evidencias/correcao-final/`. Cada `resultados.json` registra largura, dimensões, nome da captura, asserções, falhas JavaScript, comandos, contraste computado, auditorias axe e medidas de zoom. As telas usam somente dados sintéticos identificáveis como fixtures.

Índice dos arquivos finais:

- `matriz-numora/resultados.json` e `browser-matriz-numora.log`: regressão da matriz completa com 901px.
- `direcionados-final/resultados.json` e `browser-direcionados-final.log`: NCs, comandos, transições públicas e zoom.
- `raiz/resultados.json`, `browser-raiz.log`, `build-raiz.log` e `exportacao-raiz.json`: execução sem basePath.
- `build-numora.log` e `exportacao-numora.json`: build e referências da exportação para GitHub Pages.
- `direcionados-final/correcao-cards-longos-320.png`: cargo extenso em largura mínima.
- `direcionados-final/correcao-contraste-revisao-1440.png`: ações Editar sobre a superfície secundária.
- `direcionados-final/zoom-400-lista.png` e `zoom-400-identificacao.png`: zoom nativo de 400%.
- `matriz-numora/depois-privacidade-1440.png`: rótulo “Retorno” com contraste corrigido.
- `contrastes.json`, `tests-final.log`, `lint-final.log`, `typecheck.log`, `typecheck-edge.log`: medidas e verificações técnicas.

Inspeção visual direta: card de cargo extenso a 320px, revisão a 1440px e capturas de zoom. A composição, hierarquia e direção visual anteriores são preservadas; a mudança cromática é restrita à legibilidade.

Durante a criação dos testes houve falhas de automação: seletor antigo de tabela, expectativa indevida para porte nulo no desktop, tentativa de escrita do consultor antes de assumir, expectativa de tela de erro em conflito que a interface recupera por aviso e reaproveitamento de rascunho entre cenários. As fixtures e asserções foram ajustadas ao comportamento existente, sem alterar o produto para satisfazer testes. As execuções intermediárias ficaram arquivadas fora do repositório em `C:/Users/kalle/.codex/audits/numora-correction-2026-10-19/attempts/`; os logs finais identificados neste relatório são a evidência de aceite.

## 11. Limitações

1. Documento integral da auditoria de 17/10 não localizado; requisitos corretivos fornecidos no pedido atual são a referência explícita.
2. Autenticação e transporte remoto são interceptados. Não foram testados login real, infraestrutura Supabase, RLS por HTTP, entrega de e-mail ou serviço externo de IA nesta rodada.
3. Fluxo público usa estados sintéticos; não prova persistência pública integrada nem exaure o catálogo condicional.
4. Sem leitor de tela humano e sem matriz Safari/Firefox/dispositivos físicos.
5. A suíte de navegador exige Playwright, Chrome e opcionalmente axe disponíveis externamente. Nenhuma dependência foi instalada para isso.

## 12. Pendências

As limitações de cobertura não são classificadas automaticamente como defeitos do produto. Para aceite integrado, executar em homologação autorizada o percurso público completo com backend/IA reais e uma rodada com leitor de tela. Não executar esses testes em produção.

## 13. FINAL CORRECTION REVIEW — ASTRA

**Base:** `ae965f1`; referência auditada anterior `7ce3ed7`. **Nenhum commit criado.**

Revisar o diff local sobre `ae965f1`: token `--link`, eyebrow contextual na política e documentação/testes. Para NC-02/NC-03, revisar também `git diff 7ce3ed7 ae965f1 -- src/features/admin/AdminShell.tsx src/features/admin/AdminDiagnostics.tsx`, pois essas correções já estavam no remoto.

Critérios para a nova decisão:

1. Confirmar contraste ≥4,5 nos fundos registrados e ausência de mudanças nas cores oficiais.
2. Conferir cenários 900→901 e 899→1024, retorno mobile, foco visível, overflow e cleanup; não basta verificar drawer estático.
3. Comparar cards e tabela com os mesmos dados, incluindo nulos e cargo longo.
4. Ler os logs finais e distinguir testes de componente, integração SQL, navegador com fixtures e testes não executados.
5. Inspecionar capturas selecionadas; não é necessário refazer a auditoria estética original para verificar estas mudanças.
6. Avaliar explicitamente as limitações de QA antes de declarar conformidade integral ou aprovação de implantação.

Risco de produto baixo: alterações cromáticas locais, sem alteração de lógica. Risco residual de validação: integração real e tecnologias assistivas não cobertas. Não incluir novas funcionalidades, redesign, migrações ou mudanças de autorização na revisão deste diff.
