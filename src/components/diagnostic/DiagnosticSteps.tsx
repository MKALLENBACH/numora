"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { siteConfig } from "@/config/site";
import {
  companySizes,
  diagnosticCopy,
  industries,
  revenueRanges,
} from "@/features/diagnostic/client/content";
import { diagnosticPublicConfig } from "@/features/diagnostic/client/config";
import {
  formatBrazilianPhone,
  normalizeBrazilianPhone,
  phoneCaretAfterDigits,
} from "@/features/diagnostic/client/input-masks";
import { answerDisplayValue, normalizeReviewSections } from "@/features/diagnostic/client/presentation";
import type {
  AnswerValue,
  IdentificationValues,
  PublicQuestion,
  PublicReview,
  ReviewSection,
} from "@/features/diagnostic/client/types";

import { QuestionRenderer } from "./QuestionInputs";

type AsyncAction = () => void | Promise<void>;

function StepActions({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  busy = false,
  primaryDisabled = false,
}: {
  primaryLabel: string;
  onPrimary?: AsyncAction;
  secondaryLabel?: string;
  onSecondary?: AsyncAction;
  busy?: boolean;
  primaryDisabled?: boolean;
}) {
  return (
    <div className="diagnostic-actions">
      {secondaryLabel && onSecondary ? (
        <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onSecondary} disabled={busy}>
          {secondaryLabel}
        </button>
      ) : null}
      <button
        className="diagnostic-button diagnostic-button--primary"
        type="button"
        onClick={onPrimary}
        disabled={busy || primaryDisabled}
      >
        {busy ? "Aguarde…" : primaryLabel}
      </button>
    </div>
  );
}

export function IntroductionStep({ onStart, busy }: { onStart: AsyncAction; busy: boolean }) {
  return (
    <section className="diagnostic-card diagnostic-card--introduction" aria-labelledby="diagnostic-title">
      <p className="diagnostic-eyebrow">Transformação começa pela compreensão</p>
      <h1 id="diagnostic-title">{diagnosticCopy.introduction.title}</h1>
      <p className="diagnostic-lead">{diagnosticCopy.introduction.description}</p>
      <ul className="diagnostic-benefits">
        {diagnosticCopy.introduction.points.map((point) => (
          <li key={point}>
            <span aria-hidden="true">✓</span>
            {point}
          </li>
        ))}
      </ul>
      <div className="diagnostic-actions">
        <a className="diagnostic-button diagnostic-button--secondary" href={`${siteConfig.basePath}/`}>
          Voltar ao site
        </a>
        <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={onStart} disabled={busy}>
          {busy ? "Aguarde…" : "Começar diagnóstico"}
        </button>
      </div>
      <p className="diagnostic-disclaimer">{diagnosticCopy.introduction.disclaimer}</p>
    </section>
  );
}

export function PrivacyConsentStep({
  onAccept,
  onDecline,
  busy,
}: {
  onAccept: AsyncAction;
  onDecline: AsyncAction;
  busy: boolean;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <section className="diagnostic-card" aria-labelledby="privacy-title">
      <p className="diagnostic-eyebrow">Privacidade</p>
      <h1 id="privacy-title">{diagnosticCopy.privacy.title}</h1>
      <p className="diagnostic-lead">{diagnosticCopy.privacy.description}</p>
      <label className="diagnostic-consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>{diagnosticCopy.privacy.checkbox}</span>
      </label>
      {diagnosticPublicConfig.privacyPolicyUrl ? (
        <a className="diagnostic-text-link" href={diagnosticPublicConfig.privacyPolicyUrl} target="_blank" rel="noreferrer">
          Consultar política de privacidade
        </a>
      ) : (
        <p className="diagnostic-config-warning" role="alert">
          A política de privacidade ainda não foi configurada. Não é possível continuar neste ambiente.
        </p>
      )}
      <StepActions
        primaryLabel="Continuar"
        onPrimary={onAccept}
        secondaryLabel="Não concordo"
        onSecondary={onDecline}
        busy={busy}
        primaryDisabled={!accepted || !diagnosticPublicConfig.privacyPolicyUrl}
      />
    </section>
  );
}

export function CommercialConsentStep({
  onSubmit,
  busy,
}: {
  onSubmit: (accepted: boolean) => void | Promise<void>;
  busy: boolean;
}) {
  const [choice, setChoice] = useState<"yes" | "no" | "">("");

  return (
    <section className="diagnostic-card" aria-labelledby="commercial-title">
      <p className="diagnostic-eyebrow">Autorização de contato</p>
      <h1 id="commercial-title">{diagnosticCopy.commercial.title}</h1>
      <p className="diagnostic-lead">{diagnosticCopy.commercial.description}</p>
      <fieldset className="diagnostic-choice-group diagnostic-choice-group--consent">
        <legend className="diagnostic-visually-hidden">Escolha se autoriza contato</legend>
        <label className="diagnostic-choice">
          <input type="radio" name="commercial-consent" checked={choice === "yes"} onChange={() => setChoice("yes")} />
          <span>Sim, autorizo</span>
        </label>
        <label className="diagnostic-choice">
          <input type="radio" name="commercial-consent" checked={choice === "no"} onChange={() => setChoice("no")} />
          <span>Não autorizo</span>
        </label>
      </fieldset>
      <p className="diagnostic-support">{diagnosticCopy.commercial.support}</p>
      <StepActions
        primaryLabel="Continuar"
        onPrimary={() => onSubmit(choice === "yes")}
        busy={busy}
        primaryDisabled={!choice}
      />
    </section>
  );
}

const initialIdentification: IdentificationValues = {
  name: "",
  role: "",
  company: "",
  email: "",
  industry: "",
  industryOther: "",
  companySize: "",
  phone: "",
  revenueRange: "",
  website: "",
};

const disposableDomains = new Set(["mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com"]);

function validateIdentification(values: IdentificationValues) {
  const errors: Partial<Record<keyof IdentificationValues, string>> = {};
  const required: ReadonlyArray<keyof IdentificationValues> = ["name", "role", "company", "email", "industry", "companySize"];
  required.forEach((key) => {
    if (!values[key].trim()) errors[key] = "Precisamos desta informação para continuar.";
  });

  (["name", "role", "company"] as const).forEach((key) => {
    const value = values[key].trim();
    if (value && value.length < 2) {
      errors[key] = "Informe pelo menos 2 caracteres para continuar.";
    }
  });

  const email = values.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Este endereço de e-mail não parece estar completo. Revise e tente novamente.";
  } else if (disposableDomains.has(email.split("@")[1])) {
    errors.email = "Para continuar, precisamos de um endereço de e-mail permanente.";
  }
  if (values.industry === "OTHER" && !values.industryOther.trim()) {
    errors.industryOther = "Precisamos desta informação para continuar.";
  } else if (values.industryOther && values.industryOther.trim().length < 2) {
    errors.industryOther = "Informe pelo menos 2 caracteres para continuar.";
  }
  const phoneDigits = normalizeBrazilianPhone(values.phone).replace(/\D/g, "");
  const acceptedPhoneLengths = values.phone.startsWith("+") ? [12, 13] : [10, 11];
  if (values.phone && !acceptedPhoneLengths.includes(phoneDigits.length)) {
    errors.phone = "O número informado parece incompleto. Inclua o DDD e revise os números.";
  }
  return errors;
}

function PhoneInput({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const inputId = "identification-phone";
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  function moveCaretAfterUpdate(nextValue: string, digitCount: number) {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      const nextPosition = phoneCaretAfterDigits(formatBrazilianPhone(nextValue), digitCount);
      input.setSelectionRange(nextPosition, nextPosition);
      animationFrameRef.current = null;
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
    const digitsBeforeCursor = event.currentTarget.value.slice(0, cursor).replace(/\D/g, "").length;
    const nextValue = normalizeBrazilianPhone(event.currentTarget.value);
    const nextDigitCount = nextValue.replace(/\D/g, "").length;
    onChange(nextValue);
    moveCaretAfterUpdate(nextValue, Math.min(digitsBeforeCursor, nextDigitCount));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!["Backspace", "Delete"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === null || end === null || start !== end) return;

    const adjacentIndex = event.key === "Backspace" ? start - 1 : start;
    if (adjacentIndex < 0 || adjacentIndex >= input.value.length || /\d/.test(input.value[adjacentIndex])) {
      return;
    }

    const digits = input.value.replace(/\D/g, "");
    const digitsBeforeCursor = input.value.slice(0, start).replace(/\D/g, "").length;
    const digitToRemove = event.key === "Backspace" ? digitsBeforeCursor - 1 : digitsBeforeCursor;
    if (digitToRemove < 0 || digitToRemove >= digits.length) return;

    event.preventDefault();
    const nextDigits = `${digits.slice(0, digitToRemove)}${digits.slice(digitToRemove + 1)}`;
    const nextValue = normalizeBrazilianPhone(input.value.trimStart().startsWith("+") ? `+${nextDigits}` : nextDigits);
    const nextCaretDigit = event.key === "Backspace" ? digitToRemove : digitsBeforeCursor;
    onChange(nextValue);
    moveCaretAfterUpdate(nextValue, nextCaretDigit);
  }

  return (
    <div className="diagnostic-field">
      <label htmlFor={inputId}>Telefone profissional — opcional</label>
      <input
        ref={inputRef}
        id={inputId}
        type="tel"
        inputMode="tel"
        value={formatBrazilianPhone(value)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="tel"
        maxLength={19}
        aria-invalid={Boolean(error)}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
      />
      <p className="diagnostic-support" id={hintId}>
        Informe o DDD. A formatação se adapta a telefone fixo ou celular.
      </p>
      {error ? <p className="diagnostic-field-error" id={errorId}>{error}</p> : null}
    </div>
  );
}

export function IdentificationStep({
  onSubmit,
  busy,
}: {
  onSubmit: (values: IdentificationValues) => void | Promise<void>;
  busy: boolean;
}) {
  const [values, setValues] = useState(initialIdentification);
  const [errors, setErrors] = useState<Partial<Record<keyof IdentificationValues, string>>>({});

  function setField(key: keyof IdentificationValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateIdentification(values);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as keyof IdentificationValues | undefined;
    if (firstError) {
      document.getElementById(`identification-${firstError}`)?.focus();
      return;
    }
    await onSubmit(values);
  }

  const textFields: ReadonlyArray<{ key: keyof IdentificationValues; label: string; type?: string; autoComplete?: string; minLength: number; maxLength: number }> = [
    { key: "name", label: "Nome", autoComplete: "name", minLength: 2, maxLength: 150 },
    { key: "role", label: "Cargo ou função", autoComplete: "organization-title", minLength: 2, maxLength: 150 },
    { key: "company", label: "Empresa", autoComplete: "organization", minLength: 2, maxLength: 200 },
    { key: "email", label: "E-mail profissional", type: "email", autoComplete: "email", minLength: 3, maxLength: 254 },
  ];

  return (
    <section className="diagnostic-card diagnostic-card--wide" aria-labelledby="identification-title">
      <p className="diagnostic-eyebrow">Identificação</p>
      <h1 id="identification-title">{diagnosticCopy.identification.title}</h1>
      <form className="diagnostic-form" onSubmit={handleSubmit} noValidate>
        <div className="diagnostic-form__grid">
          {textFields.map((field) => (
            <div className="diagnostic-field" key={field.key}>
              <label htmlFor={`identification-${field.key}`}>{field.label}</label>
              <input
                id={`identification-${field.key}`}
                type={field.type ?? "text"}
                value={values[field.key]}
                onChange={(event) => setField(field.key, event.target.value)}
                autoComplete={field.autoComplete}
                minLength={field.minLength}
                maxLength={field.maxLength}
                aria-invalid={Boolean(errors[field.key])}
                aria-describedby={errors[field.key] ? `identification-${field.key}-error` : undefined}
                required
              />
              {errors[field.key] ? <p className="diagnostic-field-error" id={`identification-${field.key}-error`}>{errors[field.key]}</p> : null}
            </div>
          ))}
          <PhoneInput
            value={values.phone}
            error={errors.phone}
            onChange={(value) => setField("phone", value)}
          />
          <div className="diagnostic-field">
            <label htmlFor="identification-industry">Setor</label>
            <select id="identification-industry" value={values.industry} onChange={(event) => setField("industry", event.target.value)} aria-invalid={Boolean(errors.industry)} aria-describedby={errors.industry ? "identification-industry-error" : undefined}>
              {industries.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            {errors.industry ? <p className="diagnostic-field-error" id="identification-industry-error">{errors.industry}</p> : null}
          </div>
          {values.industry === "OTHER" ? (
            <div className="diagnostic-field">
              <label htmlFor="identification-industryOther">Qual setor?</label>
              <input id="identification-industryOther" value={values.industryOther} minLength={2} maxLength={150} onChange={(event) => setField("industryOther", event.target.value)} aria-invalid={Boolean(errors.industryOther)} aria-describedby={errors.industryOther ? "identification-industryOther-error" : undefined} />
              {errors.industryOther ? <p className="diagnostic-field-error" id="identification-industryOther-error">{errors.industryOther}</p> : null}
            </div>
          ) : null}
          <div className="diagnostic-field">
            <label htmlFor="identification-companySize">Porte da empresa</label>
            <select id="identification-companySize" value={values.companySize} onChange={(event) => setField("companySize", event.target.value)} aria-invalid={Boolean(errors.companySize)} aria-describedby={errors.companySize ? "identification-companySize-error" : undefined}>
              {companySizes.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            {errors.companySize ? <p className="diagnostic-field-error" id="identification-companySize-error">{errors.companySize}</p> : null}
          </div>
          <div className="diagnostic-field">
            <label htmlFor="identification-revenueRange">Faixa de faturamento — opcional</label>
            <select id="identification-revenueRange" value={values.revenueRange} onChange={(event) => setField("revenueRange", event.target.value)}>
              {revenueRanges.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
        <div className="diagnostic-honeypot" aria-hidden="true">
          <label htmlFor="identification-website">Não preencha este campo</label>
          <input id="identification-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => setField("website", event.target.value)} />
        </div>
        <div className="diagnostic-actions">
          <button className="diagnostic-button diagnostic-button--primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Continuar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function isAnswerEmpty(value: AnswerValue) {
  if (value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    if ("unknown" in value) return false;
    return !Number.isFinite(value.value) || !value.unit;
  }
  return false;
}

function validateNumericAnswer(question: PublicQuestion, value: AnswerValue): string {
  if (!["NUMBER", "NUMBER_WITH_UNIT"].includes(question.responseType)) return "";

  const structuredValue = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
  if (structuredValue && "unknown" in structuredValue) {
    return question.validation?.allowUnknown
      ? ""
      : "Informe um valor numérico para continuar.";
  }

  let numericValue: unknown = value;
  if (question.responseType === "NUMBER_WITH_UNIT") {
    if (!structuredValue || !("value" in structuredValue) || !("unit" in structuredValue)) {
      return "Informe a quantidade e selecione uma unidade para continuar.";
    }

    const allowedUnits = question.validation?.units ?? question.options?.map((option) => option.value) ?? [];
    if (
      typeof structuredValue.unit !== "string" ||
      !structuredValue.unit ||
      (allowedUnits.length > 0 && !allowedUnits.includes(structuredValue.unit))
    ) {
      return "Selecione uma unidade válida para continuar.";
    }
    numericValue = structuredValue.value;
  }

  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    return "Informe um número válido para continuar.";
  }

  const minimum = question.validation?.min;
  if (minimum !== undefined && numericValue < minimum) {
    return `Informe um valor igual ou maior que ${minimum}.`;
  }

  const maximum = question.validation?.max;
  if (maximum !== undefined && numericValue > maximum) {
    return `Informe um valor igual ou menor que ${maximum}.`;
  }

  return "";
}

export function QuestionStep({
  question,
  initialValue,
  onDraftChange,
  onSubmit,
  onSkip,
  onReviewPrevious,
  busy,
  headingRef,
}: {
  question: PublicQuestion;
  initialValue: AnswerValue;
  onDraftChange: (value: AnswerValue, displayValue: string) => void;
  onSubmit: (value: AnswerValue, displayValue: string) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  onReviewPrevious?: () => void;
  busy: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [value, setValue] = useState<AnswerValue>(initialValue);
  const [error, setError] = useState("");

  function handleChange(nextValue: AnswerValue) {
    setValue(nextValue);
    setError("");
    onDraftChange(nextValue, answerDisplayValue(question, nextValue));
  }

  async function handleSubmit() {
    if (isAnswerEmpty(value)) {
      if (question.required === false && onSkip) {
        await onSkip();
        return;
      }
      setError(
        question.required === false
          ? "Use “Pular por enquanto” para continuar sem responder."
          : "Precisamos desta informação para continuar.",
      );
      return;
    }
    if (typeof value === "string" && question.validation?.minLength && value.trim().length < question.validation.minLength) {
      setError(`Descreva um pouco mais — use pelo menos ${question.validation.minLength} caracteres.`);
      return;
    }
    const numericError = validateNumericAnswer(question, value);
    if (numericError) {
      setError(numericError);
      return;
    }
    await onSubmit(value, answerDisplayValue(question, value));
  }

  return (
    <section className="diagnostic-card diagnostic-card--question" aria-labelledby="question-title">
      <p className="diagnostic-eyebrow">Uma pergunta por vez</p>
      <h1 id="question-title" tabIndex={-1} ref={headingRef}>{question.text}</h1>
      <QuestionRenderer question={question} value={value} onChange={handleChange} error={error} />
      <div className="diagnostic-actions">
        {onReviewPrevious ? (
          <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onReviewPrevious} disabled={busy}>
            Voltar
          </button>
        ) : null}
        {onSkip ? (
          <button className="diagnostic-text-button" type="button" onClick={onSkip} disabled={busy}>
            Pular por enquanto
          </button>
        ) : null}
        <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={handleSubmit} disabled={busy}>
          {busy ? "Salvando…" : "Continuar"}
        </button>
      </div>
      <p className="diagnostic-safety-note">Não inclua senhas, chaves de acesso ou informações confidenciais.</p>
    </section>
  );
}

export function ReviewSectionCard({ section, onEdit }: { section: ReviewSection; onEdit: () => void }) {
  return (
    <article className="diagnostic-review-card">
      <div>
        <h2>{section.title}</h2>
        <p>{section.value || "Não informado"}</p>
      </div>
      <button type="button" className="diagnostic-text-button" onClick={onEdit} aria-label={`Editar ${section.title}`}>
        Editar
      </button>
    </article>
  );
}

export function ReviewStep({
  review,
  onEdit,
  onConfirm,
  onAdd,
  busy,
}: {
  review: PublicReview;
  onEdit: (section: ReviewSection) => void;
  onConfirm: AsyncAction;
  onAdd: AsyncAction;
  busy: boolean;
}) {
  const sections = useMemo(() => normalizeReviewSections(review), [review]);

  return (
    <section className="diagnostic-card diagnostic-card--wide" aria-labelledby="review-title">
      <p className="diagnostic-eyebrow">Revisão</p>
      <h1 id="review-title">{diagnosticCopy.review.title}</h1>
      <p className="diagnostic-lead">{diagnosticCopy.review.description}</p>
      <div className="diagnostic-review-grid">
        {sections.map((section) => <ReviewSectionCard key={section.key} section={section} onEdit={() => onEdit(section)} />)}
      </div>
      <div className="diagnostic-actions diagnostic-actions--review">
        <button className="diagnostic-button diagnostic-button--secondary" type="button" onClick={onAdd} disabled={busy}>Acrescentar informação</button>
        <button className="diagnostic-button diagnostic-button--primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Confirmando…" : "Confirmar informações"}</button>
      </div>
    </section>
  );
}

export function CompletionStep({ withContact }: { withContact: boolean }) {
  return (
    <section className="diagnostic-card diagnostic-card--completion" aria-labelledby="completion-title">
      <span className="diagnostic-completion-mark" aria-hidden="true">✓</span>
      <p className="diagnostic-eyebrow">Informações registradas</p>
      <h1 id="completion-title">{diagnosticCopy.completion.title}</h1>
      <p className="diagnostic-lead">{withContact ? diagnosticCopy.completion.withContact : diagnosticCopy.completion.withoutContact}</p>
      <a className="diagnostic-button diagnostic-button--primary" href={`${siteConfig.basePath}/`}>Voltar ao site</a>
    </section>
  );
}

export function BlockedStep() {
  return (
    <section className="diagnostic-card" aria-labelledby="blocked-title">
      <p className="diagnostic-eyebrow">Privacidade</p>
      <h1 id="blocked-title">Não podemos continuar</h1>
      <p className="diagnostic-lead">Sem essa autorização, não podemos continuar com o diagnóstico.</p>
      <a className="diagnostic-button diagnostic-button--primary" href={`${siteConfig.basePath}/`}>Voltar ao site</a>
    </section>
  );
}
