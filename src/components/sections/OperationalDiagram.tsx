const nodes = ["Pessoas", "Processos", "Dados", "Tecnologia"] as const;

export function OperationalDiagram() {
  return (
    <div className="operational-map" aria-hidden="true">
      <div className="operational-map__label">Mapa operacional</div>
      <div className="operational-map__system">
        {nodes.map((node, index) => (
          <div className={`operational-map__node operational-map__node--${index + 1}`} key={node}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{node}</strong>
          </div>
        ))}
        <div className="operational-map__axis operational-map__axis--horizontal" />
        <div className="operational-map__axis operational-map__axis--vertical" />
        <div className="operational-map__core">
          <span>Resultado</span>
          <strong>Eficiência</strong>
        </div>
      </div>
      <div className="operational-map__footer">
        <span>Visibilidade</span>
        <span>Escalabilidade</span>
        <span>Governança</span>
      </div>
    </div>
  );
}
