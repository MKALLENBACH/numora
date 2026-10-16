const nodes = ["Pessoas", "Processos", "Dados", "Tecnologia"] as const;
const outcomes = ["Eficiência", "Visibilidade", "Escalabilidade", "Governança"] as const;

export function OperationalDiagram() {
  return (
    <figure className="operational-map" aria-label="Pessoas, processos, dados e tecnologia integrados à operação para gerar eficiência, visibilidade, escalabilidade e governança.">
      <figcaption>Uma operação conectada</figcaption>
      <div className="operational-map__system">
        <div className="operational-map__inputs">
          {nodes.map((node) => (
            <div className="operational-map__node" key={node}>
              <strong>{node}</strong>
            </div>
          ))}
        </div>
        <div className="operational-map__connector" />
        <div className="operational-map__core">
          <strong>Operação</strong>
        </div>
        <div className="operational-map__connector" />
        <div className="operational-map__outcomes">
          {outcomes.map((outcome) => (
            <span key={outcome}>{outcome}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}
