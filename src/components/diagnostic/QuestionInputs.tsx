import { useState } from "react";

import type { AnswerValue, PublicQuestion, QuestionOption } from "@/features/diagnostic/client/types";

type InputProps = {
  question: PublicQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
};

function normalizeOptions(options?: ReadonlyArray<QuestionOption | string>) {
  return (options ?? []).map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

const unitLabels: Readonly<Record<string, string>> = {
  MINUTES: "Minutos",
  HOURS: "Horas",
  DAYS: "Dias",
  WEEKS: "Semanas",
  HOURS_PER_WEEK: "Horas por semana",
  HOURS_PER_MONTH: "Horas por mês",
};

function ErrorMessage({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p className="diagnostic-field-error" id={id}>
      {error}
    </p>
  ) : null;
}

export function LongTextInput({ question, value, onChange, error }: InputProps) {
  const errorId = `${question.id}-error`;
  const maxLength = question.validation?.maxLength ?? 2000;
  const descriptionIds = [error ? errorId : null, `${question.id}-counter`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="diagnostic-field">
      <label className="diagnostic-visually-hidden" htmlFor={question.id}>
        Sua resposta
      </label>
      <textarea
        id={question.id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        rows={7}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionIds}
        placeholder="Descreva com suas palavras…"
      />
      <div className="diagnostic-field__meta">
        <ErrorMessage id={errorId} error={error} />
        <span id={`${question.id}-counter`}>
          {typeof value === "string" ? value.length : 0}/{maxLength}
        </span>
      </div>
    </div>
  );
}

export function ShortTextInput({ question, value, onChange, error }: InputProps) {
  const errorId = `${question.id}-error`;
  const maxLength = question.validation?.maxLength ?? 300;
  const descriptionIds = [error ? errorId : null, `${question.id}-counter`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="diagnostic-field diagnostic-field--compact">
      <label className="diagnostic-visually-hidden" htmlFor={question.id}>
        Sua resposta
      </label>
      <input
        id={question.id}
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionIds}
      />
      <div className="diagnostic-field__meta">
        <ErrorMessage id={errorId} error={error} />
        <span id={`${question.id}-counter`}>
          {typeof value === "string" ? value.length : 0}/{maxLength}
        </span>
      </div>
    </div>
  );
}

export function SingleChoiceInput({ question, value, onChange, error }: InputProps) {
  const isBoolean = question.responseType === "YES_NO" || question.responseType === "CONFIRMATION";
  const options =
    isBoolean
      ? [
          { value: "true", label: "Sim" },
          { value: "false", label: "Não" },
        ]
      : normalizeOptions(question.options);

  return (
    <fieldset className="diagnostic-choice-group" aria-describedby={error ? `${question.id}-error` : undefined}>
      <legend className="diagnostic-visually-hidden">Selecione uma opção</legend>
      {options.map((option) => {
        const normalized = typeof value === "boolean" ? String(value) : String(value ?? "");
        return (
          <label className="diagnostic-choice" key={option.value}>
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={normalized === option.value}
              onChange={() => onChange(isBoolean ? option.value === "true" : option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
      <ErrorMessage id={`${question.id}-error`} error={error} />
    </fieldset>
  );
}

export function MultipleChoiceInput({ question, value, onChange, error }: InputProps) {
  const selected = Array.isArray(value) ? value : [];
  const maxSelections = question.validation?.maxSelections;
  const limitReached = maxSelections !== undefined && selected.length >= maxSelections;
  const descriptionIds = [
    error ? `${question.id}-error` : null,
    maxSelections ? `${question.id}-limit` : null,
  ].filter(Boolean).join(" ");

  return (
    <fieldset className="diagnostic-choice-group" aria-describedby={descriptionIds || undefined}>
      <legend className="diagnostic-visually-hidden">Selecione todas as opções aplicáveis</legend>
      {normalizeOptions(question.options).map((option) => (
        <label className="diagnostic-choice" key={option.value}>
          <input
            type="checkbox"
            value={option.value}
            checked={selected.includes(option.value)}
            disabled={!selected.includes(option.value) && limitReached}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((item) => item !== option.value),
              )
            }
          />
          <span>{option.label}</span>
        </label>
      ))}
      {maxSelections ? (
        <p className="diagnostic-support" id={`${question.id}-limit`}>
          Selecione até {maxSelections} opções.
        </p>
      ) : null}
      <ErrorMessage id={`${question.id}-error`} error={error} />
    </fieldset>
  );
}

export function NumberInput({ question, value, onChange, error }: InputProps) {
  const unknown = Boolean(value && typeof value === "object" && !Array.isArray(value) && "unknown" in value);

  return (
    <div className="diagnostic-field diagnostic-field--compact">
      <label className="diagnostic-visually-hidden" htmlFor={question.id}>
        Valor numérico
      </label>
      <input
        id={question.id}
        type="number"
        inputMode="decimal"
        min={question.validation?.min}
        max={question.validation?.max}
        value={!unknown && typeof value === "number" ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        disabled={unknown}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${question.id}-error` : undefined}
      />
      {question.validation?.allowUnknown ? (
        <label className="diagnostic-consent">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(event) => onChange(event.target.checked ? { unknown: true } : null)}
          />
          <span>Não sei informar</span>
        </label>
      ) : null}
      <ErrorMessage id={`${question.id}-error`} error={error} />
    </div>
  );
}

export function NumberWithUnitInput({ question, value, onChange, error }: InputProps) {
  const unknown = Boolean(value && typeof value === "object" && !Array.isArray(value) && "unknown" in value);
  const current =
    value && typeof value === "object" && !Array.isArray(value) && "value" in value
      ? value
      : null;
  const [numberText, setNumberText] = useState(current ? String(current.value) : "");
  const [unit, setUnit] = useState(current?.unit ?? "");
  const explicitOptions = normalizeOptions(question.options);
  const optionLabels = new Map(explicitOptions.map((option) => [option.value, option.label]));
  const units = normalizeOptions(
    question.validation?.units ?? explicitOptions.map((option) => option.value),
  ).map((option) => ({
    ...option,
    label: optionLabels.get(option.value) ?? unitLabels[option.value] ?? option.label,
  }));

  function commit(nextNumberText: string, nextUnit: string) {
    if (!nextNumberText || !nextUnit) {
      onChange(null);
      return;
    }
    const nextNumber = Number(nextNumberText);
    onChange(Number.isFinite(nextNumber) ? { value: nextNumber, unit: nextUnit } : null);
  }

  return (
    <div className="diagnostic-number-unit">
      <div className="diagnostic-field">
        <label htmlFor={`${question.id}-number`}>Quantidade</label>
        <input
          id={`${question.id}-number`}
          type="number"
          inputMode="decimal"
          min={question.validation?.min}
          max={question.validation?.max}
          value={unknown ? "" : numberText}
          onChange={(event) => {
            const next = event.target.value;
            setNumberText(next);
            commit(next, unit);
          }}
          disabled={unknown}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${question.id}-error` : undefined}
        />
      </div>
      <div className="diagnostic-field">
        <label htmlFor={`${question.id}-unit`}>Unidade</label>
        <select
          id={`${question.id}-unit`}
          value={unknown ? "" : unit}
          onChange={(event) => {
            const next = event.target.value;
            setUnit(next);
            commit(numberText, next);
          }}
          disabled={unknown}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${question.id}-error` : undefined}
        >
          <option value="">Selecione</option>
          {units.map((unit) => (
            <option value={unit.value} key={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
      {question.validation?.allowUnknown ? (
        <label className="diagnostic-consent">
          <input
            type="checkbox"
            checked={unknown}
            onChange={(event) => {
              if (event.target.checked) {
                onChange({ unknown: true });
                return;
              }
              setNumberText("");
              setUnit("");
              onChange(null);
            }}
          />
          <span>Não sei informar</span>
        </label>
      ) : null}
      <ErrorMessage id={`${question.id}-error`} error={error} />
    </div>
  );
}

export function ScaleInput({ question, value, onChange, error }: InputProps) {
  const min = question.validation?.min ?? 1;
  const max = question.validation?.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const priorityLabels: Readonly<Record<number, string>> = {
    1: "Apenas exploratória",
    2: "Importante, mas sem prazo",
    3: "Pretendemos avançar nos próximos meses",
    4: "Precisamos iniciar em breve",
    5: "É uma prioridade imediata",
  };
  const optionLabels = new Map(
    normalizeOptions(question.options).map((option) => [option.value, option.label]),
  );

  return (
    <fieldset className="diagnostic-scale" aria-describedby={error ? `${question.id}-error` : undefined}>
      <legend className="diagnostic-visually-hidden">Selecione um valor de {min} a {max}</legend>
      {values.map((item) => (
        <label key={item}>
          <input
            type="radio"
            name={question.id}
            value={item}
            checked={value === item}
            onChange={() => onChange(item)}
          />
          <span>
            <strong>{item}</strong>
            {(
              optionLabels.get(String(item))?.replace(new RegExp(`^${item}\\s*[—-]\\s*`), "") ??
              (min === 1 && max === 5 ? priorityLabels[item] : "")
            )}
          </span>
        </label>
      ))}
      <ErrorMessage id={`${question.id}-error`} error={error} />
    </fieldset>
  );
}

export function QuestionRenderer(props: InputProps) {
  switch (props.question.responseType) {
    case "SHORT_TEXT":
      return <ShortTextInput {...props} />;
    case "SINGLE_CHOICE":
    case "CURRENCY_RANGE":
    case "YES_NO":
    case "CONFIRMATION":
      return <SingleChoiceInput {...props} />;
    case "MULTIPLE_CHOICE":
      return <MultipleChoiceInput {...props} />;
    case "NUMBER":
      return <NumberInput {...props} />;
    case "NUMBER_WITH_UNIT":
      return <NumberWithUnitInput {...props} />;
    case "SCALE":
      return <ScaleInput {...props} />;
    case "DATE":
      return (
        <div className="diagnostic-field diagnostic-field--compact">
          <label className="diagnostic-visually-hidden" htmlFor={props.question.id}>Data</label>
          <input
            id={props.question.id}
            type="date"
            value={typeof props.value === "string" ? props.value : ""}
            onChange={(event) => props.onChange(event.target.value)}
            aria-invalid={Boolean(props.error)}
            aria-describedby={props.error ? `${props.question.id}-error` : undefined}
          />
          <ErrorMessage id={`${props.question.id}-error`} error={props.error} />
        </div>
      );
    default:
      return <LongTextInput {...props} />;
  }
}
