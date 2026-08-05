type SectionHeaderProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  id: string;
  inverse?: boolean;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  id,
  inverse = false,
}: SectionHeaderProps) {
  return (
    <header className={`section-header${inverse ? " section-header--inverse" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {description ? <p className="section-header__description">{description}</p> : null}
    </header>
  );
}
