import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { OperationalDiagram } from "@/components/sections/OperationalDiagram";
import {
  DiagnosticButton,
  DiagnosticProvider,
} from "@/components/ui/DiagnosticExperience";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { siteConfig } from "@/config/site";
import {
  approach,
  capabilities,
  challenges,
  clientProfiles,
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
            logo: `${siteConfig.siteUrl}${siteConfig.logo}`,
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
        <section className="hero section" id="inicio" aria-labelledby="hero-title">
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
              <p className="hero__statement">
                Não vendemos software. Entregamos transformação operacional.
              </p>
            </div>
            <OperationalDiagram />
          </div>
        </section>

        <section
          className="section positioning"
          id="posicionamento"
          aria-labelledby="positioning-title"
        >
          <div className="container">
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
            <div className="positioning__statement" aria-label="Declaração de posicionamento">
              <p>Não vendemos software.</p>
              <p>Não vendemos Inteligência Artificial.</p>
              <p>Entregamos transformação operacional baseada em resultados.</p>
            </div>
          </div>
        </section>

        <section className="section section--neutral" id="desafios" aria-labelledby="challenges-title">
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

        <section className="section journey" id="jornada" aria-labelledby="journey-title">
          <div className="container">
            <SectionHeader
              eyebrow="Da descoberta à evolução"
              id="journey-title"
              title="Uma jornada contínua de transformação."
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

        <section className="section section--neutral" id="atuacao" aria-labelledby="capabilities-title">
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
          className="section approach"
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
          className="section section--neutral"
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

        <section className="section clients" id="clientes" aria-labelledby="clients-title">
          <div className="container">
            <SectionHeader
              eyebrow="Para quem atuamos"
              id="clients-title"
              title="Empresas que precisam crescer sem multiplicar a complexidade."
              description="A NUMORA atua com empresas que possuem operações estruturadas, processos recorrentes e desafios que exigem visão estratégica, redesenho operacional e capacidade de implementação."
            />
            <div className="clients__grid">
              <article>
                <h3>Perfil de operação</h3>
                <ul className="editorial-list">
                  {clientProfiles.map((profile) => (
                    <li key={profile}>{profile}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h3>Setores prioritários</h3>
                <ul className="sector-list">
                  {prioritySectors.map((sector) => (
                    <li key={sector}>{sector}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section manifesto" id="manifesto" aria-labelledby="manifesto-title">
          <div className="container manifesto__grid">
            <p className="eyebrow">Princípios permanecem</p>
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

        <section className="section diagnostic" id="diagnostico" aria-labelledby="diagnostic-title">
          <div className="container diagnostic__grid">
            <SectionHeader
              eyebrow="Próximo passo"
              id="diagnostic-title"
              title="Qual processo está limitando a sua operação?"
              description="O diagnóstico inicial da NUMORA ajudará a organizar o contexto, identificar impactos e preparar uma conversa mais produtiva com nossos especialistas."
            />
            <div className="diagnostic__actions">
              <DiagnosticButton />
              <details className="diagnostic-details">
                <summary>Entenda como funciona</summary>
                <ol>
                  <li>Você descreve o desafio;</li>
                  <li>Organizamos as informações;</li>
                  <li>Nossa equipe chega preparada para a conversa.</li>
                </ol>
              </details>
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
