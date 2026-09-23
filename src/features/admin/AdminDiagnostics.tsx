"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { listAdminDiagnostics } from "./admin-diagnostics-client";
import { useAdminAuth } from "./AdminAuthProvider";
import { AdminClientError } from "./admin-transport";
import {
  ADMIN_DIAGNOSTIC_AREAS,
  ADMIN_DIAGNOSTIC_CLASSIFICATIONS,
  ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES,
  ADMIN_DIAGNOSTIC_FLAG_SEVERITIES,
  ADMIN_DIAGNOSTIC_INDUSTRIES,
  ADMIN_DIAGNOSTIC_STATUSES,
  type AdminDiagnosticListData,
  type AdminDiagnosticListItem,
  type AdminDiagnosticListRequest,
} from "./diagnostics-contract";

type ListFilters = AdminDiagnosticListRequest["filters"];
type ArrayFilterKey =
  | "diagnosticStatus"
  | "classification"
  | "industry"
  | "employeeRange"
  | "primaryArea"
  | "declaredPriority"
  | "flagSeverity";

const INITIAL_REQUEST: AdminDiagnosticListRequest = {
  page: 1,
  pageSize: 25,
  filters: {},
  sort: { field: "createdAt", direction: "desc" },
};

const industryLabels: Record<(typeof ADMIN_DIAGNOSTIC_INDUSTRIES)[number], string> = {
  INDUSTRY: "Indústria",
  CONSTRUCTION: "Construção civil",
  LOGISTICS: "Logística",
  DISTRIBUTION: "Distribuição",
  HEALTHCARE: "Saúde",
  B2B_SERVICES: "Serviços B2B",
  TECHNOLOGY: "Tecnologia",
  RETAIL: "Varejo",
  FINANCIAL_SERVICES: "Serviços financeiros",
  EDUCATION: "Educação",
  PUBLIC_SECTOR: "Setor público",
  OTHER: "Outro",
};

const employeeRangeLabels: Record<(typeof ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES)[number], string> = {
  UP_TO_10: "Até 10 pessoas",
  "11_50": "11 a 50 pessoas",
  "51_100": "51 a 100 pessoas",
  "101_500": "101 a 500 pessoas",
  "501_1000": "501 a 1.000 pessoas",
  ABOVE_1000: "Mais de 1.000 pessoas",
  NOT_INFORMED: "Não informado",
};

const areaLabels: Record<(typeof ADMIN_DIAGNOSTIC_AREAS)[number], string> = {
  COMMERCIAL: "Comercial",
  FINANCE: "Financeiro",
  CUSTOMER_SERVICE: "Atendimento ao cliente",
  OPERATIONS_LOGISTICS: "Operações e logística",
  PROCUREMENT: "Compras",
  HUMAN_RESOURCES: "Recursos humanos",
  LEGAL: "Jurídico",
  TECHNOLOGY: "Tecnologia",
  OTHER: "Outra área",
};

const classificationLabels: Record<(typeof ADMIN_DIAGNOSTIC_CLASSIFICATIONS)[number], string> = {
  PRIORITY: "Prioritário",
  QUALIFIED: "Qualificado",
  INVESTIGATION: "Em investigação",
  LOW_FIT: "Baixa aderência",
  INSUFFICIENT: "Dados insuficientes",
};

const statusLabels: Record<(typeof ADMIN_DIAGNOSTIC_STATUSES)[number], string> = {
  INTRODUCTION: "Introdução",
  PRIVACY_CONSENT: "Privacidade",
  COMMERCIAL_CONSENT: "Consentimento comercial",
  IDENTIFICATION: "Identificação",
  CHALLENGE: "Desafio",
  CURRENT_PROCESS: "Processo atual",
  IMPACT: "Impacto",
  BUYING_CONTEXT: "Contexto de compra",
  REVIEW_GENERATING: "Gerando revisão",
  REVIEW_PENDING: "Revisão pendente",
  REVIEW_EDITING: "Revisão em edição",
  COMPLETING: "Finalizando",
  COMPLETED: "Concluído",
  COMPLETED_NO_CONTACT: "Concluído sem contato",
  BLOCKED: "Bloqueado",
  EXPIRED: "Expirado",
  ABANDONED: "Abandonado",
};

const priorityLabels: Record<number, string> = {
  1: "Apenas exploratória",
  2: "Importante, sem prazo",
  3: "Próximos meses",
  4: "Iniciar em breve",
  5: "Prioridade imediata",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

function singleValue(value: string) {
  return value ? [value] : undefined;
}

function countFilters(filters: ListFilters) {
  return Object.values(filters).filter((value) => (
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ""
  )).length;
}

function selectValue(filters: ListFilters, key: ArrayFilterKey) {
  const value = filters[key];
  return Array.isArray(value) && value.length > 0 ? String(value[0]) : "";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Data indisponível" : dateFormatter.format(parsed);
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}>) {
  return (
    <label className="admin-filter-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={onChange}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function DiagnosticCard({ item }: Readonly<{ item: AdminDiagnosticListItem }>) {
  return (
    <article className="admin-diagnostic-card">
      <header>
        <div>
          <h2>{item.companyName ?? "Empresa não informada"}</h2>
          <p>{item.contactName ?? "Contato não informado"}</p>
        </div>
        <span className={`admin-contact-state admin-contact-state--${item.contactAllowed ? "allowed" : "denied"}`}>
          {item.contactAllowed ? "Contato autorizado" : "Contato não autorizado"}
        </span>
      </header>
      <dl>
        <div>
          <dt>Avaliação</dt>
          <dd>
            {item.finalScore === null ? "Ainda não avaliado" : `${item.finalScore} pontos`}
            {item.classification ? ` · ${classificationLabels[item.classification]}` : ""}
          </dd>
        </div>
        <div>
          <dt>Situação da entrevista</dt>
          <dd>{statusLabels[item.diagnosticStatus]}</dd>
        </div>
        <div>
          <dt>Flag ativa</dt>
          <dd>{item.highestFlagSeverity ?? "Sem flags ativas"}</dd>
        </div>
        <div>
          <dt>Área e prioridade</dt>
          <dd>
            {item.primaryArea ? areaLabels[item.primaryArea] : "Área não informada"}
            {item.declaredPriority ? ` · ${priorityLabels[item.declaredPriority]}` : ""}
          </dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{item.assignee?.displayName ?? "Não atribuído"}</dd>
        </div>
        <div>
          <dt>Criado em</dt>
          <dd>{formatDate(item.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminDiagnostics() {
  const { refresh } = useAdminAuth();
  const [request, setRequest] = useState<AdminDiagnosticListRequest>(INITIAL_REQUEST);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftFilters, setDraftFilters] = useState<ListFilters>({});
  const [data, setData] = useState<AdminDiagnosticListData | null>(null);
  const [error, setError] = useState<AdminClientError | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = draftSearch.trim();
      const search = normalized.length >= 2 ? normalized : undefined;
      setRequest((current) => current.search === search
        ? current
        : { ...current, page: 1, search });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setData(null);
    }, 0);

    void listAdminDiagnostics(request, controller.signal)
      .then((result) => {
        if (!active) return;
        if (result.pagination.totalPages > 0 && request.page > result.pagination.totalPages) {
          setRequest((current) => ({ ...current, page: result.pagination.totalPages }));
          return;
        }
        setData(result);
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) return;
        const clientError = caught instanceof AdminClientError
          ? caught
          : new AdminClientError("GENERIC_ERROR", "Não foi possível carregar os diagnósticos.");
        if (clientError.code === "UNAUTHORIZED" || clientError.code === "ACCESS_DENIED") {
          void refresh();
          return;
        }
        setError(clientError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [refresh, request, retryKey]);

  const activeFilterCount = useMemo(() => countFilters(request.filters), [request.filters]);
  const resultStart = data && data.pagination.totalItems > 0
    ? (data.pagination.page - 1) * data.pagination.pageSize + 1
    : 0;
  const resultEnd = data
    ? Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalItems)
    : 0;

  function updateArrayFilter(key: ArrayFilterKey, value: string) {
    setDraftFilters((current) => ({ ...current, [key]: singleValue(value) } as ListFilters));
  }

  function openFilters() {
    setDraftFilters(request.filters);
    setFilterError(null);
    filterDialogRef.current?.showModal();
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      draftFilters.scoreMin !== undefined &&
      draftFilters.scoreMax !== undefined &&
      draftFilters.scoreMin > draftFilters.scoreMax
    ) {
      setFilterError("O score mínimo não pode ser maior que o score máximo.");
      return;
    }
    if (
      draftFilters.dateFrom &&
      draftFilters.dateTo &&
      draftFilters.dateFrom > draftFilters.dateTo
    ) {
      setFilterError("A data inicial não pode ser posterior à data final.");
      return;
    }
    setFilterError(null);
    setRequest((current) => ({ ...current, page: 1, filters: draftFilters }));
    filterDialogRef.current?.close();
  }

  function clearFilters() {
    setDraftFilters({});
    setFilterError(null);
    setRequest((current) => ({ ...current, page: 1, filters: {} }));
    filterDialogRef.current?.close();
  }

  function updateSort(value: string) {
    const [field, direction] = value.split(":") as [
      AdminDiagnosticListRequest["sort"]["field"],
      AdminDiagnosticListRequest["sort"]["direction"],
    ];
    setRequest((current) => ({ ...current, page: 1, sort: { field, direction } }));
  }

  return (
    <section className="admin-page admin-diagnostics" aria-labelledby="admin-diagnostics-title">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <a href="../">ADM</a><span aria-hidden="true">/</span><span aria-current="page">Diagnósticos</span>
      </nav>
      <p className="admin-eyebrow">Operação comercial</p>
      <h1 id="admin-diagnostics-title">Diagnósticos</h1>
      <p className="admin-page__lead">
        Analise os diagnósticos recebidos e encontre os casos que exigem atenção.
      </p>

      <div className="admin-diagnostics-toolbar">
        <label className="admin-search-field" htmlFor="admin-diagnostic-search">
          <span>Buscar</span>
          <input
            id="admin-diagnostic-search"
            type="search"
            value={draftSearch}
            maxLength={320}
            placeholder="Empresa, contato ou e-mail"
            onChange={(event) => setDraftSearch(event.target.value)}
          />
          {draftSearch.trim().length === 1 ? <small>Digite pelo menos 2 caracteres.</small> : null}
        </label>

        <label className="admin-sort-field" htmlFor="admin-diagnostic-sort">
          <span>Ordenar por</span>
          <select
            id="admin-diagnostic-sort"
            value={`${request.sort.field}:${request.sort.direction}`}
            onChange={(event) => updateSort(event.target.value)}
          >
            <option value="createdAt:desc">Mais recentes</option>
            <option value="createdAt:asc">Mais antigos</option>
            <option value="finalScore:desc">Maior score</option>
            <option value="declaredPriority:desc">Maior prioridade</option>
            <option value="highestFlagSeverity:desc">Maior severidade</option>
            <option value="companyName:asc">Empresa A–Z</option>
          </select>
        </label>

        <button
          ref={filterButtonRef}
          className="admin-secondary-button admin-filter-trigger"
          type="button"
          onClick={openFilters}
        >
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {activeFilterCount > 0 ? (
        <div className="admin-applied-filters">
          <span>{activeFilterCount} {activeFilterCount === 1 ? "filtro aplicado" : "filtros aplicados"}</span>
          <button type="button" onClick={clearFilters}>Limpar filtros</button>
        </div>
      ) : null}

      <dialog
        ref={filterDialogRef}
        className="admin-filter-dialog"
        aria-labelledby="admin-filter-title"
        onClose={() => filterButtonRef.current?.focus()}
      >
        <form method="dialog" onSubmit={applyFilters}>
          <header>
            <div>
              <p className="admin-eyebrow">Refinar resultados</p>
              <h2 id="admin-filter-title">Filtros</h2>
            </div>
            <button
              className="admin-dialog-close"
              type="button"
              aria-label="Fechar filtros"
              onClick={() => filterDialogRef.current?.close()}
            >×</button>
          </header>

          <div className="admin-filter-grid">
            {filterError ? <p className="admin-filter-error" role="alert">{filterError}</p> : null}
            <FilterSelect
              id="filter-status"
              label="Situação da entrevista"
              value={selectValue(draftFilters, "diagnosticStatus")}
              options={ADMIN_DIAGNOSTIC_STATUSES.map((value) => ({ value, label: statusLabels[value] }))}
              onChange={(event) => updateArrayFilter("diagnosticStatus", event.target.value)}
            />
            <FilterSelect
              id="filter-classification"
              label="Classificação"
              value={selectValue(draftFilters, "classification")}
              options={ADMIN_DIAGNOSTIC_CLASSIFICATIONS.map((value) => ({
                value,
                label: classificationLabels[value],
              }))}
              onChange={(event) => updateArrayFilter("classification", event.target.value)}
            />
            <FilterSelect
              id="filter-industry"
              label="Setor"
              value={selectValue(draftFilters, "industry")}
              options={ADMIN_DIAGNOSTIC_INDUSTRIES.map((value) => ({ value, label: industryLabels[value] }))}
              onChange={(event) => updateArrayFilter("industry", event.target.value)}
            />
            <FilterSelect
              id="filter-size"
              label="Porte"
              value={selectValue(draftFilters, "employeeRange")}
              options={ADMIN_DIAGNOSTIC_EMPLOYEE_RANGES.map((value) => ({
                value,
                label: employeeRangeLabels[value],
              }))}
              onChange={(event) => updateArrayFilter("employeeRange", event.target.value)}
            />
            <FilterSelect
              id="filter-area"
              label="Área principal"
              value={selectValue(draftFilters, "primaryArea")}
              options={ADMIN_DIAGNOSTIC_AREAS.map((value) => ({ value, label: areaLabels[value] }))}
              onChange={(event) => updateArrayFilter("primaryArea", event.target.value)}
            />
            <FilterSelect
              id="filter-priority"
              label="Prioridade declarada"
              value={selectValue(draftFilters, "declaredPriority")}
              options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: priorityLabels[value] }))}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : undefined;
                setDraftFilters((current) => ({
                  ...current,
                  declaredPriority: value ? [value as 1 | 2 | 3 | 4 | 5] : undefined,
                }));
              }}
            />
            <FilterSelect
              id="filter-flag"
              label="Maior flag ativa"
              value={selectValue(draftFilters, "flagSeverity")}
              options={ADMIN_DIAGNOSTIC_FLAG_SEVERITIES.map((value) => ({ value, label: value }))}
              onChange={(event) => updateArrayFilter("flagSeverity", event.target.value)}
            />
            <FilterSelect
              id="filter-score-state"
              label="Avaliação"
              value={draftFilters.scoreState ?? ""}
              options={[
                { value: "PRESENT", label: "Com score" },
                { value: "ABSENT", label: "Ainda não avaliado" },
              ]}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                scoreState: event.target.value as "PRESENT" | "ABSENT" || undefined,
                ...(event.target.value === "ABSENT" ? { scoreMin: undefined, scoreMax: undefined } : {}),
              }))}
            />
            <FilterSelect
              id="filter-contact"
              label="Permissão de contato"
              value={draftFilters.contactAllowed === undefined ? "" : String(draftFilters.contactAllowed)}
              options={[
                { value: "true", label: "Contato autorizado" },
                { value: "false", label: "Contato não autorizado" },
              ]}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                contactAllowed: event.target.value === "" ? undefined : event.target.value === "true",
              }))}
            />

            <fieldset className="admin-filter-range">
              <legend>Faixa de score</legend>
              <label htmlFor="filter-score-min">
                <span>Mínimo</span>
                <input
                  id="filter-score-min"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={draftFilters.scoreMin ?? ""}
                  disabled={draftFilters.scoreState === "ABSENT"}
                  onChange={(event) => setDraftFilters((current) => ({
                    ...current,
                    scoreMin: event.target.value === "" ? undefined : Number(event.target.value),
                  }))}
                />
              </label>
              <label htmlFor="filter-score-max">
                <span>Máximo</span>
                <input
                  id="filter-score-max"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={draftFilters.scoreMax ?? ""}
                  disabled={draftFilters.scoreState === "ABSENT"}
                  onChange={(event) => setDraftFilters((current) => ({
                    ...current,
                    scoreMax: event.target.value === "" ? undefined : Number(event.target.value),
                  }))}
                />
              </label>
            </fieldset>

            <fieldset className="admin-filter-range">
              <legend>Data de criação</legend>
              <label htmlFor="filter-date-from">
                <span>De</span>
                <input
                  id="filter-date-from"
                  type="date"
                  value={draftFilters.dateFrom ?? ""}
                  onChange={(event) => setDraftFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value || undefined,
                  }))}
                />
              </label>
              <label htmlFor="filter-date-to">
                <span>Até</span>
                <input
                  id="filter-date-to"
                  type="date"
                  value={draftFilters.dateTo ?? ""}
                  onChange={(event) => setDraftFilters((current) => ({
                    ...current,
                    dateTo: event.target.value || undefined,
                  }))}
                />
              </label>
            </fieldset>
          </div>

          <footer>
            <button className="admin-text-button" type="button" onClick={clearFilters}>Limpar filtros</button>
            <div>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => filterDialogRef.current?.close()}
              >Cancelar</button>
              <button className="admin-primary-button" type="submit">Aplicar filtros</button>
            </div>
          </footer>
        </form>
      </dialog>

      <div className="admin-results-summary" aria-live="polite" aria-atomic="true">
        {loading ? "Carregando diagnósticos…" : data
          ? data.pagination.totalItems === 0
            ? "Nenhum resultado"
            : `Exibindo ${resultStart}–${resultEnd} de ${data.pagination.totalItems}`
          : ""}
      </div>

      {loading ? (
        <div className="admin-list-state" aria-busy="true">
          <span className="admin-spinner" aria-hidden="true" />
          <p>Carregando diagnósticos…</p>
        </div>
      ) : error ? (
        <div className="admin-list-state admin-list-state--error" role="alert">
          <h2>Não foi possível carregar os diagnósticos.</h2>
          <p>{error.message}</p>
          {error.referenceCode ? <small>Código de referência: {error.referenceCode}</small> : null}
          <button className="admin-primary-button" type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="admin-list-state">
          <h2>{activeFilterCount > 0 || request.search
            ? "Nenhum diagnóstico corresponde aos filtros selecionados."
            : "Nenhum diagnóstico recebido até o momento."}</h2>
          {activeFilterCount > 0 || request.search ? (
            <button
              className="admin-secondary-button"
              type="button"
              onClick={() => {
                setDraftSearch("");
                clearFilters();
              }}
            >Limpar busca e filtros</button>
          ) : null}
        </div>
      ) : data ? (
        <>
          <div className="admin-diagnostics-table-wrap">
            <table className="admin-diagnostics-table">
              <caption>Diagnósticos recebidos pela NUMORA</caption>
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Contato</th>
                  <th scope="col">Área</th>
                  <th scope="col">Avaliação</th>
                  <th scope="col">Flag</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Permissão</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.diagnosticId}>
                    <td>
                      <strong>{item.companyName ?? "Empresa não informada"}</strong>
                      <small>
                        {item.industry ? industryLabels[item.industry] : "Setor não informado"}
                        {item.employeeRange ? ` · ${employeeRangeLabels[item.employeeRange]}` : ""}
                      </small>
                    </td>
                    <td>
                      <strong>{item.contactName ?? "Contato não informado"}</strong>
                      <small>{item.contactRole ?? "Cargo não informado"}</small>
                    </td>
                    <td>
                      <strong>{item.primaryArea ? areaLabels[item.primaryArea] : "Não informada"}</strong>
                      <small>{item.declaredPriority ? priorityLabels[item.declaredPriority] : "Prioridade não informada"}</small>
                    </td>
                    <td>
                      <strong>{item.finalScore === null ? "Ainda não avaliado" : item.finalScore}</strong>
                      <small>{item.classification ? classificationLabels[item.classification] : "Sem classificação"}</small>
                    </td>
                    <td>
                      <span className={`admin-flag admin-flag--${item.highestFlagSeverity?.toLowerCase() ?? "none"}`}>
                        {item.highestFlagSeverity ?? "Sem flags"}
                      </span>
                    </td>
                    <td>{statusLabels[item.diagnosticStatus]}</td>
                    <td>
                      <span className={`admin-contact-state admin-contact-state--${item.contactAllowed ? "allowed" : "denied"}`}>
                        {item.contactAllowed ? "Autorizado" : "Não autorizado"}
                      </span>
                    </td>
                    <td>{item.assignee?.displayName ?? "Não atribuído"}</td>
                    <td><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-diagnostic-cards">
            {data.items.map((item) => <DiagnosticCard key={item.diagnosticId} item={item} />)}
          </div>

          {data.pagination.totalPages > 1 ? (
            <nav className="admin-pagination" aria-label="Paginação dos diagnósticos">
              <button
                className="admin-secondary-button"
                type="button"
                disabled={data.pagination.page <= 1}
                onClick={() => setRequest((current) => ({ ...current, page: current.page - 1 }))}
              >Página anterior</button>
              <span aria-current="page">
                Página {data.pagination.page} de {data.pagination.totalPages}
              </span>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => setRequest((current) => ({ ...current, page: current.page + 1 }))}
              >Próxima página</button>
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
