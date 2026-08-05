const nodes = ["Pessoas", "Processos", "Dados", "Tecnologia"] as const;
const outcomes = ["Eficiência", "Visibilidade", "Escalabilidade", "Governança"] as const;

export function OperationalDiagram() {
  return (
    <div className="operational-map" aria-hidden="true">
      <div className="operational-map__system">
        <div className="operational-map__inputs">
          {nodes.map((node, index) => (
            <div className="operational-map__node" key={node}>
              <span>{String(index + 1).padStart(2, "0")}</span>
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
    </div>
  );
}
