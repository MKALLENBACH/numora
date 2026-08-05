import { publicStages } from "@/features/diagnostic/client/content";
import type { InterviewStage, PublicProgress } from "@/features/diagnostic/client/types";

type DiagnosticProgressProps = {
  stage: InterviewStage;
  progress?: PublicProgress;
};

export function DiagnosticProgress({ stage, progress }: DiagnosticProgressProps) {
  const derivedIndex = Math.max(
    0,
    publicStages.findIndex((item) => item.key === stage),
  );
  const currentIndex = Math.min(publicStages.length - 1, Math.max(0, (progress?.currentStep ?? derivedIndex + 1) - 1));
  const completed = new Set(
    progress?.steps.filter((item) => item.status === "COMPLETED").map((item) => item.id) ??
      publicStages.slice(0, currentIndex).map((item) => item.key),
  );
  const current = publicStages[currentIndex];

  return (
    <nav className="diagnostic-progress" aria-label="Progresso do diagnóstico">
      <p className="diagnostic-progress__mobile" aria-live="polite">
        Etapa {currentIndex + 1} de {publicStages.length} — {current.mobile}
      </p>
      <ol className="diagnostic-progress__steps">
        {publicStages.map((item, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = completed.has(item.key) || index < currentIndex;

          return (
            <li
              className={`diagnostic-progress__step${isCurrent ? " is-current" : ""}${isComplete ? " is-complete" : ""}`}
              key={item.key}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="diagnostic-progress__marker" aria-hidden="true">
                {isComplete ? "✓" : index + 1}
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" | "paused" }) {
  const labels = {
    idle: "Pronto para continuar",
    saving: "Salvando…",
    saved: "Resposta salva",
    error: "Não foi possível salvar",
    paused: "Sessão pausada",
  } as const;

  return (
    <p className={`diagnostic-save-status diagnostic-save-status--${status}`} aria-live="polite">
      <span aria-hidden="true" />
      {labels[status]}
    </p>
  );
}
