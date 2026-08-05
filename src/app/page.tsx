import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { OperationalDiagram } from "@/components/sections/OperationalDiagram";
import {
  DiagnosticButton,
  DiagnosticProvider,
} from "@/components/ui/DiagnosticExperience";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { diagnosticConfig } from "@/config/diagnostic";
import { siteConfig } from "@/config/site";
import {
  advanceCriteria,
  approach,
  capabilities,
  challenges,
  clientProfiles,
  decisionMakers,
  deferCriteria,
  deliverables,
  diagnosticSteps,
  differentials,
  journey,
  prioritySectors,
} from "@/content/institutional";

export default function Home() {
  const structuredData = siteConfig.hasConfiguredSiteUrl
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${siteConfig.siteUrl}/#organization`,
            name: siteConfig.name,
            url: siteConfig.siteUrl,
            logo: siteConfig.logoUrl,
          },
          {
            "@type": "WebSite",
            "@id": `${siteConfig.siteUrl}/#website`,
            url: siteConfig.siteUrl,
            name: siteConfig.name,
            inLanguage: siteConfig.language,
            publisher: { "@id": `${siteConfig.siteUrl}/#organization` },
          },
        ],
      }
    : null;

  return (
    <DiagnosticProvider>
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>
      <Header />

      <main id="conteudo-principal">
        <section className="hero section section--highlight" id="inicio" aria-labelledby="hero-title">
          <div className="container hero__grid">
            <div className="hero__content">
              <p className="eyebrow">Consultoria de Transformação Operacional</p>
              <h1 id="hero-title">
                Operações melhores.
                <span>Resultados mensuráveis.</span>
              </h1>
              <p className="hero__description">
                A NUMORA transforma processos empresariais por meio de estratégia,
                Inteligência Artificial, automação e integração — sempre começando pelo
                negócio.
              </p>
              <div className="hero__actions">
                <DiagnosticButton />
                <a className="button button--secondary" href="#como-trabalhamos">
                  Conheça nossa abordagem
                </a>
              </div>
              <p className="hero__microcopy">
                {diagnosticConfig.enabled
                  ? diagnosticConfig.microcopy.enabled
                  : diagnosticConfig.microcopy.disabled}
              </p>
              <p className="hero__statement">
                Não vendemos software. Entregamos transformação operacional.
              </p>
            </div>
            <OperationalDiagram />
          </div>
        </section>

        <section
          className="section section--default positioning"
          id="posicionamento"
          aria-labelledby="positioning-title"
        >
          <div className="container positioning__grid">
            <SectionHeader
              eyebrow="Transformação antes da tecnologia"
              id="positioning-title"
              title={
                <>
                  A tecnologia é uma ferramenta.
                  <span>O resultado é a transformação.</span>
                </>
              }
              description="A NUMORA estuda a operação, identifica gargalos e redesenha processos antes de definir qualquer solução tecnológica. Inteligência Artificial e automação são aplicadas somente quando contribuem para um resultado real, mensurável e sustentável."
            />
            <div>
              <div className="positioning__statement" aria-label="Declaração de posicionamento">
                <p>Não vendemos software.</p>
                <p>Não vendemos Inteligência Artificial.</p>
                <p>Entregamos transformação operacional baseada em resultados.</p>
              </div>
              <p className="positioning__complement">
                A solução só faz sentido quando melhora o processo, reduz desperdícios,
                aumenta a capacidade operacional ou melhora a tomada de decisão.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section section--default section--neutral"
          id="desafios"
          aria-labelledby="challenges-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Desafios operacionais"
              id="challenges-title"
              title="Crescimento não deveria significar mais complexidade."
              description="Processos manuais, sistemas desconectados e decisões sem informação limitam a capacidade de crescimento. A NUMORA transforma essas restrições em operações mais inteligentes e escaláveis."
            />
            <div className="challenge-grid">
              {challenges.map((challenge) => (
                <article className="challenge-item" key={challenge.number}>
                  <span>{challenge.number}</span>
                  <div>
                    <h3>{challenge.title}</h3>
                    <p>{challenge.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--default journey" id="jornada" aria-labelledby="journey-title">
          <div className="container">
            <SectionHeader
              eyebrow="Da descoberta à evolução"
              id="journey-title"
              title="Uma jornada contínua de transformação."
              description="A NUMORA atua desde a compreensão do problema até a evolução contínua da operação."
            />
            <div className="journey__steps">
              {journey.map((step, index) => (
                <article className="journey-step" key={step.number}>
                  <div className="journey-step__topline">
                    <span>{step.number}</span>
                    {index < journey.length - 1 ? <span aria-hidden="true">→</span> : null}
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <ul>
                    {step.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section section--default section--neutral"
          id="atuacao"
          aria-labelledby="capabilities-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Capacidades"
              id="capabilities-title"
              title="Estratégia, processos e tecnologia trabalhando juntos."
              description="Cada iniciativa é estruturada a partir da realidade da operação e dos resultados que precisam ser alcançados."
            />
            <div className="capability-list">
              {capabilities.map((capability, index) => (
                <article className="capability-item" key={capability.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section section--default approach"
          id="como-trabalhamos"
          aria-labelledby="approach-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Nossa abordagem"
              id="approach-title"
              title={
                <>
                  A maioria começa pela tecnologia.
                  <span>Nós começamos pelo negócio.</span>
                </>
              }
              description="Antes de propor uma solução, precisamos compreender como a empresa opera, quais são os impactos e onde está o maior potencial de transformação."
            />
            <ol className="approach__sequence">
              {approach.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
            <p className="approach__closing">
              Essa disciplina reduz riscos, aumenta a clareza das decisões e direciona o
              investimento para o que realmente gera valor.
            </p>
          </div>
        </section>

        <section
          className="section section--default section--neutral deliverables"
          id="entregaveis"
          aria-labelledby="deliverables-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Entregáveis"
              id="deliverables-title"
              title="O que uma transformação bem estruturada entrega."
              description="O objetivo não é apenas implementar tecnologia. É criar clareza, melhorar o processo e estabelecer uma base sustentável para a evolução da operação."
            />
            <div className="deliverable-list">
              {deliverables.map((deliverable) => (
                <article className="deliverable-item" key={deliverable.number}>
                  <span>{deliverable.number}</span>
                  <div>
                    <h3>{deliverable.title}</h3>
                    <p>{deliverable.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="deliverables__note">
              A composição de cada projeto depende do contexto, da prioridade e da viabilidade
              da operação.
            </p>
          </div>
        </section>

        <section
          className="section section--default criteria"
          id="criterios"
          aria-labelledby="criteria-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Critérios de decisão"
              id="criteria-title"
              title="Nem toda iniciativa deve começar pela implementação."
              description="O diagnóstico existe para evitar investimento em soluções antes que o problema, o impacto e a viabilidade estejam claros."
            />
            <div className="criteria__grid">
              <article>
                <h3>Quando uma iniciativa deve avançar</h3>
                <ul>
                  {advanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h3>Quando não recomendamos implementar</h3>
                <ul>
                  {deferCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </article>
            </div>
            <p className="criteria__closing">
              Em alguns casos, a melhor decisão é aprofundar o diagnóstico antes de implementar.
            </p>
          </div>
        </section>

        <section
          className="section section--default section--neutral"
          id="diferenciais"
          aria-labelledby="differentials-title"
        >
          <div className="container">
            <SectionHeader
              eyebrow="Por que a NUMORA"
              id="differentials-title"
              title={
                <>
                  Clareza para decidir.
                  <span>Capacidade para executar.</span>
                </>
              }
            />
            <div className="differential-grid">
              {differentials.map((differential, index) => (
                <article className="differential-item" key={differential.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{differential.title}</h3>
                  <p>{differential.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--default clients" id="clientes" aria-labelledby="clients-title">
          <div className="container">
            <SectionHeader
              eyebrow="Para quem atuamos"
              id="clients-title"
              title="Empresas que precisam crescer sem multiplicar a complexidade."
              description="A NUMORA atua com empresas que possuem operações estruturadas, processos recorrentes e desafios que exigem visão estratégica, redesenho operacional e capacidade de implementação."
            />
            <div className="clients__grid">
              <article>
                <p className="clients__index">01</p>
                <h3>Perfil de operação</h3>
                <ul className="editorial-list">
                  {clientProfiles.map((profile) => (
                    <li key={profile}>{profile}</li>
                  ))}
                </ul>
              </article>
              <article>
                <p className="clients__index">02</p>
                <h3>Setores prioritários</h3>
                <ul className="sector-list">
                  {prioritySectors.map((sector) => (
                    <li key={sector}>{sector}</li>
                  ))}
                </ul>
              </article>
              <article>
                <p className="clients__index">03</p>
                <h3>Decisores frequentes</h3>
                <ul className="editorial-list">
                  {decisionMakers.map((decisionMaker) => (
                    <li key={decisionMaker}>{decisionMaker}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section
          className="section section--highlight manifesto"
          id="manifesto"
          aria-labelledby="manifesto-title"
        >
          <div className="container manifesto__grid">
            <p className="eyebrow">Nossa filosofia</p>
            <div className="manifesto__content">
              <h2 id="manifesto-title">
                Empresas não precisam de mais tecnologia.
                <span>Precisam de operações melhores.</span>
              </h2>
              <div className="manifesto__copy">
                <p>A Inteligência Artificial não é o objetivo.</p>
                <p className="manifesto__accent">É uma ferramenta.</p>
                <p>
                  O verdadeiro valor está na capacidade de transformar processos, reduzir
                  desperdícios, acelerar decisões e permitir que pessoas concentrem seu tempo
                  no que realmente gera impacto.
                </p>
                <p>Tecnologia muda rapidamente.</p>
                <p>Princípios permanecem.</p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="section section--default diagnostic"
          id="diagnostico"
          aria-labelledby="diagnostic-title"
        >
          <div className="container diagnostic__grid">
            <SectionHeader
              eyebrow="Próximo passo"
              id="diagnostic-title"
              title="Qual processo está limitando a sua operação?"
              description="O diagnóstico inicial da NUMORA ajuda a organizar o contexto, identificar impactos e preparar uma conversa mais produtiva com nossos especialistas."
            />
            <div className="diagnostic__actions">
              <DiagnosticButton />
              <details className="diagnostic-details">
                <summary>Entenda como funciona</summary>
                <ol>
                  {diagnosticSteps.map((step) => (
                    <li key={step.number}>
                      <span>{step.number}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
              <p className="diagnostic__reassurance">
                Você descreve o contexto. A NUMORA organiza as informações. Nenhuma solução é
                presumida antes da análise.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
    </DiagnosticProvider>
  );
}
