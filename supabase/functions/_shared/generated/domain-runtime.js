import { z as e } from "zod";
var t = e.enum([
	"SHORT_TEXT",
	"LONG_TEXT",
	"SINGLE_CHOICE",
	"MULTIPLE_CHOICE",
	"NUMBER",
	"NUMBER_WITH_UNIT",
	"CURRENCY_RANGE",
	"DATE",
	"YES_NO",
	"SCALE",
	"CONFIRMATION"
]), n = e.enum([
	"CHALLENGE",
	"CURRENT_PROCESS",
	"IMPACT",
	"BUYING_CONTEXT"
]), r = e.enum([
	"INTRODUCTION",
	"PRIVACY_CONSENT",
	"COMMERCIAL_CONSENT",
	"IDENTIFICATION",
	"CHALLENGE",
	"CURRENT_PROCESS",
	"IMPACT",
	"BUYING_CONTEXT",
	"REVIEW",
	"COMPLETION"
]), i = e.enum([
	"IN_PROGRESS",
	"REVIEW",
	"COMPLETING",
	"COMPLETED",
	"COMPLETED_NO_CONTACT",
	"BLOCKED",
	"EXPIRED"
]), a = e.object({
	value: e.string().min(1).max(100),
	label: e.string().min(1).max(200)
}).strict(), o = e.object({
	minLength: e.number().int().nonnegative().optional(),
	maxLength: e.number().int().positive().max(1e4).optional(),
	min: e.number().optional(),
	max: e.number().optional(),
	maxSelections: e.number().int().positive().max(50).optional(),
	units: e.array(e.string().min(1).max(50)).max(20).optional(),
	allowUnknown: e.boolean().optional()
}).strict(), s = e.object({
	id: e.string().min(1).max(100),
	version: e.string().min(1).max(30),
	stage: n,
	text: e.string().min(1).max(500),
	responseType: t,
	required: e.boolean(),
	options: e.array(a).max(50).optional(),
	validation: o.optional()
}).strict(), c = e.object({
	value: e.number().finite().nonnegative(),
	unit: e.string().min(1).max(50)
}).strict(), l = e.object({ unknown: e.literal(!0) }).strict(), u = e.union([
	e.string().max(1e4),
	e.number().finite(),
	e.boolean(),
	e.array(e.string().min(1).max(100)).max(50),
	c,
	l
]), ee = e.enum([
	"IDENTIFICATION",
	"CHALLENGE",
	"CURRENT_PROCESS",
	"IMPACT",
	"BUYING_CONTEXT",
	"REVIEW"
]), te = e.object({
	id: ee,
	label: e.string().min(1).max(80),
	status: e.enum([
		"UPCOMING",
		"CURRENT",
		"COMPLETED"
	])
}).strict(), ne = e.object({
	currentStep: e.number().int().min(1).max(6),
	totalSteps: e.literal(6),
	currentLabel: e.string().min(1).max(80),
	steps: e.array(te).length(6)
}).strict(), re = e.object({
	version: e.number().int().positive(),
	company: e.string().max(200),
	affectedArea: e.string().max(100),
	challenge: e.string().max(800),
	currentProcess: e.string().max(1200),
	participants: e.string().max(500),
	systems: e.array(e.string().max(100)).max(20),
	mainImpacts: e.array(e.string().max(200)).max(15),
	desiredOutcome: e.string().max(800),
	priority: e.string().max(100),
	deadline: e.string().max(300).nullable(),
	decisionContext: e.string().max(800),
	confirmed: e.boolean()
}).strict();
e.object({
	diagnosticId: e.string().uuid(),
	sessionId: e.string().uuid(),
	status: i,
	stage: r,
	currentQuestion: s.nullable(),
	progress: ne,
	review: re.nullable(),
	canGoBack: e.boolean(),
	canResume: e.boolean(),
	saveStatus: e.literal("SAVED")
}).strict();
var ie = e.enum([
	"VALIDATION_ERROR",
	"SESSION_EXPIRED",
	"SESSION_NOT_FOUND",
	"STATE_CONFLICT",
	"RATE_LIMITED",
	"AI_FALLBACK_ACTIVE",
	"PERSISTENCE_UNAVAILABLE",
	"UNAUTHORIZED",
	"BLOCKED",
	"GENERIC_ERROR"
]);
e.object({
	code: ie,
	message: e.string().min(1).max(500),
	referenceCode: e.string().regex(/^[A-Z0-9]{8,24}$/),
	retryable: e.boolean()
}).strict();
//#endregion
//#region src/features/diagnostic/contracts/ai.ts
var ae = e.object({
	path: e.string().min(1),
	value: e.unknown(),
	sourceType: e.enum([
		"REPORTED_FACT",
		"CLIENT_ESTIMATE",
		"AI_INFERENCE",
		"NOT_CONFIRMED"
	]),
	confidence: e.number().min(0).max(1),
	evidenceText: e.string().max(500)
}).strict(), oe = e.object({
	fields: e.array(ae).max(30),
	detectedSensitiveData: e.boolean(),
	sensitiveDataCategories: e.array(e.string().max(100)).max(10),
	responseClarity: e.enum([
		"CLEAR",
		"PARTIAL",
		"VAGUE"
	]),
	summary: e.string().max(500)
}).strict(), d = e.object({
	level: e.enum([
		"CLEAR",
		"PARTIAL",
		"VAGUE"
	]),
	confidence: e.number().min(0).max(1),
	missingAspects: e.array(e.string().max(200)).max(5),
	shouldClarify: e.boolean()
}).strict(), se = e.object({
	question: e.string().min(10).max(300),
	reason: e.string().max(300),
	relatedQuestionId: e.string().min(1).max(100)
}).strict(), f = e.object({
	company: e.string().max(200),
	affectedArea: e.string().max(100),
	challenge: e.string().max(800),
	currentProcess: e.string().max(1200),
	participants: e.string().max(500),
	systems: e.array(e.string().max(100)).max(20),
	mainImpacts: e.array(e.string().max(200)).max(15),
	desiredOutcome: e.string().max(800),
	priority: e.string().max(100),
	deadline: e.string().max(300).nullable(),
	decisionContext: e.string().max(800)
}).strict(), ce = e.object({
	executiveSummary: e.string().max(2e3),
	challengeSummary: e.string().max(1500),
	currentProcessSummary: e.string().max(2e3),
	impactSummary: e.string().max(1500),
	buyingContextSummary: e.string().max(1500),
	technicalContextSummary: e.string().max(1500),
	initialHypotheses: e.array(e.object({
		text: e.string().max(800),
		sourceType: e.literal("AI_INFERENCE"),
		confirmed: e.literal(!1)
	}).strict()).max(10),
	missingInformation: e.array(e.string().max(300)).max(15),
	recommendedQuestions: e.array(e.string().max(500)).max(15),
	recommendedParticipants: e.array(e.string().max(200)).max(10)
}).strict(), p = e.record(e.string(), e.unknown());
e.object({
	question: s,
	answer: u,
	targetPaths: e.array(e.string().min(1).max(200)).max(20),
	knownData: p.default({})
}).strict(), e.object({
	question: s,
	answer: u
}).strict(), e.object({
	question: s,
	answer: u,
	clarity: d,
	priorClarifications: e.array(e.string().max(300)).max(4)
}).strict(), e.object({ structuredData: p }).strict(), e.object({
	structuredData: p,
	review: f,
	missingCriticalPaths: e.array(e.string().min(1).max(200)).max(30)
}).strict();
var le = e.enum([
	"INDUSTRY",
	"CONSTRUCTION",
	"LOGISTICS",
	"DISTRIBUTION",
	"HEALTHCARE",
	"B2B_SERVICES",
	"TECHNOLOGY",
	"RETAIL",
	"FINANCIAL_SERVICES",
	"EDUCATION",
	"PUBLIC_SECTOR",
	"OTHER"
]), ue = e.enum([
	"UP_TO_10",
	"11_50",
	"51_100",
	"101_500",
	"501_1000",
	"ABOVE_1000",
	"NOT_INFORMED"
]), de = e.enum([
	"UP_TO_5M",
	"5M_20M",
	"20M_100M",
	"100M_500M",
	"ABOVE_500M",
	"NOT_INFORMED"
]), fe = /* @__PURE__ */ new Set([
	"10minutemail.com",
	"dispostable.com",
	"fakeinbox.com",
	"guerrillamail.com",
	"mailinator.com",
	"maildrop.cc",
	"temp-mail.org",
	"tempmail.com",
	"throwawaymail.com",
	"yopmail.com"
]);
function m(e) {
	let t = e.trim().toLowerCase().split("@").at(1);
	return t ? fe.has(t) : !1;
}
var pe = e.object({
	name: e.string().trim().min(2).max(150),
	role: e.string().trim().min(2).max(150),
	company: e.string().trim().min(2).max(200),
	email: e.string().trim().toLowerCase().email().max(254).refine((e) => !m(e), { message: "TEMPORARY_EMAIL" }),
	industry: le,
	industryOther: e.string().trim().min(2).max(150).optional(),
	employeeRange: ue,
	phone: e.string().trim().max(30).refine((e) => {
		let t = e.replace(/\D/g, "");
		return t.length >= 10 && t.length <= 13;
	}, "INVALID_PHONE").optional(),
	revenueRange: de.optional()
}).strict().superRefine((e, t) => {
	e.industry === "OTHER" && !e.industryOther && t.addIssue({
		code: "custom",
		message: "INDUSTRY_OTHER_REQUIRED",
		path: ["industryOther"]
	});
});
e.enum([
	"START",
	"PRIVACY_CONSENT",
	"COMMERCIAL_CONSENT",
	"IDENTIFICATION",
	"SUBMIT_ANSWER",
	"UPDATE_REVIEW",
	"CONFIRM_REVIEW",
	"COMPLETE"
]);
var h = e.string().uuid();
e.string().min(20).max(400).regex(/^[^:]+:[^:]+:[A-Z_]+:[0-9a-f-]{36}$/i);
var g = e.object({
	clientRequestId: h,
	rowVersion: e.number().int().nonnegative()
});
g.extend({
	accepted: e.boolean(),
	consentVersion: e.string().trim().min(1).max(50)
}).strict(), g.extend({ identification: pe }).strict(), g.extend({
	questionId: e.string().min(1).max(100),
	questionVersion: e.string().min(1).max(30),
	answer: u,
	honeypot: e.string().max(0).optional(),
	elapsedMs: e.number().int().nonnegative().max(864e5)
}).strict();
var me = e.enum([
	"company",
	"affectedArea",
	"challenge",
	"currentProcess",
	"participants",
	"systems",
	"mainImpacts",
	"desiredOutcome",
	"priority",
	"deadline",
	"decisionContext"
]);
g.extend({
	section: me,
	value: e.union([
		e.string().max(3e3),
		e.array(e.string().max(300)).max(20),
		e.null()
	]),
	reviewVersion: e.number().int().positive()
}).strict();
//#endregion
//#region src/features/diagnostic/domain/answer-validation.ts
var _ = class extends Error {
	constructor(e, t) {
		super(`Invalid answer for question ${e}`), this.name = "DiagnosticAnswerValidationError", this.issues = t;
	}
}, v = (e, t) => ({
	code: e,
	message: t
});
function he(e) {
	return !Array.isArray(e) && typeof e == "object" && !!e && "unknown" in e && e.unknown === !0;
}
function ge(e) {
	let t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e);
	if (!t) return !1;
	let n = Number(t[1]), r = Number(t[2]), i = Number(t[3]), a = new Date(Date.UTC(n, r - 1, i));
	return a.getUTCFullYear() === n && a.getUTCMonth() === r - 1 && a.getUTCDate() === i;
}
function _e(e, t) {
	let n = e.trim();
	if (!n) return [v("ANSWER_REQUIRED", "A resposta não pode estar vazia.")];
	let r = [], i = t.validation?.minLength, a = t.validation?.maxLength;
	return i !== void 0 && n.length < i && r.push(v("TEXT_TOO_SHORT", `A resposta deve ter pelo menos ${i} caracteres.`)), a !== void 0 && n.length > a && r.push(v("TEXT_TOO_LONG", `A resposta deve ter no máximo ${a} caracteres.`)), r;
}
function y(e, t) {
	let n = [], r = t.validation?.min, i = t.validation?.max;
	return r !== void 0 && e < r && n.push(v("VALUE_BELOW_MINIMUM", `O valor mínimo é ${r}.`)), i !== void 0 && e > i && n.push(v("VALUE_ABOVE_MAXIMUM", `O valor máximo é ${i}.`)), t.responseType === "SCALE" && !Number.isInteger(e) && n.push(v("INVALID_RESPONSE_TYPE", "A escala aceita somente valores inteiros.")), n;
}
function b(e) {
	return new Set(e.options?.map(({ value: e }) => e) ?? []);
}
function x(e, t) {
	let n = u.safeParse(t);
	if (!n.success) throw new _(e.id, [v("INVALID_ANSWER_SHAPE", "O formato da resposta é inválido.")]);
	let r = n.data;
	if (he(r)) {
		if (e.validation?.allowUnknown === !0) return r;
		throw new _(e.id, [v("UNKNOWN_NOT_ALLOWED", "Esta pergunta não aceita uma resposta desconhecida.")]);
	}
	let i = [];
	switch (e.responseType) {
		case "SHORT_TEXT":
		case "LONG_TEXT":
			i = typeof r == "string" ? _e(r, e) : [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma resposta em texto.")];
			break;
		case "DATE":
			i = typeof r == "string" ? ge(r) ? [] : [v("INVALID_DATE", "A data deve existir e usar o formato AAAA-MM-DD.")] : [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma data.")];
			break;
		case "SINGLE_CHOICE":
		case "CURRENCY_RANGE": {
			let t = b(e);
			i = typeof r == "string" ? t.has(r) ? [] : [v("INVALID_OPTION", "A opção informada não pertence a esta pergunta.")] : [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma única opção.")];
			break;
		}
		case "MULTIPLE_CHOICE": {
			if (!Array.isArray(r)) {
				i = [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma lista de opções.")];
				break;
			}
			let t = [];
			r.length === 0 && t.push(v("ANSWER_REQUIRED", "Selecione pelo menos uma opção."));
			let n = e.validation?.maxSelections;
			n !== void 0 && r.length > n && t.push(v("TOO_MANY_SELECTIONS", `Selecione no máximo ${n} opções.`)), new Set(r).size !== r.length && t.push(v("DUPLICATE_SELECTION", "A mesma opção não pode ser repetida."));
			let a = b(e);
			r.some((e) => !a.has(e)) && t.push(v("INVALID_OPTION", "Uma ou mais opções não pertencem a esta pergunta.")), i = t;
			break;
		}
		case "NUMBER":
		case "SCALE":
			i = typeof r == "number" ? y(r, e) : [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige um valor numérico.")];
			break;
		case "NUMBER_WITH_UNIT": {
			if (Array.isArray(r) || typeof r != "object" || !r || !("unit" in r)) {
				i = [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige um número e uma unidade.")];
				break;
			}
			let t = [...y(r.value, e)];
			(e.validation?.units ?? []).includes(r.unit) || t.push(v("INVALID_UNIT", "A unidade informada não pertence a esta pergunta.")), i = t;
			break;
		}
		case "YES_NO":
		case "CONFIRMATION": i = typeof r == "boolean" ? [] : [v("INVALID_RESPONSE_TYPE", "Esta pergunta exige uma resposta de sim ou não.")];
	}
	if (i.length > 0) throw new _(e.id, i);
	return r;
}
//#endregion
//#region src/features/diagnostic/domain/value-utils.ts
function S(e, t) {
	let n = e;
	for (let e of t.split(".")) {
		if (typeof n != "object" || !n || !(e in n)) return;
		n = n[e];
	}
	return n;
}
function C(e) {
	return e == null || e === "" ? !1 : Array.isArray(e) ? e.length > 0 : !(typeof e == "object" && "unknown" in e && e.unknown === !0);
}
function w(e) {
	return Array.isArray(e) ? e : [];
}
function T(e) {
	return typeof e == "string" ? e : typeof e == "number" || typeof e == "boolean" ? String(e) : Array.isArray(e) ? e.join(", ") : "unknown" in e ? "Não informado" : `${e.value} ${e.unit}`;
}
function E(e) {
	return Math.round((e + 2 ** -52) * 100) / 100;
}
function D(e) {
	return e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
//#endregion
//#region src/features/diagnostic/domain/security.ts
var ve = "[CONTEÚDO REMOVIDO POR SEGURANÇA]", ye = [
	{
		category: "PRIVATE_KEY",
		severe: !0,
		expression: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/gi
	},
	{
		category: "AUTHORIZATION_BEARER",
		severe: !0,
		expression: /\b(?:authorization\s*:\s*)?bearer\s+[a-z0-9._~+/=-]{16,}\b/gi
	},
	{
		category: "API_KEY",
		severe: !0,
		expression: /\b(?:sk-[a-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/gi
	},
	{
		category: "TOKEN",
		severe: !0,
		expression: /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g
	},
	{
		category: "PASSWORD",
		severe: !0,
		expression: /\b(?:password|senha|passwd|pwd|secret|api[_ -]?key|access[_ -]?key)\s*[:=]\s*[^\s,;]{6,}/gi
	},
	{
		category: "CPF",
		severe: !1,
		expression: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
	},
	{
		category: "BANK_ACCOUNT",
		severe: !1,
		expression: /\b(?:conta|account)\s*(?:corrente)?\s*[:#-]?\s*\d{4,12}(?:-\d{1,2})?\b/gi
	},
	{
		category: "PAYMENT_CARD",
		severe: !1,
		expression: /\b(?:\d[ -]*?){13,19}\b/g
	}
];
function be(e) {
	let t = e.replace(/\D/g, "");
	if (t.length < 13 || t.length > 19 || /^(\d)\1+$/.test(t)) return !1;
	let n = 0, r = !1;
	for (let e = t.length - 1; e >= 0; --e) {
		let i = Number(t[e]);
		r && (i *= 2, i > 9 && (i -= 9)), n += i, r = !r;
	}
	return n % 10 == 0;
}
function xe(e) {
	let t = e, n = 0, r = !1, i = /* @__PURE__ */ new Set();
	for (let e of ye) t = t.replace(e.expression, (t) => e.category === "PAYMENT_CARD" && !be(t) ? t : (n += 1, r ||= e.severe, i.add(e.category), ve));
	return {
		redactedText: t,
		categories: [...i],
		redactionCount: n,
		severity: n === 0 ? "NONE" : r ? "SEVERE" : "SENSITIVE",
		shouldBlock: r
	};
}
//#endregion
//#region src/features/diagnostic/domain/types.ts
var Se = [
	"COMMERCIAL",
	"FINANCE",
	"CUSTOMER_SERVICE",
	"OPERATIONS_LOGISTICS",
	"PROCUREMENT",
	"HUMAN_RESOURCES",
	"LEGAL",
	"TECHNOLOGY",
	"OTHER"
], O = (e, t = "Não informado") => {
	if (typeof e == "string") return e.trim() || t;
	if (typeof e == "number" || typeof e == "boolean") return String(e);
	if (Array.isArray(e)) return e.filter((e) => typeof e == "string").join(", ") || t;
	if (e && typeof e == "object") {
		if ("unknown" in e && e.unknown === !0) return t;
		if ("value" in e && "unit" in e) return `${String(e.value)} ${String(e.unit)}`;
	}
	return t;
}, k = (e) => Array.isArray(e) ? e.filter((e) => typeof e == "string") : [], A = new Set(Se), j = [
	{
		area: "COMMERCIAL",
		patterns: [/\b(?:area\s+(?:comercial|de\s+vendas)|comercial|vendas?|sales)\b/]
	},
	{
		area: "FINANCE",
		patterns: [/\b(?:area\s+(?:financeira|de\s+financas)|financeir[oa]s?|financas?|contabilidade|contabil|fiscal|tesouraria)\b/, /\b(?:contas?\s+a\s+(?:pagar|receber)|faturamento|conciliacao\s+(?:bancaria|financeira|contabil))\b/]
	},
	{
		area: "CUSTOMER_SERVICE",
		patterns: [/\b(?:atendimento(?:\s+ao\s+cliente)?|suporte\s+ao\s+cliente|sac|customer\s+(?:service|success)|sucesso\s+do\s+cliente)\b/]
	},
	{
		area: "OPERATIONS_LOGISTICS",
		patterns: [/\b(?:area\s+operacional|operacoes|logistica|expedicao|producao)\b/]
	},
	{
		area: "PROCUREMENT",
		patterns: [/\b(?:area\s+de\s+compras|compras|suprimentos|procurement|aquisicoes)\b/]
	},
	{
		area: "HUMAN_RESOURCES",
		patterns: [/\b(?:recursos\s+humanos|rh|departamento\s+pessoal|gestao\s+de\s+pessoas|pessoas\s+e\s+cultura)\b/]
	},
	{
		area: "LEGAL",
		patterns: [/\b(?:area\s+(?:juridica|legal)|departamento\s+(?:juridico|legal)|juridic[oa])\b/]
	},
	{
		area: "TECHNOLOGY",
		patterns: [/\b(?:tecnologia\s+da\s+informacao|area\s+de\s+tecnologia|equipe\s+de\s+tecnologia|departamento\s+de\s+tecnologia|infraestrutura\s+de\s+tecnologia|ti)\b/, /\btecnologia\b(?=\s*[:,-])/]
	},
	{
		area: "OTHER",
		patterns: [/\b(?:outra\s+area|area\s+nao\s+listada)\b/]
	}
], Ce = [
	{
		label: "Retrabalho",
		pattern: /\bretrabalho\b/
	},
	{
		label: "Atrasos",
		pattern: /\batrasos?\b/
	},
	{
		label: "Erros",
		pattern: /\berros?\b/
	},
	{
		label: "Falhas",
		pattern: /\bfalhas?\b/
	},
	{
		label: "Perda de tempo",
		pattern: /\bperda\s+de\s+tempo\b/
	},
	{
		label: "Lentidao",
		pattern: /\b(?:lentidao|demora)\b/
	},
	{
		label: "Trabalho manual",
		pattern: /\b(?:trabalho|processo)\s+manual\b/
	},
	{
		label: "Redigitacao",
		pattern: /\b(?:redigitacao|redigitar|digitacao\s+duplicada)\b/
	},
	{
		label: "Gargalo",
		pattern: /\bgargalos?\b/
	},
	{
		label: "Falta de visibilidade",
		pattern: /\bfalta\s+de\s+visibilidade\b/
	}
];
function we(e, t) {
	if (Array.isArray(e)) {
		let t = e.filter((e) => typeof e == "string" && A.has(e));
		return [...new Set(t)];
	}
	if (typeof e == "string" && A.has(e)) return [e];
	let n = D(t), r = j.flatMap(({ area: e, patterns: t }) => {
		let r = t.map((e) => n.search(e)).filter((e) => e >= 0);
		return r.length === 0 ? [] : [{
			area: e,
			index: Math.min(...r)
		}];
	});
	return r.sort((e, t) => e.index - t.index), r.map(({ area: e }) => e);
}
function Te(e) {
	let t = D(e), n = /\b(?:processo|fluxo|rotina|atividade)\s+(?:(?:de|do|da|dos|das)\s+)?(.{2,160}?)(?=\s+(?:(?:e\s+)?(?:gera|causa|provoca|resulta|tem\s+gerado|esta\s+gerando))\b|[.;:\n]|$)/.exec(t);
	if (!n?.[1] || n.index === void 0) return;
	let r = n[0].indexOf(n[1]), i = n.index + r, a = e.slice(i, i + n[1].length).trim();
	return a.length >= 2 ? a : void 0;
}
function Ee(e) {
	let t = D(e);
	return Ce.filter(({ pattern: e }) => e.test(t)).map(({ label: e }) => e);
}
var M = {
	uma: 1,
	um: 1,
	duas: 2,
	dois: 2,
	tres: 3,
	quatro: 4,
	cinco: 5,
	seis: 6,
	sete: 7,
	oito: 8,
	nove: 9,
	dez: 10,
	onze: 11,
	doze: 12,
	treze: 13,
	quatorze: 14,
	quinze: 15,
	dezesseis: 16,
	dezessete: 17,
	dezoito: 18,
	dezenove: 19,
	vinte: 20
};
function De(e) {
	let t = D(e), n = "(?:pessoas?|colaboradores?|participantes?|usuarios?|funcionarios?|profissionais?)", r = RegExp(`\\b(\\d{1,6})\\s+${n}\\b`).exec(t) ?? (/* @__PURE__ */ RegExp("\\b(?:equipe|time)\\s+(?:de|com)\\s+(\\d{1,6})\\b")).exec(t);
	if (r?.[1]) return Number(r[1]);
	let i = Object.keys(M).join("|"), a = RegExp(`\\b(${i})\\s+${n}\\b`).exec(t) ?? RegExp(`\\b(?:equipe|time)\\s+(?:de|com)\\s+(${i})\\b`).exec(t);
	return a?.[1] ? M[a[1]] : void 0;
}
function N(e, t, n, r, i) {
	let a = i.level === "CLEAR" ? .95 : .55;
	switch (e) {
		case "challenge.summary": return typeof t == "string" ? {
			value: n,
			sourceType: "REPORTED_FACT",
			confidence: a
		} : void 0;
		case "challenge.affectedAreas": return r.length > 0 ? {
			value: r,
			sourceType: "REPORTED_FACT",
			confidence: .9
		} : void 0;
		case "challenge.primaryAffectedArea": return r[0] ? {
			value: r[0],
			sourceType: "REPORTED_FACT",
			confidence: .9
		} : void 0;
		case "challenge.process": {
			if (typeof t != "string") return;
			let e = Te(n);
			return e ? {
				value: e,
				sourceType: "REPORTED_FACT",
				confidence: .9
			} : void 0;
		}
		case "challenge.symptoms": {
			if (typeof t != "string") return;
			let e = Ee(n);
			return e.length > 0 ? {
				value: e,
				sourceType: "REPORTED_FACT",
				confidence: .9
			} : void 0;
		}
		case "currentProcess.participants": return typeof t == "string" ? {
			value: n,
			sourceType: "REPORTED_FACT",
			confidence: a
		} : void 0;
		case "currentProcess.participantCount": {
			if (typeof t != "string") return;
			let e = De(n);
			return e === void 0 ? void 0 : {
				value: e,
				sourceType: "REPORTED_FACT",
				confidence: .95
			};
		}
		case "currentProcess.involvedAreas": return r.length > 0 ? {
			value: r,
			sourceType: "REPORTED_FACT",
			confidence: .9
		} : void 0;
		default: return;
	}
}
function P(e) {
	let t = e.question.responseType === "SHORT_TEXT" || e.question.responseType === "LONG_TEXT";
	if (t && typeof e.answer != "string") return {
		level: "VAGUE",
		confidence: .95,
		missingAspects: ["resposta em texto"],
		shouldClarify: !0
	};
	if (!t) try {
		return x(e.question, e.answer), {
			level: "CLEAR",
			confidence: 1,
			missingAspects: [],
			shouldClarify: !1
		};
	} catch {
		return {
			level: "VAGUE",
			confidence: .95,
			missingAspects: ["resposta válida"],
			shouldClarify: !0
		};
	}
	let n = T(e.answer).trim(), r = e.question.validation?.minLength ?? 8, i = D(n), a = /^(nao sei|talvez|algo|isso|automatizar|ia|sim|nao)[.!]?$/i.test(i) || n.length < Math.min(r, 12) ? "VAGUE" : n.length < r ? "PARTIAL" : "CLEAR";
	return {
		level: a,
		confidence: a === "CLEAR" ? .95 : a === "PARTIAL" ? .75 : .9,
		missingAspects: a === "CLEAR" ? [] : ["exemplo concreto"],
		shouldClarify: a !== "CLEAR"
	};
}
var Oe = class {
	async extractAnswer(e) {
		x(e.question, e.answer);
		let t = xe(O(e.answer)), n = P({
			question: e.question,
			answer: e.answer
		}), r = typeof e.answer == "string" ? t.redactedText : e.answer, i = [...new Set(e.targetPaths)], a = !Array.isArray(e.answer) && typeof e.answer == "object" && e.answer !== null && "unknown" in e.answer && e.answer.unknown === !0, o = typeof e.answer == "number" || !Array.isArray(e.answer) && typeof e.answer == "object" && e.answer !== null && "value" in e.answer && "unit" in e.answer, s = we(e.answer, t.redactedText), c = [];
		if (i.length === 1 && i[0]) {
			let l = N(i[0], e.answer, t.redactedText, s, n) ?? {
				value: r,
				sourceType: a ? "NOT_CONFIRMED" : o ? "CLIENT_ESTIMATE" : "REPORTED_FACT",
				confidence: a ? 1 : n.level === "CLEAR" ? .95 : .55
			};
			c.push({
				path: i[0],
				...l,
				evidenceText: t.redactedText.slice(0, 500)
			});
		} else for (let r of i) {
			let i = N(r, e.answer, t.redactedText, s, n);
			i && c.push({
				path: r,
				...i,
				evidenceText: t.redactedText.slice(0, 500)
			});
		}
		return oe.parse({
			fields: c,
			detectedSensitiveData: t.redactionCount > 0,
			sensitiveDataCategories: t.categories,
			responseClarity: n.level,
			summary: t.redactedText.slice(0, 500)
		});
	}
	async evaluateClarity(e) {
		return d.parse(P(e));
	}
	async suggestClarification(e) {
		let t = e.question.id === "PROCESS_001" ? "O que acontece primeiro, quem recebe a demanda e como o processo é finalizado?" : "Poderia compartilhar um exemplo concreto para compreendermos melhor essa situação?";
		return se.parse({
			question: t,
			reason: "A resposta precisa de contexto adicional.",
			relatedQuestionId: e.question.id
		});
	}
	async generateReview(e) {
		let t = e.structuredData;
		return f.parse({
			company: O(t["lead.company"]),
			affectedArea: O(t["challenge.primaryAffectedArea"]),
			challenge: O(t["challenge.summary"]),
			currentProcess: O(t["currentProcess.description"]),
			participants: O(t["currentProcess.participants"]),
			systems: k(t["currentProcess.systems"]),
			mainImpacts: k(t["impact.categories"]),
			desiredOutcome: O(t["challenge.desiredOutcome"]),
			priority: O(t["buyingContext.priority"]),
			deadline: typeof t["buyingContext.deadline"] == "string" ? t["buyingContext.deadline"] : null,
			decisionContext: k(t["buyingContext.decisionMakers"]).join(", ") || "Não informado"
		});
	}
	async generateBriefing(e) {
		return ce.parse({
			executiveSummary: `${e.review.company}: ${e.review.challenge}`,
			challengeSummary: e.review.challenge,
			currentProcessSummary: e.review.currentProcess,
			impactSummary: e.review.mainImpacts.join(", ") || "Não informado",
			buyingContextSummary: e.review.decisionContext,
			technicalContextSummary: e.review.systems.join(", ") || "Não informado",
			initialHypotheses: [],
			missingInformation: e.missingCriticalPaths,
			recommendedQuestions: e.missingCriticalPaths.map((e) => `Validar ${e}`).slice(0, 15),
			recommendedParticipants: []
		});
	}
}, ke = /* @__PURE__ */ new Set([
	"bol.com.br",
	"gmail.com",
	"hotmail.com",
	"icloud.com",
	"live.com",
	"outlook.com",
	"proton.me",
	"protonmail.com",
	"uol.com.br",
	"yahoo.com",
	"yahoo.com.br"
]), Ae = /* @__PURE__ */ new Set([
	"PRIVACY_NOT_ACCEPTED",
	"COMMERCIAL_CONTACT_NOT_ACCEPTED",
	"CONSENT_VERSION_MISSING"
]), je = /* @__PURE__ */ new Set([
	"TOOL_ONLY_REQUEST",
	"AUTOMATION_ONLY_EXPECTATION",
	"LOW_METHODOLOGY_FIT",
	"STAFF_AUGMENTATION_EXPECTATION",
	"FREE_WORK_EXPECTATION",
	"FREE_WORK_REQUIREMENT",
	"COMPLETELY_OUT_OF_SCOPE",
	"LOW_OPERATIONAL_COMPLEXITY",
	"RESEARCH_ONLY"
]), Me = /* @__PURE__ */ new Set([
	"NO_INTERNAL_OWNER",
	"OWNER_UNDEFINED",
	"DECISION_PROCESS_UNDEFINED",
	"NO_EXECUTIVE_SPONSOR",
	"BUDGET_UNDEFINED",
	"BUDGET_REJECTED",
	"LOW_URGENCY",
	"DEADLINE_INCONSISTENT"
]), Ne = /* @__PURE__ */ new Set([
	"LIMITED_DATA",
	"DATA_FRAGMENTED",
	"NO_DATA_AVAILABLE",
	"SYSTEMS_NOT_IDENTIFIED",
	"INTEGRATION_FEASIBILITY_UNKNOWN",
	"NO_IT_AVAILABILITY",
	"IT_AVAILABILITY_UNKNOWN",
	"LEGACY_SYSTEM_DEPENDENCY",
	"MANUAL_PROCESS_WITHOUT_RECORDS"
]), Pe = /* @__PURE__ */ new Set([
	"STRATEGIC_ENTERPRISE",
	"MULTI_AREA_TRANSFORMATION",
	"HIGH_REGULATORY_RISK",
	"SECURITY_RELEVANT_PROJECT",
	"UNUSUAL_TECHNICAL_COMPLEXITY",
	"CRITICAL_OPERATION",
	"HIGH_EXPECTED_IMPACT"
]), Fe = /* @__PURE__ */ new Set([
	"SENSITIVE_DATA_SHARED",
	"SEVERE_SENSITIVE_DATA_EXPOSURE",
	"PROMPT_INJECTION_ATTEMPT",
	"PERSISTENT_PROMPT_INJECTION",
	"PERSISTENT_ABUSE",
	"SPAM_OR_BOT",
	"FRAUD_SUSPECTED",
	"ILLEGAL_REQUEST",
	"IDENTITY_EVIDENTLY_FALSE"
]);
function Ie(e) {
	return Ae.has(e) ? "CONSENT" : je.has(e) ? "FIT" : Me.has(e) ? "MATURITY" : Ne.has(e) ? "TECHNICAL" : Pe.has(e) ? "COMPLEXITY" : Fe.has(e) ? "SECURITY" : e === "AI_EXTRACTION_FAILURE" || e === "AI_PROVIDER_UNAVAILABLE" || e === "DATABASE_PERSISTENCE_FAILURE" ? "SYSTEM" : "DATA";
}
function Le(e) {
	return [
		"PRIVACY_NOT_ACCEPTED",
		"TEMPORARY_EMAIL",
		"SEVERE_SENSITIVE_DATA_EXPOSURE",
		"PERSISTENT_PROMPT_INJECTION",
		"PERSISTENT_ABUSE",
		"FRAUD_SUSPECTED",
		"ILLEGAL_REQUEST"
	].includes(e) ? "S3" : [
		"CONSENT_VERSION_MISSING",
		"CONTRADICTORY_INFORMATION",
		"INSUFFICIENT_INFORMATION",
		"HIGH_IMPACT_LOW_INFORMATION",
		"COMPLETELY_OUT_OF_SCOPE",
		"IDENTITY_EVIDENTLY_FALSE",
		"DATABASE_PERSISTENCE_FAILURE"
	].includes(e) ? "S2" : [
		"COMMERCIAL_CONTACT_NOT_ACCEPTED",
		"PERSONAL_EMAIL",
		"PHONE_NOT_PROVIDED",
		"STRATEGIC_ENTERPRISE",
		"MULTI_AREA_TRANSFORMATION"
	].includes(e) ? "S0" : "S1";
}
function Re(e, t) {
	let n = Le(e);
	return {
		code: e,
		displayName: e.toLowerCase().split("_").map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" "),
		category: Ie(e),
		severity: n,
		reason: t,
		schedulingEffect: n === "S3" ? "BLOCK_ALL" : n === "S2" ? "BLOCK_AUTOMATIC" : "NONE"
	};
}
function ze(e) {
	return e?.trim().toLowerCase().split("@").at(1);
}
var Be = {
	TOOL_ONLY_REQUEST: "TOOL_ONLY_REQUEST",
	AUTOMATION_ONLY_EXPECTATION: "AUTOMATION_ONLY_EXPECTATION",
	STAFF_AUGMENTATION_EXPECTATION: "STAFF_AUGMENTATION_EXPECTATION",
	FREE_WORK_EXPECTATION: "FREE_WORK_EXPECTATION",
	FREE_WORK_REQUIREMENT: "FREE_WORK_REQUIREMENT",
	COMPLETELY_OUT_OF_SCOPE: "COMPLETELY_OUT_OF_SCOPE",
	RESEARCH_ONLY: "RESEARCH_ONLY",
	CONTRADICTORY_INFORMATION: "CONTRADICTORY_INFORMATION",
	SENSITIVE_DATA_SHARED: "SENSITIVE_DATA_SHARED",
	SEVERE_SENSITIVE_DATA_EXPOSURE: "SEVERE_SENSITIVE_DATA_EXPOSURE",
	PROMPT_INJECTION_ATTEMPT: "PROMPT_INJECTION_ATTEMPT",
	PERSISTENT_PROMPT_INJECTION: "PERSISTENT_PROMPT_INJECTION",
	PERSISTENT_ABUSE: "PERSISTENT_ABUSE",
	SPAM_OR_BOT: "SPAM_OR_BOT",
	FRAUD_SUSPECTED: "FRAUD_SUSPECTED",
	ILLEGAL_REQUEST: "ILLEGAL_REQUEST",
	IDENTITY_EVIDENTLY_FALSE: "IDENTITY_EVIDENTLY_FALSE",
	AI_EXTRACTION_FAILURE: "AI_EXTRACTION_FAILURE",
	AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
	DATABASE_PERSISTENCE_FAILURE: "DATABASE_PERSISTENCE_FAILURE"
};
function Ve(e) {
	let { state: t, assessment: n } = e, r = t.structuredData, i = /* @__PURE__ */ new Map(), a = (e, t) => {
		i.has(e) || i.set(e, Re(e, t));
	};
	t.privacyConsent === !1 && a("PRIVACY_NOT_ACCEPTED", "O consentimento de privacidade não foi aceito."), t.commercialConsent === !1 && a("COMMERCIAL_CONTACT_NOT_ACCEPTED", "O contato comercial não foi autorizado; a entrevista pode continuar."), (t.privacyConsent !== null && !t.privacyConsentVersion || t.commercialConsent !== null && !t.commercialConsentVersion) && a("CONSENT_VERSION_MISSING", "Há consentimento sem versão registrada.");
	let o = ze(r.lead.email);
	o && ke.has(o) && a("PERSONAL_EMAIL", "Foi informado um domínio de e-mail pessoal permitido."), r.lead.email && m(r.lead.email) && a("TEMPORARY_EMAIL", "Foi detectado um domínio de e-mail temporário."), r.lead.phone || a("PHONE_NOT_PROVIDED", "Telefone profissional opcional não informado."), (!r.challenge.summary || r.challenge.summary.trim().length < 20) && a("PROBLEM_UNCLEAR", "O desafio ainda não possui descrição suficientemente clara."), t.answers.some((e) => e.clarity === "VAGUE") && a("LOW_RESPONSE_CONFIDENCE", "Ao menos uma resposta permanece vaga."), !t.reviewConfirmed && ["REVIEW_PENDING", "COMPLETING"].includes(t.status) && a("REVIEW_NOT_CONFIRMED", "O resumo ainda não foi confirmado pelo visitante."), n?.assessmentConfidence === "INSUFFICIENT" && a("INSUFFICIENT_INFORMATION", "O peso avaliado está abaixo do mínimo de 50.");
	let s = r.impact.categories ?? [], c = s.some((e) => [
		"HIGH_OPERATIONAL_COST",
		"REVENUE_LOSS",
		"REGULATORY_RISK",
		"QUALITY_RISK"
	].includes(e));
	c && n?.assessmentConfidence === "INSUFFICIENT" && a("HIGH_IMPACT_LOW_INFORMATION", "Há impacto relevante reportado, mas informação insuficiente para avaliação."), r.buyingContext.processRedesignOpenness === "AUTOMATION_ONLY" && (a("AUTOMATION_ONLY_EXPECTATION", "Foi declarada expectativa restrita à automação."), a("LOW_METHODOLOGY_FIT", "A abertura para redesenho de processo é baixa.")), r.lead.employeeRange === "UP_TO_10" && (r.currentProcess.systems?.length ?? 0) <= 1 && a("LOW_OPERATIONAL_COMPLEXITY", "O contexto indica baixa complexidade operacional."), r.buyingContext.internalOwnerExists === !1 ? a("NO_INTERNAL_OWNER", "Não existe responsável interno para a iniciativa.") : r.buyingContext.internalOwnerExists === !0 && !r.buyingContext.internalOwnerArea && a("OWNER_UNDEFINED", "Existe responsável, mas sua área ou função não foi definida."), !r.buyingContext.decisionMakers || r.buyingContext.decisionMakers.includes("UNDEFINED") ? a("DECISION_PROCESS_UNDEFINED", "O processo decisório ainda não está definido.") : r.buyingContext.decisionMakers.some((e) => ["EXECUTIVE_BOARD", "PARTNERS"].includes(e)) || a("NO_EXECUTIVE_SPONSOR", "Patrocínio executivo não foi identificado."), (!r.buyingContext.budgetStatus || ["UNKNOWN", "PREFER_NOT_TO_SAY"].includes(r.buyingContext.budgetStatus)) && a("BUDGET_UNDEFINED", "O contexto de investimento permanece indefinido."), r.buyingContext.budgetStatus === "REJECTED" && a("BUDGET_REJECTED", "O investimento foi reportado como rejeitado."), (r.buyingContext.priority ?? 0) <= 2 && a("LOW_URGENCY", "A prioridade declarada é baixa ou exploratória."), r.technicalContext.dataAvailability === "AVAILABLE_FRAGMENTED" && a("DATA_FRAGMENTED", "Os dados foram reportados como fragmentados."), r.technicalContext.dataAvailability === "PARTIAL" && a("LIMITED_DATA", "Os dados foram reportados como parcialmente disponíveis."), r.technicalContext.dataAvailability === "PRACTICALLY_UNAVAILABLE" && a("NO_DATA_AVAILABLE", "Os dados foram reportados como praticamente indisponíveis."), (!r.currentProcess.systems || r.currentProcess.systems.length === 0) && a("SYSTEMS_NOT_IDENTIFIED", "Os sistemas envolvidos ainda não foram identificados."), (r.currentProcess.systems?.length ?? 0) >= 2 && r.technicalContext.integrationLikely === void 0 && a("INTEGRATION_FEASIBILITY_UNKNOWN", "Há múltiplos sistemas e a viabilidade de integração ainda não foi avaliada."), ["NO_INTERNAL_TEAM", "UNAVAILABLE"].includes(r.technicalContext.itAvailability ?? "") ? a("NO_IT_AVAILABILITY", "Disponibilidade técnica interna não confirmada.") : (!r.technicalContext.itAvailability || r.technicalContext.itAvailability === "UNKNOWN") && a("IT_AVAILABILITY_UNKNOWN", "Disponibilidade da equipe técnica é desconhecida."), t.signals.includes("MANUAL_PROCESS") && r.technicalContext.dataAvailability === "PRACTICALLY_UNAVAILABLE" && a("MANUAL_PROCESS_WITHOUT_RECORDS", "Processo manual sem registros disponíveis."), r.lead.employeeRange === "ABOVE_1000" && a("STRATEGIC_ENTERPRISE", "O porte reportado indica contexto empresarial estratégico."), (r.currentProcess.involvedAreas?.length ?? 0) >= 3 && a("MULTI_AREA_TRANSFORMATION", "O processo envolve três ou mais áreas."), s.includes("REGULATORY_RISK") && a("HIGH_REGULATORY_RISK", "Foi reportado impacto de natureza regulatória."), (c || ["200K_1M_YEAR", "ABOVE_1M_YEAR"].includes(r.impact.reportedFinancialImpact ?? "")) && a("HIGH_EXPECTED_IMPACT", "O impacto reportado exige avaliação especializada.");
	let l = D(r.impact.riskOfInaction ?? "");
	/paralisa|critica|interrupcao|indisponibilidade/.test(l) && a("CRITICAL_OPERATION", "O risco de não agir indica possível operação crítica.");
	for (let e of t.signals) {
		let t = Be[e];
		t && a(t, `Sinal determinístico registrado: ${e}.`);
	}
	return [...i.values()];
}
//#endregion
//#region src/features/diagnostic/domain/routing.ts
var F = (e, ...t) => e.some((e) => t.includes(e.code));
function He(e) {
	if (e.privacyConsent === !1 || F(e.flags, "PRIVACY_NOT_ACCEPTED", "ILLEGAL_REQUEST", "SEVERE_SENSITIVE_DATA_EXPOSURE", "PERSISTENT_PROMPT_INJECTION", "PERSISTENT_ABUSE", "FRAUD_SUSPECTED")) return {
		route: "BLOCKED",
		automaticSchedulingEligible: !1,
		reasonCode: "BLOCKING_CONDITION"
	};
	if (F(e.flags, "COMPLETELY_OUT_OF_SCOPE")) return {
		route: "OUT_OF_SCOPE",
		automaticSchedulingEligible: !1,
		reasonCode: "CONFIRMED_OUT_OF_SCOPE"
	};
	if (e.commercialConsent === !1) return {
		route: "NO_CONTACT",
		automaticSchedulingEligible: !1,
		reasonCode: "COMMERCIAL_CONTACT_NOT_ACCEPTED"
	};
	if (e.flags.some((e) => e.severity === "S2") || e.assessment.assessmentConfidence === "INSUFFICIENT" || e.assessment.finalScore === null) return {
		route: "MANUAL_REVIEW",
		automaticSchedulingEligible: !1,
		reasonCode: "MANUAL_REVIEW_REQUIRED"
	};
	let t = e.assessment.finalScore;
	return t >= 80 ? {
		route: "SENIOR_MEETING",
		automaticSchedulingEligible: !1,
		reasonCode: "SCORE_80_100"
	} : t >= 60 ? {
		route: "STANDARD_MEETING",
		automaticSchedulingEligible: !1,
		reasonCode: "SCORE_60_79"
	} : t >= 40 ? {
		route: "EXPLORATORY_MEETING",
		automaticSchedulingEligible: !1,
		reasonCode: "SCORE_40_59"
	} : {
		route: "NURTURE",
		automaticSchedulingEligible: !1,
		reasonCode: "SCORE_0_39"
	};
}
//#endregion
//#region src/features/diagnostic/domain/scoring.ts
var Ue = "1.0.0", I = (e) => Math.max(0, Math.min(1, e)), L = (e) => Array.isArray(e) ? e.filter((e) => typeof e == "string") : [], R = [
	{
		code: "FIT_COMPANY_SIZE_MATURITY",
		dimension: "NUMORA_FIT",
		maximumPoints: 6,
		paths: ["lead.employeeRange"],
		score: ({ lead: e }) => ({
			UP_TO_10: .33,
			"11_50": .67,
			"51_100": .83,
			"101_500": 1,
			"501_1000": 1,
			ABOVE_1000: 1,
			NOT_INFORMED: 0
		})[e.employeeRange ?? ""] ?? 0
	},
	{
		code: "FIT_INDUSTRY",
		dimension: "NUMORA_FIT",
		maximumPoints: 4,
		paths: ["lead.industry"],
		score: ({ lead: e }) => e.industry === "OTHER" ? .5 : +!!e.industry
	},
	{
		code: "FIT_OPERATIONAL_COMPLEXITY",
		dimension: "NUMORA_FIT",
		maximumPoints: 6,
		paths: [
			"currentProcess.participantCount",
			"currentProcess.involvedAreas",
			"currentProcess.systems"
		],
		score: ({ currentProcess: e }) => {
			let t = e.participantCount ?? 0, n = e.involvedAreas?.length ?? 0, r = e.systems?.length ?? 0;
			return t >= 5 || n >= 3 || r >= 4 ? 1 : t >= 2 || n >= 2 || r >= 2 ? .67 : .33;
		}
	},
	{
		code: "FIT_PROBLEM_COMPATIBILITY",
		dimension: "NUMORA_FIT",
		maximumPoints: 4,
		paths: [
			"challenge.primaryAffectedArea",
			"challenge.process",
			"buyingContext.processRedesignOpenness"
		],
		score: ({ challenge: e, buyingContext: t }) => t.processRedesignOpenness === "AUTOMATION_ONLY" ? .25 : e.primaryAffectedArea && e.process ? 1 : e.primaryAffectedArea || e.process ? .5 : 0
	},
	{
		code: "CLARITY_PROCESS_IDENTIFIED",
		dimension: "PROBLEM_CLARITY",
		maximumPoints: 5,
		paths: [
			"challenge.primaryAffectedArea",
			"challenge.process",
			"challenge.summary"
		],
		score: ({ challenge: e }) => e.primaryAffectedArea && (e.process || e.summary) ? 1 : .5
	},
	{
		code: "CLARITY_SYMPTOMS_IDENTIFIED",
		dimension: "PROBLEM_CLARITY",
		maximumPoints: 3,
		paths: ["challenge.symptoms"],
		score: ({ challenge: e }) => I((e.symptoms?.length ?? 0) / 2)
	},
	{
		code: "CLARITY_DESIRED_OUTCOME",
		dimension: "PROBLEM_CLARITY",
		maximumPoints: 3,
		paths: ["challenge.desiredOutcome"],
		score: ({ challenge: e }) => +!!e.desiredOutcome
	},
	{
		code: "CLARITY_CURRENT_PROCESS",
		dimension: "PROBLEM_CLARITY",
		maximumPoints: 4,
		paths: ["currentProcess.description"],
		score: ({ currentProcess: e }) => {
			let t = e.description?.trim().length ?? 0;
			return t >= 120 ? 1 : t >= 40 ? .67 : .33;
		}
	},
	{
		code: "OPERATION_FREQUENCY_VOLUME",
		dimension: "OPERATIONAL_IMPACT",
		maximumPoints: 6,
		paths: ["currentProcess.frequency", "currentProcess.monthlyVolume"],
		score: ({ currentProcess: e }) => {
			let t = [
				"MULTIPLE_TIMES_PER_DAY",
				"DAILY",
				"MULTIPLE_TIMES_PER_WEEK"
			].includes(e.frequency ?? ""), n = typeof e.monthlyVolume == "number" ? e.monthlyVolume : 0;
			return t || n >= 500 ? 1 : e.frequency === "WEEKLY" || n >= 50 ? .67 : .33;
		}
	},
	{
		code: "OPERATION_PEOPLE_TIME",
		dimension: "OPERATIONAL_IMPACT",
		maximumPoints: 5,
		paths: [
			"currentProcess.participantCount",
			"currentProcess.averageExecutionTime",
			"impact.reportedHours"
		],
		score: ({ currentProcess: e, impact: t }) => {
			let n = e.participantCount ?? 0, r = t.reportedHours?.value ?? 0;
			return n >= 5 || r >= 40 ? 1 : n >= 2 || r >= 10 || e.averageExecutionTime ? .67 : .33;
		}
	},
	{
		code: "OPERATION_ERRORS_DELAYS_REWORK",
		dimension: "OPERATIONAL_IMPACT",
		maximumPoints: 5,
		paths: ["impact.categories", "impact.issueFrequency"],
		score: ({ impact: e }) => {
			let t = L(e.categories).filter((e) => [
				"ERRORS",
				"DELAYS",
				"REWORK",
				"QUALITY_RISK"
			].includes(e)).length;
			return t >= 2 || ["ALMOST_ALWAYS", "FREQUENT"].includes(e.issueFrequency ?? "") ? 1 : t === 1 || e.issueFrequency === "SOMETIMES" ? .67 : .33;
		}
	},
	{
		code: "OPERATION_BREADTH",
		dimension: "OPERATIONAL_IMPACT",
		maximumPoints: 4,
		paths: [
			"currentProcess.involvedAreas",
			"impact.externalStakeholdersAffected",
			"impact.categories"
		],
		score: ({ currentProcess: e, impact: t }) => {
			let n = e.involvedAreas?.length ?? 0;
			return t.externalStakeholdersAffected || n >= 3 ? 1 : n >= 2 || (t.categories?.length ?? 0) >= 3 ? .67 : .33;
		}
	},
	{
		code: "FINANCIAL_QUANTIFIED",
		dimension: "FINANCIAL_IMPACT",
		maximumPoints: 6,
		paths: ["impact.reportedFinancialImpact"],
		score: ({ impact: e }) => {
			let t = e.reportedFinancialImpact;
			return !t || ["NOT_ESTIMATED", "PREFER_NOT_TO_SAY"].includes(t) ? 0 : ["200K_1M_YEAR", "ABOVE_1M_YEAR"].includes(t) ? 1 : .67;
		}
	},
	{
		code: "FINANCIAL_NATURE",
		dimension: "FINANCIAL_IMPACT",
		maximumPoints: 5,
		paths: ["impact.categories"],
		score: ({ impact: e }) => {
			let t = L(e.categories);
			return t.includes("REVENUE_LOSS") && t.includes("HIGH_OPERATIONAL_COST") ? 1 : t.some((e) => ["REVENUE_LOSS", "HIGH_OPERATIONAL_COST"].includes(e)) ? .67 : 0;
		}
	},
	{
		code: "FINANCIAL_SUSTAINED_POTENTIAL",
		dimension: "FINANCIAL_IMPACT",
		maximumPoints: 4,
		paths: [
			"currentProcess.monthlyVolume",
			"impact.reportedHours",
			"impact.riskOfInaction"
		],
		score: ({ currentProcess: e, impact: t }) => {
			let n = typeof e.monthlyVolume == "number" ? e.monthlyVolume : 0, r = t.reportedHours?.value ?? 0;
			return n >= 500 || r >= 40 ? 1 : n >= 50 || r >= 10 || t.riskOfInaction ? .67 : .33;
		}
	},
	{
		code: "URGENCY_PRIORITY",
		dimension: "URGENCY",
		maximumPoints: 4,
		paths: ["buyingContext.priority"],
		score: ({ buyingContext: e }) => I(((e.priority ?? 1) - 1) / 4)
	},
	{
		code: "URGENCY_DEADLINE",
		dimension: "URGENCY",
		maximumPoints: 3,
		paths: ["buyingContext.deadline"],
		score: ({ buyingContext: e }) => e.deadline && !/não existe|sem prazo/i.test(e.deadline) ? 1 : 0
	},
	{
		code: "URGENCY_RISK_OF_INACTION",
		dimension: "URGENCY",
		maximumPoints: 3,
		paths: ["impact.riskOfInaction"],
		score: ({ impact: e }) => +!!e.riskOfInaction
	},
	{
		code: "DECISION_CONTACT_INFLUENCE",
		dimension: "DECISION_AND_EXECUTION",
		maximumPoints: 3,
		paths: ["lead.decisionInfluence"],
		score: ({ lead: e }) => ({
			HIGH: 1,
			MEDIUM: .67,
			LOW: .33,
			UNKNOWN: 0
		})[e.decisionInfluence ?? "UNKNOWN"]
	},
	{
		code: "DECISION_INTERNAL_OWNER",
		dimension: "DECISION_AND_EXECUTION",
		maximumPoints: 2,
		paths: ["buyingContext.internalOwnerExists"],
		score: ({ buyingContext: e }) => +!!e.internalOwnerExists
	},
	{
		code: "DECISION_MAKERS_SPONSORSHIP",
		dimension: "DECISION_AND_EXECUTION",
		maximumPoints: 3,
		paths: ["buyingContext.decisionMakers"],
		score: ({ buyingContext: e }) => {
			let t = L(e.decisionMakers);
			return t.includes("EXECUTIVE_BOARD") || t.includes("PARTNERS") ? 1 : t.includes("UNDEFINED") ? 0 : t.length > 0 ? .67 : 0;
		}
	},
	{
		code: "DECISION_BUDGET",
		dimension: "DECISION_AND_EXECUTION",
		maximumPoints: 2,
		paths: ["buyingContext.budgetStatus"],
		score: ({ buyingContext: e }) => ({
			APPROVED: 1,
			PLANNED_NOT_APPROVED: .75,
			UNDER_ANALYSIS: .5,
			EXPLORATORY: .25,
			UNKNOWN: 0,
			PREFER_NOT_TO_SAY: 0
		})[e.budgetStatus ?? "UNKNOWN"] ?? 0
	},
	{
		code: "FEASIBILITY_DATA",
		dimension: "DATA_AND_FEASIBILITY",
		maximumPoints: 3,
		paths: ["technicalContext.dataAvailability"],
		score: ({ technicalContext: e }) => ({
			AVAILABLE_STRUCTURED: 1,
			AVAILABLE_FRAGMENTED: .67,
			PARTIAL: .5,
			PRACTICALLY_UNAVAILABLE: 0,
			UNKNOWN: 0
		})[e.dataAvailability ?? "UNKNOWN"] ?? 0
	},
	{
		code: "FEASIBILITY_SYSTEMS_ACCESS",
		dimension: "DATA_AND_FEASIBILITY",
		maximumPoints: 2,
		paths: ["currentProcess.systems"],
		score: ({ currentProcess: e }) => +((e.systems?.length ?? 0) > 0)
	},
	{
		code: "FEASIBILITY_TECHNICAL_AVAILABILITY",
		dimension: "DATA_AND_FEASIBILITY",
		maximumPoints: 2,
		paths: ["technicalContext.itAvailability"],
		score: ({ technicalContext: e }) => ({
			AVAILABLE: 1,
			PROBABLE: .75,
			NEEDS_VALIDATION: .5,
			NO_INTERNAL_TEAM: .25,
			UNAVAILABLE: 0,
			UNKNOWN: 0
		})[e.itAvailability ?? "UNKNOWN"] ?? 0
	},
	{
		code: "FEASIBILITY_PROCESS_REDESIGN",
		dimension: "DATA_AND_FEASIBILITY",
		maximumPoints: 3,
		paths: ["buyingContext.processRedesignOpenness"],
		score: ({ buyingContext: e }) => ({
			OPEN: 1,
			OPEN_WITH_EVIDENCE: .75,
			UNDECIDED: .5,
			AUTOMATION_ONLY: 0
		})[e.processRedesignOpenness ?? "UNDECIDED"] ?? 0
	}
], z = R.reduce((e, t) => e + t.maximumPoints, 0);
if (z !== 100) throw Error(`Qualification matrix must total 100 points, received ${z}`);
function We(e) {
	return e.isCurrent !== !1 && e.confidence >= .6 && e.sourceType !== "AI_INFERENCE" && e.sourceType !== "NOT_CONFIRMED";
}
var Ge = /* @__PURE__ */ new Set([
	"UNKNOWN",
	"NOT_INFORMED",
	"PREFER_NOT_TO_SAY",
	"NOT_ESTIMATED",
	"UNDEFINED",
	"NOT_MEASURED"
]);
function B(e) {
	return C(e) ? typeof e == "string" ? !Ge.has(e.trim().toUpperCase()) : !Array.isArray(e) || e.some((e) => B(e)) : !1;
}
function Ke(e, t) {
	let n, r = -1;
	return t.forEach((t, i) => {
		if (t.path !== e || t.isCurrent === !1) return;
		let a = t.revision ?? 0, o = n?.revision ?? 0;
		(!n || a > o || a === o && i > r) && (n = t, r = i);
	}), n;
}
function qe(e, t, n) {
	return e.paths.filter((e) => {
		let r = Ke(e, t);
		return r !== void 0 && We(r) && B(S(n, e));
	});
}
function Je(e, t) {
	let n = {
		lead: {},
		challenge: {},
		currentProcess: {},
		impact: {},
		buyingContext: {},
		technicalContext: {}
	};
	for (let r of t) {
		let t = S(e, r), i = r.split("."), a = n;
		for (let e = 0; e < i.length - 1; e += 1) {
			let t = i[e];
			if (!t) continue;
			let n = a[t];
			(typeof n != "object" || !n || Array.isArray(n)) && (a[t] = {}), a = a[t];
		}
		let o = i.at(-1);
		o && (a[o] = t);
	}
	return n;
}
function Ye(e) {
	return e >= 85 ? "HIGH" : e >= 70 ? "MEDIUM" : e >= 50 ? "LOW" : "INSUFFICIENT";
}
function Xe(e) {
	return e === "HIGH" ? 100 : e === "MEDIUM" ? 79 : e === "LOW" ? 59 : null;
}
function Ze(e) {
	return e === null ? "INSUFFICIENT" : e >= 80 ? "PRIORITY" : e >= 60 ? "QUALIFIED" : e >= 40 ? "INVESTIGATION" : "LOW_FIT";
}
function Qe(e) {
	let t = R.map((t) => {
		let n = qe(t, e.evidence, e.structuredData), r = n.length > 0, i = r ? E(t.maximumPoints * I(t.score(Je(e.structuredData, n)))) : 0;
		return {
			code: t.code,
			dimension: t.dimension,
			maximumPoints: t.maximumPoints,
			assessed: r,
			earnedPoints: i,
			evidencePaths: n
		};
	}), n = E(t.reduce((e, t) => e + t.earnedPoints, 0)), r = E(t.reduce((e, t) => e + (t.assessed ? t.maximumPoints : 0), 0)), i = Ye(r), a = Xe(i), o = r > 0 ? E(n / r * 100) : null, s = o === null || a === null ? null : Math.round(Math.min(o, a));
	return {
		version: Ue,
		earnedPoints: n,
		assessedWeight: r,
		normalizedScore: o,
		finalScore: s,
		scoreCapApplied: a,
		classification: Ze(s),
		assessmentConfidence: i,
		criteria: t
	};
}
R.map(({ code: e, dimension: t, maximumPoints: n, paths: r }) => ({
	code: e,
	dimension: t,
	maximumPoints: n,
	paths: r
}));
//#endregion
//#region src/features/diagnostic/domain/catalog.ts
var V = "1.0.0", H = (e) => e.map(([e, t]) => ({
	value: e,
	label: t
})), $e = H([
	["LESS_THAN_3_MONTHS", "Há menos de 3 meses"],
	["3_TO_6_MONTHS", "De 3 a 6 meses"],
	["6_TO_12_MONTHS", "De 6 a 12 meses"],
	["1_TO_3_YEARS", "De 1 a 3 anos"],
	["MORE_THAN_3_YEARS", "Há mais de 3 anos"],
	["UNKNOWN", "Não sei informar"]
]), et = H([
	["ERP", "ERP"],
	["CRM", "CRM"],
	["INTERNAL_SYSTEM", "Sistema interno"],
	["EMAIL", "E-mail"],
	["WHATSAPP", "WhatsApp"],
	["SPREADSHEET", "Planilha"],
	["PDF_DOCUMENT", "Documento PDF"],
	["FORM", "Formulário"],
	["PAPER", "Papel"],
	["DATABASE", "Banco de dados"],
	["API", "API"],
	["OTHER", "Outro"]
]), tt = H([
	["MULTIPLE_TIMES_PER_DAY", "Várias vezes ao dia"],
	["DAILY", "Diariamente"],
	["MULTIPLE_TIMES_PER_WEEK", "Várias vezes por semana"],
	["WEEKLY", "Semanalmente"],
	["MONTHLY", "Mensalmente"],
	["EVENTUAL", "Eventualmente"],
	["ON_DEMAND", "Sob demanda"],
	["UNKNOWN", "Não sei informar"]
]), nt = H([
	["TIME_LOSS", "Perda de tempo"],
	["DELAYS", "Atrasos"],
	["REWORK", "Retrabalho"],
	["ERRORS", "Erros"],
	["HIGH_OPERATIONAL_COST", "Custo operacional elevado"],
	["REVENUE_LOSS", "Perda de receita"],
	["CUSTOMER_DISSATISFACTION", "Insatisfação de clientes"],
	["REGULATORY_RISK", "Risco regulatório"],
	["GROWTH_LIMITATION", "Limitação de crescimento"],
	["PERSON_DEPENDENCY", "Dependência de pessoas"],
	["LACK_OF_DECISION_INFORMATION", "Falta de informação para decisão"],
	["QUALITY_RISK", "Risco de qualidade"],
	["OTHER", "Outro"]
]), rt = H([
	["ALMOST_ALWAYS", "Quase sempre"],
	["FREQUENT", "Frequentemente"],
	["SOMETIMES", "Às vezes"],
	["RARELY", "Raramente"],
	["NOT_MEASURED", "Não é medido"]
]), it = H([
	["UP_TO_10K_YEAR", "Até R$ 10 mil por ano"],
	["10K_50K_YEAR", "De R$ 10 mil a R$ 50 mil por ano"],
	["50K_200K_YEAR", "De R$ 50 mil a R$ 200 mil por ano"],
	["200K_1M_YEAR", "De R$ 200 mil a R$ 1 milhão por ano"],
	["ABOVE_1M_YEAR", "Acima de R$ 1 milhão por ano"],
	["NOT_ESTIMATED", "Ainda não foi estimado"],
	["PREFER_NOT_TO_SAY", "Prefiro não informar"]
]), at = H([
	["APPROVED", "Investimento aprovado"],
	["PLANNED_NOT_APPROVED", "Planejado, ainda não aprovado"],
	["UNDER_ANALYSIS", "Em análise"],
	["EXPLORATORY", "Estágio exploratório"],
	["UNKNOWN", "Não sei informar"],
	["PREFER_NOT_TO_SAY", "Prefiro não informar"]
]), ot = H([
	["EXECUTIVE_BOARD", "Diretoria executiva"],
	["OPERATIONS", "Operações"],
	["FINANCE", "Financeiro"],
	["TECHNOLOGY", "Tecnologia"],
	["PROCUREMENT", "Compras"],
	["LEGAL", "Jurídico"],
	["PARTNERS", "Sócios"],
	["OTHER", "Outro"],
	["UNDEFINED", "Ainda não definido"]
]), st = H([
	["AVAILABLE_STRUCTURED", "Disponíveis e estruturados"],
	["AVAILABLE_FRAGMENTED", "Disponíveis, mas fragmentados"],
	["PARTIAL", "Parcialmente disponíveis"],
	["PRACTICALLY_UNAVAILABLE", "Praticamente indisponíveis"],
	["UNKNOWN", "Não sei informar"]
]), ct = H([
	["AVAILABLE", "Disponível"],
	["PROBABLE", "Provavelmente disponível"],
	["NEEDS_VALIDATION", "Precisa ser validado"],
	["NO_INTERNAL_TEAM", "Não há equipe interna"],
	["UNAVAILABLE", "Indisponível"],
	["UNKNOWN", "Não sei informar"]
]), lt = H([
	["OPEN", "Sim, estamos abertos"],
	["OPEN_WITH_EVIDENCE", "Sim, se houver evidências"],
	["AUTOMATION_ONLY", "Buscamos apenas automatizar"],
	["UNDECIDED", "Ainda não decidimos"]
]), ut = H([
	["1", "Apenas exploratória"],
	["2", "Importante, mas sem prazo"],
	["3", "Pretendemos avançar nos próximos meses"],
	["4", "Precisamos iniciar em breve"],
	["5", "É uma prioridade imediata"]
]), U = (e) => {
	let t = e.required ?? !1, n = e.critical ?? !1;
	return Object.freeze({
		...e,
		version: V,
		required: t,
		critical: n,
		maxClarifications: n ? 3 : t ? 2 : 1,
		scoringDimensions: e.scoringDimensions ?? [],
		kind: e.kind ?? "CORE"
	});
}, W = {
	type: "QUESTION_COUNT_BELOW",
	limit: 18
}, dt = [
	U({
		id: "CHALLENGE_001",
		stage: "CHALLENGE",
		text: "Qual processo, área ou problema você gostaria de melhorar?",
		purpose: "Identificar o problema, a área, o processo e seus sintomas.",
		responseType: "LONG_TEXT",
		required: !0,
		critical: !0,
		validation: {
			minLength: 20,
			maxLength: 2e3
		},
		targetPaths: [
			"challenge.summary",
			"challenge.primaryAffectedArea",
			"challenge.process",
			"challenge.symptoms"
		],
		scoringDimensions: ["PROBLEM_CLARITY", "NUMORA_FIT"],
		priority: 10,
		defaultClarificationType: "VAGUE_PROBLEM"
	}),
	U({
		id: "CHALLENGE_002",
		stage: "CHALLENGE",
		text: "O que você gostaria que mudasse depois que esse problema fosse resolvido?",
		purpose: "Identificar o resultado operacional desejado.",
		responseType: "LONG_TEXT",
		required: !0,
		critical: !0,
		validation: {
			minLength: 15,
			maxLength: 2e3
		},
		targetPaths: ["challenge.desiredOutcome"],
		scoringDimensions: ["PROBLEM_CLARITY"],
		priority: 20,
		defaultClarificationType: "GENERIC_AUTOMATION_REQUEST"
	}),
	U({
		id: "CHALLENGE_003",
		stage: "CHALLENGE",
		text: "Há quanto tempo esse problema afeta a operação?",
		purpose: "Contextualizar a duração do problema.",
		responseType: "SINGLE_CHOICE",
		options: $e,
		targetPaths: ["challenge.existingSince"],
		scoringDimensions: ["URGENCY"],
		priority: 30
	}),
	U({
		id: "CHALLENGE_004",
		stage: "CHALLENGE",
		text: "A empresa já tentou resolver ou reduzir esse problema?",
		purpose: "Identificar tentativas anteriores e aprendizados.",
		responseType: "YES_NO",
		targetPaths: ["challenge.previousAttempts"],
		scoringDimensions: ["NUMORA_FIT"],
		priority: 40
	}),
	U({
		id: "CHALLENGE_004_DETAIL",
		stage: "CHALLENGE",
		text: "Descreva brevemente o que foi tentado e por que o resultado não foi suficiente.",
		purpose: "Registrar tentativas anteriores e o motivo de não terem sido suficientes.",
		responseType: "LONG_TEXT",
		required: !0,
		validation: {
			minLength: 10,
			maxLength: 1500
		},
		displayCondition: {
			type: "ANSWER_EQUALS",
			questionId: "CHALLENGE_004",
			value: !0
		},
		targetPaths: ["challenge.previousAttemptDetails"],
		scoringDimensions: ["NUMORA_FIT"],
		priority: 41
	}),
	U({
		id: "PROCESS_001",
		stage: "CURRENT_PROCESS",
		text: "Como esse processo funciona hoje, desde o início até a conclusão?",
		purpose: "Compreender o fluxo operacional atual de ponta a ponta.",
		responseType: "LONG_TEXT",
		required: !0,
		critical: !0,
		validation: {
			minLength: 40,
			maxLength: 3e3
		},
		targetPaths: ["currentProcess.description"],
		scoringDimensions: ["PROBLEM_CLARITY", "NUMORA_FIT"],
		priority: 50,
		defaultClarificationType: "INCOMPLETE_PROCESS"
	}),
	U({
		id: "PROCESS_002",
		stage: "CURRENT_PROCESS",
		text: "Quantas pessoas participam desse processo e quais áreas estão envolvidas?",
		purpose: "Dimensionar participantes e abrangência entre áreas.",
		responseType: "LONG_TEXT",
		required: !0,
		targetPaths: [
			"currentProcess.participants",
			"currentProcess.participantCount",
			"currentProcess.involvedAreas"
		],
		scoringDimensions: ["NUMORA_FIT", "OPERATIONAL_IMPACT"],
		priority: 60
	}),
	U({
		id: "PROCESS_003",
		stage: "CURRENT_PROCESS",
		text: "Quais sistemas, planilhas, canais ou ferramentas são utilizados nesse processo?",
		purpose: "Identificar o ecossistema técnico e operacional.",
		responseType: "MULTIPLE_CHOICE",
		required: !0,
		options: et,
		validation: { maxSelections: 12 },
		targetPaths: ["currentProcess.systems"],
		scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
		priority: 70
	}),
	U({
		id: "PROCESS_003_OTHER",
		stage: "CURRENT_PROCESS",
		text: "Qual outra ferramenta, sistema ou canal é utilizado?",
		purpose: "Descrever a opção Outro selecionada no ecossistema operacional.",
		responseType: "SHORT_TEXT",
		required: !0,
		validation: {
			minLength: 2,
			maxLength: 200
		},
		displayCondition: {
			type: "ANSWER_INCLUDES",
			questionId: "PROCESS_003",
			value: "OTHER"
		},
		targetPaths: ["currentProcess.systemOther"],
		scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
		priority: 71
	}),
	U({
		id: "PROCESS_004",
		stage: "CURRENT_PROCESS",
		text: "As mesmas informações precisam ser copiadas ou digitadas em mais de uma ferramenta?",
		purpose: "Confirmar redigitação e oportunidade de integração.",
		responseType: "YES_NO",
		displayCondition: {
			type: "ANY",
			conditions: [{
				type: "ANSWER_ARRAY_MIN_LENGTH",
				questionId: "PROCESS_003",
				minimum: 2
			}, {
				type: "SIGNAL_PRESENT",
				signal: "DUPLICATE_DATA_ENTRY"
			}]
		},
		targetPaths: ["currentProcess.duplicateDataEntry"],
		scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
		priority: 80
	}),
	U({
		id: "PROCESS_005",
		stage: "CURRENT_PROCESS",
		text: "Com que frequência esse processo acontece?",
		purpose: "Dimensionar recorrência operacional.",
		responseType: "SINGLE_CHOICE",
		required: !0,
		options: tt,
		targetPaths: ["currentProcess.frequency"],
		scoringDimensions: ["OPERATIONAL_IMPACT"],
		priority: 90
	}),
	U({
		id: "PROCESS_006",
		stage: "CURRENT_PROCESS",
		text: "Aproximadamente quantos casos, solicitações ou atividades desse tipo são processados por mês?",
		purpose: "Dimensionar o volume mensal.",
		responseType: "NUMBER",
		validation: {
			min: 0,
			allowUnknown: !0
		},
		displayCondition: {
			type: "ALL",
			conditions: [
				{
					type: "ANY",
					conditions: [
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "MULTIPLE_TIMES_PER_DAY"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "DAILY"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "MULTIPLE_TIMES_PER_WEEK"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "WEEKLY"
						}
					]
				},
				{
					type: "FIELD_MISSING",
					path: "currentProcess.monthlyVolume"
				},
				W
			]
		},
		targetPaths: ["currentProcess.monthlyVolume"],
		scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
		priority: 100
	}),
	U({
		id: "PROCESS_007",
		stage: "CURRENT_PROCESS",
		text: "Quanto tempo, em média, é necessário para concluir uma ocorrência desse processo?",
		purpose: "Dimensionar o esforço por ocorrência.",
		responseType: "NUMBER_WITH_UNIT",
		validation: {
			min: 0,
			units: [
				"MINUTES",
				"HOURS",
				"DAYS",
				"WEEKS"
			]
		},
		displayCondition: {
			type: "ALL",
			conditions: [
				{
					type: "ANY",
					conditions: [
						{
							type: "SIGNAL_PRESENT",
							signal: "MANUAL_PROCESS"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "MULTIPLE_TIMES_PER_DAY"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "DAILY"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "MULTIPLE_TIMES_PER_WEEK"
						},
						{
							type: "ANSWER_EQUALS",
							questionId: "PROCESS_005",
							value: "WEEKLY"
						}
					]
				},
				{
					type: "FIELD_MISSING",
					path: "currentProcess.averageExecutionTime"
				},
				W
			]
		},
		targetPaths: ["currentProcess.averageExecutionTime"],
		scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
		priority: 110
	}),
	U({
		id: "PROCESS_008",
		stage: "CURRENT_PROCESS",
		text: "Qual parte do processo mais depende de trabalho manual ou do conhecimento de uma pessoa específica?",
		purpose: "Identificar dependência manual ou de conhecimento tácito.",
		responseType: "LONG_TEXT",
		displayCondition: {
			type: "ALL",
			conditions: [{
				type: "FIELD_MISSING",
				path: "currentProcess.manualDependency"
			}, W]
		},
		targetPaths: ["currentProcess.manualDependency"],
		scoringDimensions: ["OPERATIONAL_IMPACT"],
		priority: 120
	}),
	U({
		id: "IMPACT_001",
		stage: "IMPACT",
		text: "Quais são os principais impactos desse problema para a empresa?",
		purpose: "Classificar os impactos operacionais e empresariais.",
		responseType: "MULTIPLE_CHOICE",
		required: !0,
		critical: !0,
		options: nt,
		targetPaths: ["impact.categories"],
		scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
		priority: 150,
		defaultClarificationType: "IMPACT_MISSING"
	}),
	U({
		id: "IMPACT_002",
		stage: "IMPACT",
		text: "Com que frequência esses erros, atrasos ou retrabalhos acontecem?",
		purpose: "Dimensionar a frequência dos sintomas operacionais.",
		responseType: "SINGLE_CHOICE",
		options: rt,
		displayCondition: {
			type: "ANY",
			conditions: [
				"ERRORS",
				"DELAYS",
				"REWORK",
				"QUALITY_RISK"
			].map((e) => ({
				type: "ANSWER_INCLUDES",
				questionId: "IMPACT_001",
				value: e
			}))
		},
		targetPaths: ["impact.issueFrequency"],
		scoringDimensions: ["OPERATIONAL_IMPACT"],
		priority: 160
	}),
	U({
		id: "IMPACT_003",
		stage: "IMPACT",
		text: "Existe uma estimativa de quantas horas por semana ou por mês são consumidas por esse processo?",
		purpose: "Quantificar esforço recorrente.",
		responseType: "NUMBER_WITH_UNIT",
		validation: {
			min: 0,
			units: ["HOURS_PER_WEEK", "HOURS_PER_MONTH"],
			allowUnknown: !0
		},
		displayCondition: {
			type: "ALL",
			conditions: [
				{
					type: "ANY",
					conditions: [
						{
							type: "ANSWER_INCLUDES",
							questionId: "IMPACT_001",
							value: "TIME_LOSS"
						},
						{
							type: "SIGNAL_PRESENT",
							signal: "MANUAL_PROCESS"
						},
						{
							type: "FIELD_PRESENT",
							path: "currentProcess.averageExecutionTime"
						},
						{
							type: "FIELD_PRESENT",
							path: "currentProcess.participantCount"
						}
					]
				},
				{
					type: "FIELD_MISSING",
					path: "impact.reportedHours"
				},
				W
			]
		},
		targetPaths: ["impact.reportedHours"],
		scoringDimensions: ["OPERATIONAL_IMPACT", "FINANCIAL_IMPACT"],
		priority: 170
	}),
	U({
		id: "IMPACT_004",
		stage: "IMPACT",
		text: "A empresa possui alguma estimativa do custo ou da perda financeira causada por esse problema?",
		purpose: "Identificar impacto financeiro reportado sem induzir valor.",
		responseType: "CURRENCY_RANGE",
		options: it,
		displayCondition: {
			type: "ALL",
			conditions: [{
				type: "ANY",
				conditions: [
					{
						type: "ANSWER_INCLUDES",
						questionId: "IMPACT_001",
						value: "HIGH_OPERATIONAL_COST"
					},
					{
						type: "ANSWER_INCLUDES",
						questionId: "IMPACT_001",
						value: "REVENUE_LOSS"
					},
					{
						type: "SIGNAL_PRESENT",
						signal: "HIGH_VOLUME"
					},
					{
						type: "FIELD_PRESENT",
						path: "impact.reportedHours"
					},
					{
						type: "ANSWER_EQUALS",
						questionId: "BUYING_001",
						value: 3
					},
					{
						type: "ANSWER_EQUALS",
						questionId: "BUYING_001",
						value: 4
					},
					{
						type: "ANSWER_EQUALS",
						questionId: "BUYING_001",
						value: 5
					}
				]
			}, W]
		},
		targetPaths: ["impact.reportedFinancialImpact"],
		scoringDimensions: ["FINANCIAL_IMPACT"],
		priority: 180
	}),
	U({
		id: "IMPACT_005",
		stage: "IMPACT",
		text: "Esse problema afeta diretamente clientes, fornecedores ou parceiros?",
		purpose: "Identificar impactos externos.",
		responseType: "YES_NO",
		displayCondition: {
			type: "ANY",
			conditions: [
				{
					type: "ANSWER_INCLUDES",
					questionId: "IMPACT_001",
					value: "CUSTOMER_DISSATISFACTION"
				},
				{
					type: "ANSWER_INCLUDES",
					questionId: "IMPACT_001",
					value: "DELAYS"
				},
				{
					type: "ANSWER_INCLUDES",
					questionId: "IMPACT_001",
					value: "QUALITY_RISK"
				},
				{
					type: "SIGNAL_PRESENT",
					signal: "EXTERNAL_STAKEHOLDER_IMPACT"
				}
			]
		},
		targetPaths: ["impact.externalStakeholdersAffected"],
		scoringDimensions: ["OPERATIONAL_IMPACT"],
		priority: 190
	}),
	U({
		id: "IMPACT_005_DETAIL",
		stage: "IMPACT",
		text: "De que maneira eles são afetados?",
		purpose: "Descrever o impacto sobre clientes, fornecedores ou parceiros.",
		responseType: "LONG_TEXT",
		required: !0,
		validation: {
			minLength: 10,
			maxLength: 1500
		},
		displayCondition: {
			type: "ANSWER_EQUALS",
			questionId: "IMPACT_005",
			value: !0
		},
		targetPaths: ["impact.externalStakeholderDescription"],
		scoringDimensions: ["OPERATIONAL_IMPACT"],
		priority: 191
	}),
	U({
		id: "IMPACT_006",
		stage: "IMPACT",
		text: "O que pode acontecer se esse problema não for resolvido nos próximos 12 meses?",
		purpose: "Identificar o risco de não agir sem induzir resposta.",
		responseType: "LONG_TEXT",
		required: !0,
		critical: !0,
		validation: {
			minLength: 15,
			maxLength: 2e3
		},
		targetPaths: ["impact.riskOfInaction"],
		scoringDimensions: ["URGENCY", "OPERATIONAL_IMPACT"],
		priority: 200,
		defaultClarificationType: "IMPACT_MISSING"
	}),
	U({
		id: "BUYING_001",
		stage: "BUYING_CONTEXT",
		text: "Qual é a prioridade dessa iniciativa para a empresa neste momento?",
		purpose: "Registrar prioridade declarada sem inferência.",
		responseType: "SCALE",
		required: !0,
		critical: !0,
		options: ut,
		validation: {
			min: 1,
			max: 5
		},
		targetPaths: ["buyingContext.priority"],
		scoringDimensions: ["URGENCY"],
		priority: 210
	}),
	U({
		id: "BUYING_002",
		stage: "BUYING_CONTEXT",
		text: "Existe alguma data, projeto ou evento que determine um prazo para essa iniciativa?",
		purpose: "Identificar prazo ou evento motivador.",
		responseType: "LONG_TEXT",
		displayCondition: {
			type: "ANY",
			conditions: [
				3,
				4,
				5
			].map((e) => ({
				type: "ANSWER_EQUALS",
				questionId: "BUYING_001",
				value: e
			}))
		},
		targetPaths: ["buyingContext.deadline"],
		scoringDimensions: ["URGENCY"],
		priority: 220
	}),
	U({
		id: "BUYING_003",
		stage: "BUYING_CONTEXT",
		text: "Em relação ao investimento, em qual estágio a empresa se encontra?",
		purpose: "Compreender contexto de orçamento sem bloquear a entrevista.",
		responseType: "SINGLE_CHOICE",
		options: at,
		displayCondition: {
			type: "ALL",
			conditions: [{
				type: "ANY",
				conditions: [
					3,
					4,
					5
				].map((e) => ({
					type: "ANSWER_EQUALS",
					questionId: "BUYING_001",
					value: e
				}))
			}, W]
		},
		targetPaths: ["buyingContext.budgetStatus"],
		scoringDimensions: ["DECISION_AND_EXECUTION"],
		priority: 230
	}),
	U({
		id: "BUYING_004",
		stage: "BUYING_CONTEXT",
		text: "Existe uma pessoa ou equipe responsável por conduzir essa iniciativa internamente?",
		purpose: "Confirmar a existência de responsável interno.",
		responseType: "YES_NO",
		required: !0,
		critical: !0,
		targetPaths: ["buyingContext.internalOwnerExists"],
		scoringDimensions: ["DECISION_AND_EXECUTION"],
		priority: 240
	}),
	U({
		id: "BUYING_004_DETAIL",
		stage: "BUYING_CONTEXT",
		text: "Qual área ou função será responsável?",
		purpose: "Identificar a área ou função responsável pela iniciativa.",
		responseType: "SHORT_TEXT",
		required: !0,
		validation: {
			minLength: 2,
			maxLength: 200
		},
		displayCondition: {
			type: "ANSWER_EQUALS",
			questionId: "BUYING_004",
			value: !0
		},
		targetPaths: ["buyingContext.internalOwnerArea"],
		scoringDimensions: ["DECISION_AND_EXECUTION"],
		priority: 241
	}),
	U({
		id: "BUYING_005",
		stage: "BUYING_CONTEXT",
		text: "Quem normalmente participa da decisão sobre iniciativas como esta?",
		purpose: "Mapear decisores e possível patrocínio.",
		responseType: "MULTIPLE_CHOICE",
		required: !0,
		critical: !0,
		options: ot,
		targetPaths: ["buyingContext.decisionMakers"],
		scoringDimensions: ["DECISION_AND_EXECUTION"],
		priority: 250
	}),
	U({
		id: "BUYING_006",
		stage: "BUYING_CONTEXT",
		text: "A empresa possui dados, históricos ou registros sobre esse processo?",
		purpose: "Avaliar disponibilidade de dados sem presumir qualidade.",
		responseType: "SINGLE_CHOICE",
		required: !0,
		critical: !0,
		options: st,
		targetPaths: ["technicalContext.dataAvailability"],
		scoringDimensions: ["DATA_AND_FEASIBILITY"],
		priority: 260
	}),
	U({
		id: "BUYING_007",
		stage: "BUYING_CONTEXT",
		text: "A equipe de tecnologia ou os responsáveis pelos sistemas poderiam participar da iniciativa, caso necessário?",
		purpose: "Avaliar disponibilidade técnica para uma futura iniciativa.",
		responseType: "SINGLE_CHOICE",
		options: ct,
		displayCondition: {
			type: "ALL",
			conditions: [{
				type: "ANY",
				conditions: [
					{
						type: "FIELD_PRESENT",
						path: "currentProcess.systems"
					},
					{
						type: "SIGNAL_PRESENT",
						signal: "INTEGRATION_LIKELY"
					},
					{
						type: "SIGNAL_PRESENT",
						signal: "GENERIC_AUTOMATION_REQUEST"
					},
					{
						type: "SIGNAL_PRESENT",
						signal: "GENERIC_AI_REQUEST"
					}
				]
			}, W]
		},
		targetPaths: ["technicalContext.itAvailability"],
		scoringDimensions: ["DATA_AND_FEASIBILITY"],
		priority: 270
	}),
	U({
		id: "BUYING_008",
		stage: "BUYING_CONTEXT",
		text: "A empresa está aberta a revisar o processo atual, além de apenas automatizá-lo?",
		purpose: "Avaliar aderência à transformação operacional.",
		responseType: "SINGLE_CHOICE",
		required: !0,
		critical: !0,
		options: lt,
		targetPaths: ["buyingContext.processRedesignOpenness"],
		scoringDimensions: ["NUMORA_FIT", "DATA_AND_FEASIBILITY"],
		priority: 280
	})
], ft = Object.entries({
	COMMERCIAL: ["Como os leads e oportunidades são registrados e acompanhados atualmente?", "Em qual etapa as oportunidades costumam atrasar ou ser perdidas?"],
	FINANCE: ["Quais atividades financeiras mais exigem conferência, digitação ou conciliação manual?", "Qual é o volume mensal aproximado de documentos, cobranças ou transações envolvidas?"],
	CUSTOMER_SERVICE: ["Por quais canais os clientes entram em contato?", "Quais solicitações ou dúvidas aparecem com maior frequência?"],
	OPERATIONS_LOGISTICS: ["Em qual etapa da operação ocorrem mais atrasos, desvios ou retrabalho?", "Existe acompanhamento em tempo real ou as informações são consolidadas posteriormente?"],
	PROCUREMENT: ["Como são realizadas as solicitações, cotações e aprovações de compra?", "Quanto tempo costuma levar entre a solicitação e a aprovação final?"],
	HUMAN_RESOURCES: ["Qual processo de RH mais consome tempo da equipe atualmente?", "Esse processo envolve documentos, aprovações ou comunicação repetitiva com colaboradores?"],
	LEGAL: ["Qual é o volume aproximado de contratos ou documentos analisados por mês?", "Quais etapas da análise exigem mais tempo ou geram maior risco?"]
}).flatMap(([e, t], n) => t.map((t, r) => U({
	id: `AREA_${e}_${String(r + 1).padStart(2, "0")}`,
	stage: "CURRENT_PROCESS",
	text: t,
	purpose: `Aprofundar o contexto da área ${e} sem exceder duas perguntas específicas.`,
	responseType: "LONG_TEXT",
	displayCondition: {
		type: "ALL",
		conditions: [{
			type: "AREA_EQUALS",
			area: e
		}, W]
	},
	targetPaths: [`areaSpecific.${e.toLowerCase()}.${r + 1}`],
	scoringDimensions: ["NUMORA_FIT", "OPERATIONAL_IMPACT"],
	priority: 125 + n * 2 + r,
	kind: "AREA_SPECIFIC"
}))), pt = [
	"lead.name",
	"lead.role",
	"lead.company",
	"lead.email",
	"lead.industry",
	"lead.employeeRange",
	"challenge.summary",
	"challenge.primaryAffectedArea",
	"challenge.desiredOutcome",
	"currentProcess.description",
	"impact.categories",
	"impact.riskOfInaction",
	"buyingContext.priority",
	"buyingContext.internalOwnerExists",
	"buyingContext.decisionMakers",
	"technicalContext.dataAvailability",
	"buyingContext.processRedesignOpenness"
], G = Object.freeze({
	version: V,
	questions: Object.freeze([...dt, ...ft]),
	criticalPaths: pt
});
function mt(e, t = G) {
	return t.questions.find((t) => t.id === e);
}
function ht(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.questions) {
		if (t.has(n.id)) throw Error(`Duplicate question id: ${n.id}`);
		if (t.add(n.id), n.version !== e.version) throw Error(`Question ${n.id} has a mismatched version`);
		if (n.validation?.minLength !== void 0 && n.validation?.maxLength !== void 0 && n.validation.minLength > n.validation.maxLength) throw Error(`Question ${n.id} has invalid length limits`);
		if (n.maxClarifications < 1 || n.maxClarifications > 3) throw Error(`Question ${n.id} has invalid clarification limit`);
	}
	for (let t of e.criticalPaths) if (!e.questions.some((e) => e.targetPaths.includes(t)) && !t.startsWith("lead.")) throw Error(`Critical path has no catalog source: ${t}`);
}
ht(G);
//#endregion
//#region src/features/diagnostic/domain/rules.ts
var K = Object.freeze({
	targetQuestionsMin: 12,
	targetQuestionsMax: 18,
	exceptionalQuestionsMax: 20,
	absoluteQuestionsMax: 24,
	maxClarificationsTotal: 4,
	maxAreaSpecificQuestions: 2
}), gt = {
	VAGUE_PROBLEM: () => "Para compreendermos melhor, poderia dar um exemplo concreto de quando esse problema acontece?",
	AREA_WITHOUT_PROCESS: (e) => `Dentro de ${e.structuredData.challenge.primaryAffectedArea ?? "essa área"}, qual atividade mais consome tempo, gera erros ou dificulta o crescimento?`,
	GENERIC_AI_REQUEST: () => "Antes de pensar em tecnologia, qual problema operacional essa iniciativa deveria resolver?",
	GENERIC_AUTOMATION_REQUEST: () => "Qual processo você gostaria de automatizar e o que atualmente torna esse processo ineficiente?",
	INCOMPLETE_PROCESS: () => "O que acontece primeiro, quem recebe a demanda e como o processo é finalizado?",
	IMPACT_MISSING: () => "Por que essa iniciativa é importante para a empresa neste momento?",
	CONTRADICTION: () => "Identifiquei informações que parecem diferentes entre si. Qual delas representa melhor a situação atual?"
};
function q(e, t) {
	return e.answers.reduce((e, n) => n.questionId === t && (!e || n.revision > e.revision || n.revision === e.revision && n.answeredAtEpochMs >= e.answeredAtEpochMs) ? n : e, void 0);
}
function _t(e, t) {
	return e === void 0 || Array.isArray(e) || typeof e == "object" ? !1 : e === t;
}
function J(e) {
	return new Set(e.askedQuestionIds).size + e.clarifications.length;
}
function Y(e, t) {
	switch (e.type) {
		case "ALL": return e.conditions.every((e) => Y(e, t));
		case "ANY": return e.conditions.some((e) => Y(e, t));
		case "NOT": return !Y(e.condition, t);
		case "ANSWER_EQUALS": return _t(q(t, e.questionId)?.value, e.value);
		case "ANSWER_INCLUDES": return w(q(t, e.questionId)?.value ?? []).includes(e.value);
		case "ANSWER_ARRAY_MIN_LENGTH": return w(q(t, e.questionId)?.value ?? []).length >= e.minimum;
		case "FIELD_PRESENT": return C(S(t.structuredData, e.path));
		case "FIELD_MISSING": return !C(S(t.structuredData, e.path));
		case "FIELD_IN": return e.values.includes(S(t.structuredData, e.path));
		case "SIGNAL_PRESENT": return t.signals.includes(e.signal);
		case "QUESTION_COUNT_BELOW": return J(t) < e.limit;
		case "AREA_EQUALS": return t.structuredData.challenge.primaryAffectedArea === e.area;
	}
}
function vt(e, t) {
	return q(t, e) !== void 0;
}
function X(e, t) {
	return vt(e.id, t) ? !1 : !e.displayCondition || Y(e.displayCondition, t);
}
function yt(e, t, n) {
	if (e.clarificationType) return e.clarificationType;
	if (n.signals.includes("CONTRADICTION")) return "CONTRADICTION";
	let r = D(T(e.value));
	return /\b(ia|inteligencia artificial|chatgpt|agente)\b/.test(r) ? "GENERIC_AI_REQUEST" : /\b(automatizar|automacao|robo|rpa)\b/.test(r) ? "GENERIC_AUTOMATION_REQUEST" : t.defaultClarificationType;
}
function bt(e) {
	let t = e.clarifications.find((t) => {
		if (t.answered) return !1;
		let n = q(e, t.relatedQuestionId);
		return n !== void 0 && (n.needsClarification === !0 || n.clarity !== "CLEAR");
	});
	if (t) return {
		id: t.id,
		type: t.type,
		relatedQuestionId: t.relatedQuestionId,
		text: t.text,
		sequence: t.sequence
	};
}
function Z(e, t, n = K) {
	let r = bt(e);
	if (r) return r;
	if (e.clarifications.length >= n.maxClarificationsTotal) return;
	let i = /* @__PURE__ */ new Map();
	for (let t of e.answers) {
		let e = i.get(t.questionId);
		(!e || t.revision > e.revision || t.revision === e.revision && t.answeredAtEpochMs >= e.answeredAtEpochMs) && i.set(t.questionId, t);
	}
	let a = [...i.values()].sort((e, t) => t.answeredAtEpochMs - e.answeredAtEpochMs || t.revision - e.revision), o = J(e);
	for (let r of a) {
		if (!r.needsClarification && r.clarity === "CLEAR") continue;
		let i = mt(r.questionId, t);
		if (!i || o >= n.targetQuestionsMax && !i.critical) continue;
		let a = e.clarifications.filter((e) => e.relatedQuestionId === i.id);
		if (a.length >= i.maxClarifications) continue;
		let s = yt(r, i, e);
		if (!s || a.some((e) => e.type === s)) continue;
		let c = a.length + 1;
		return {
			id: `${i.id}:${s}:${c}`,
			type: s,
			relatedQuestionId: i.id,
			text: i.id === "CHALLENGE_002" ? "Além da tecnologia, qual resultado a empresa espera alcançar na operação?" : gt[s](e),
			sequence: c
		};
	}
}
//#endregion
//#region src/features/diagnostic/domain/orchestrator.ts
var Q = [
	"CHALLENGE",
	"CURRENT_PROCESS",
	"IMPACT",
	"BUYING_CONTEXT"
], $ = {
	CHALLENGE: "CHALLENGE",
	CURRENT_PROCESS: "CURRENT_PROCESS",
	IMPACT: "IMPACT",
	BUYING_CONTEXT: "BUYING_CONTEXT"
};
function xt(e) {
	if (e.privacyConsent === !1) return "PRIVACY_NOT_ACCEPTED";
	if (e.status === "EXPIRED" || e.currentTimeEpochMs >= e.expiresAtEpochMs) return "SESSION_EXPIRED";
	if (e.signals.includes("SEVERE_SENSITIVE_DATA_EXPOSURE")) return "SEVERE_SENSITIVE_DATA_EXPOSURE";
	if (e.signals.includes("PERSISTENT_PROMPT_INJECTION")) return "PERSISTENT_PROMPT_INJECTION";
	if (e.signals.includes("PERSISTENT_ABUSE")) return "PERSISTENT_ABUSE";
	if (e.signals.includes("ILLEGAL_REQUEST")) return "ILLEGAL_REQUEST";
	if (e.signals.includes("COMPLETELY_OUT_OF_SCOPE")) return "COMPLETELY_OUT_OF_SCOPE";
	if (e.status === "BLOCKED") return "SYSTEM_BLOCKED";
}
function St(e, t) {
	return e.questions.filter((e) => e.critical && X(e, t)).length;
}
function Ct(e, t, n) {
	let r = J(e), i = $[e.status], a = i ? Q.indexOf(i) : 0, o = t.questions.filter((t) => X(t, e)), s = e.askedQuestionIds.filter((e) => t.questions.some((t) => t.id === e && t.kind === "AREA_SPECIFIC")).length, c = r >= n.targetQuestionsMax, l = St(t, e), u = Math.max(0, n.targetQuestionsMax - r - l);
	for (let t = Math.max(0, a); t < Q.length; t += 1) {
		let i = Q[t], a = o.filter((e) => e.stage === i).filter((t) => e.askedQuestionIds.includes(t.id) || t.critical ? !0 : c || r >= n.exceptionalQuestionsMax ? !1 : t.kind === "AREA_SPECIFIC" ? u > 0 && s < n.maxAreaSpecificQuestions : (t.required || t.displayCondition || r < n.targetQuestionsMin) && u > 0).sort((t, n) => {
			let r = (t) => e.askedQuestionIds.includes(t.id) ? -1 : t.critical ? 0 : t.required ? 1 : t.displayCondition && t.kind === "CORE" ? 2 : t.kind === "AREA_SPECIFIC" ? 3 : 4;
			return r(t) - r(n) || t.priority - n.priority;
		});
		if (a[0]) return a[0];
	}
}
function wt(e, t, n = K) {
	let r = xt(e);
	if (r) return {
		type: "BLOCK",
		reason: r
	};
	if (e.status === "REVIEW_GENERATING") return { type: "GENERATE_REVIEW" };
	if (e.status === "REVIEW_PENDING" || e.status === "REVIEW_EDITING") return { type: "SHOW_REVIEW" };
	if (e.status === "COMPLETING" || e.status === "COMPLETED" || e.status === "COMPLETED_NO_CONTACT") return { type: "COMPLETE" };
	if (!$[e.status]) return {
		type: "BLOCK",
		reason: "SYSTEM_BLOCKED"
	};
	if (J(e) >= n.absoluteQuestionsMax) return { type: "GENERATE_REVIEW" };
	let i = Z(e, t, n);
	if (i) return {
		type: "ASK_CLARIFICATION",
		clarification: i
	};
	let a = Ct(e, t, n);
	return a ? {
		type: "ASK_QUESTION",
		questionId: a.id
	} : { type: "GENERATE_REVIEW" };
}
//#endregion
export { K as DEFAULT_INTERVIEW_RULES, Oe as DeterministicInterviewAIService, Qe as calculateQualification, He as determineInternalRoute, Ve as evaluateFlags, wt as getNextInterviewAction };
