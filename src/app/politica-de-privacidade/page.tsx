import type { Metadata } from "next";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { privacyConfig } from "@/config/privacy";
import { siteConfig } from "@/config/site";

import styles from "./policy.module.css";

const policyUrl = `${new URL(siteConfig.siteUrl).origin}${privacyConfig.internalUrl}/`;

export const metadata: Metadata = {
  title: `Política de Privacidade | ${siteConfig.name}`,
  description:
    "Saiba como a NUMORA trata dados pessoais, protege informações e atende aos direitos previstos na legislação brasileira.",
  alternates: siteConfig.hasConfiguredSiteUrl ? { canonical: policyUrl } : undefined,
  openGraph: {
    title: `Política de Privacidade | ${siteConfig.name}`,
    description: "Informações sobre o tratamento e a proteção de dados pessoais pela NUMORA.",
    url: siteConfig.hasConfiguredSiteUrl ? policyUrl : undefined,
  },
  robots: privacyConfig.isIndexable
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

const sections = [
  ["visao-geral", "1. Visão geral"],
  ["dados-tratados", "2. Dados pessoais tratados"],
  ["finalidades", "3. Finalidades e bases legais"],
  ["diagnostico", "4. Diagnóstico NUMORA"],
  ["compartilhamento", "5. Compartilhamento e operadores"],
  ["retencao", "6. Retenção e eliminação"],
  ["seguranca", "7. Segurança da informação"],
  ["direitos", "8. Direitos dos titulares"],
  ["contato", "9. Contato sobre privacidade"],
  ["alteracoes", "10. Atualizações desta política"],
] as const;

export default function PrivacyPolicyPage() {
  const homeUrl = `${siteConfig.basePath}/`;

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#conteudo-politica">
        Ir para o conteúdo
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href={homeUrl} aria-label="NUMORA — início">
            <BrandLogo className={styles.logo} priority />
          </a>
          <span>Privacidade e proteção de dados</span>
        </div>
      </header>

      <main className={styles.main} id="conteudo-politica">
        <header className={styles.hero}>
          <div className={styles.heroTopline}>
            <p className={styles.eyebrow}>Privacidade</p>
            {privacyConfig.status === "DRAFT" && !privacyConfig.isProductionEnvironment ? (
              <span className={styles.draftBadge}>Versão em revisão</span>
            ) : null}
          </div>
          <h1>Política de Privacidade</h1>
          <p className={styles.lead}>
            Esta política explica como a NUMORA coleta, utiliza, protege e elimina dados
            pessoais em seus canais institucionais e no Diagnóstico Inicial NUMORA.
          </p>
          <dl className={styles.metadata}>
            <div>
              <dt>Versão</dt>
              <dd>{privacyConfig.version}</dd>
            </div>
            <div>
              <dt>Última atualização</dt>
              <dd>{privacyConfig.lastUpdated}</dd>
            </div>
          </dl>
          {privacyConfig.status === "DRAFT" && !privacyConfig.isProductionEnvironment ? (
            <p className={styles.draftNotice}>
              Conteúdo em revisão para ambiente de desenvolvimento.
            </p>
          ) : null}
        </header>

        <div className={styles.layout}>
          <nav className={styles.index} aria-label="Índice da Política de Privacidade">
            <p>Índice</p>
            <ol>
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className={styles.content}>
            <section id="visao-geral">
              <h2>1. Visão geral</h2>
              <p>
                A NUMORA trata dados pessoais com transparência, finalidade e segurança, em
                conformidade com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº
                13.709/2018) e demais normas aplicáveis.
              </p>
              <p>
                Esta política se aplica às informações fornecidas diretamente por visitantes,
                representantes de empresas e participantes do diagnóstico, bem como aos dados
                técnicos estritamente necessários para operar e proteger nossos serviços digitais.
              </p>
            </section>

            <section id="dados-tratados">
              <h2>2. Dados pessoais tratados</h2>
              <p>De acordo com a interação realizada, podemos tratar:</p>
              <ul>
                <li>nome, cargo ou função, empresa e e-mail profissional;</li>
                <li>telefone profissional, quando informado voluntariamente;</li>
                <li>setor, porte e faixa de faturamento da empresa;</li>
                <li>
                  respostas sobre desafios, processos, impactos, prioridades, sistemas e contexto
                  operacional;
                </li>
                <li>
                  registros técnicos de segurança, sessão, data, horário, versão e eventos
                  necessários para manter a integridade do diagnóstico.
                </li>
              </ul>
              <p>
                Não solicitamos senhas, credenciais, segredos comerciais desnecessários, dados
                bancários ou dados pessoais sensíveis. Não inclua esse tipo de informação em
                campos de texto livre.
              </p>
            </section>

            <section id="finalidades">
              <h2>3. Finalidades e bases legais</h2>
              <p>Os dados podem ser utilizados para:</p>
              <ul>
                <li>receber, organizar e compreender a solicitação apresentada;</li>
                <li>produzir uma análise inicial do contexto operacional;</li>
                <li>permitir a revisão das informações pelo próprio participante;</li>
                <li>
                  realizar contato posterior somente quando houver autorização específica para
                  essa finalidade;
                </li>
                <li>prevenir fraude, abuso, duplicidade e incidentes de segurança;</li>
                <li>cumprir obrigações legais e exercer direitos em processos administrativos ou judiciais.</li>
              </ul>
              <p>
                Conforme o caso, o tratamento se apoia no consentimento do titular, em
                procedimentos preliminares relacionados a uma possível contratação, no legítimo
                interesse acompanhado de avaliação de necessidade e impacto, no cumprimento de
                obrigação legal ou no exercício regular de direitos.
              </p>
            </section>

            <section id="diagnostico">
              <h2>4. Diagnóstico NUMORA</h2>
              <p>
                O diagnóstico estrutura as respostas fornecidas para facilitar a compreensão do
                cenário apresentado. A abertura desta política não marca o consentimento, não cria
                um novo diagnóstico e não altera a etapa atual.
              </p>
              <p>
                O consentimento de privacidade somente é registrado quando o participante marca o
                checkbox correspondente e seleciona “Continuar”. A autorização para contato é
                solicitada separadamente e pode ser recusada sem impedir a conclusão do diagnóstico.
              </p>
              <p>
                Recursos automatizados podem apoiar a organização e a síntese das respostas, com
                controles de minimização e segurança. O resultado é informativo, não representa
                decisão exclusivamente automatizada, proposta comercial, diagnóstico definitivo ou
                garantia de resultado.
              </p>
            </section>

            <section id="compartilhamento">
              <h2>5. Compartilhamento e operadores</h2>
              <p>
                A NUMORA pode utilizar fornecedores de infraestrutura, hospedagem, banco de dados,
                segurança e processamento que atuam sob instruções contratuais e apenas na medida
                necessária à prestação do serviço. Também poderá compartilhar informações quando
                exigido por lei, ordem válida de autoridade competente ou para proteção de direitos.
              </p>
              <p>
                Não comercializamos dados pessoais. Caso um fornecedor processe dados fora do
                Brasil, serão adotadas salvaguardas compatíveis com a LGPD e medidas adequadas de
                proteção.
              </p>
            </section>

            <section id="retencao">
              <h2>6. Retenção e eliminação</h2>
              <p>
                Os dados são mantidos apenas pelo período necessário às finalidades informadas,
                considerando a situação do diagnóstico, eventual autorização de contato, obrigações
                legais, prevenção de fraude e exercício regular de direitos. Encerrada a necessidade,
                os dados serão eliminados ou anonimizados, salvo quando a conservação for permitida
                ou exigida por lei.
              </p>
            </section>

            <section id="seguranca">
              <h2>7. Segurança da informação</h2>
              <p>
                Adotamos medidas técnicas e administrativas proporcionais ao risco, incluindo
                controle de acesso, validação de entradas, limitação de requisições, registros de
                auditoria, minimização de dados e proteção das credenciais de serviço. Nenhum sistema
                é absolutamente imune a incidentes, mas mantemos procedimentos para prevenção,
                detecção e resposta.
              </p>
            </section>

            <section id="direitos">
              <h2>8. Direitos dos titulares</h2>
              <p>Nos termos da LGPD, o titular pode solicitar, quando aplicável:</p>
              <ul>
                <li>confirmação da existência de tratamento e acesso aos dados;</li>
                <li>correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
                <li>portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas;</li>
                <li>eliminação dos dados tratados com consentimento e revogação do consentimento;</li>
                <li>informações sobre a possibilidade de não consentir e suas consequências;</li>
                <li>oposição ao tratamento realizado em desconformidade com a lei.</li>
              </ul>
              <p>
                Para proteger o titular, poderemos solicitar informações adicionais para confirmar
                sua identidade antes de atender uma requisição.
              </p>
            </section>

            <section id="contato">
              <h2>9. Contato sobre privacidade</h2>
              {privacyConfig.privacyEmail ? (
                <p>
                  E-mail para assuntos de privacidade:{" "}
                  <a href={`mailto:${privacyConfig.privacyEmail}`}>{privacyConfig.privacyEmail}</a>.
                </p>
              ) : (
                <p>
                  O canal específico para assuntos de privacidade será disponibilizado antes da
                  publicação definitiva em produção.
                </p>
              )}
            </section>

            <section id="alteracoes">
              <h2>10. Atualizações desta política</h2>
              <p>
                Esta política poderá ser atualizada para refletir mudanças legais, operacionais ou
                tecnológicas. A versão e a data da última atualização serão sempre indicadas no início
                da página. Alterações relevantes poderão ser comunicadas pelos canais apropriados.
              </p>
            </section>
          </article>
        </div>

        <aside className={styles.returnNotice} aria-labelledby="retorno-diagnostico">
          <div>
            <p className={styles.eyebrow}>Retorno</p>
            <h2 id="retorno-diagnostico">Volte ao diagnóstico quando estiver pronto</h2>
            <p>
              Se esta página foi aberta a partir do diagnóstico, feche esta aba para retornar. Sua
              sessão e as informações já preenchidas permanecem na aba original.
            </p>
          </div>
          <a href={homeUrl}>Voltar ao site</a>
        </aside>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} NUMORA. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
