const BRAZIL_COUNTRY_CODE = "55";
const MAX_NATIONAL_PHONE_DIGITS = 11;
const MAX_INTERNATIONAL_PHONE_DIGITS = 13;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Produces the value persisted by the form without visual punctuation.
 * Domestic numbers use digits only; numbers entered with Brazil's country
 * code use canonical E.164 notation (+55...) so international intent survives
 * partial edits.
 */
export function normalizeBrazilianPhone(value: string): string {
  let digits = onlyDigits(value);
  let hasExplicitCountryCode = value.trimStart().startsWith("+");

  // Accept the common international dialing prefix pasted as 00 55.
  if (digits.startsWith(`00${BRAZIL_COUNTRY_CODE}`)) {
    digits = digits.slice(2);
    hasExplicitCountryCode = true;
  }

  const hasBrazilCountryCode = digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    (hasExplicitCountryCode || digits.length > MAX_NATIONAL_PHONE_DIGITS);

  if (hasBrazilCountryCode) {
    return `+${digits.slice(0, MAX_INTERNATIONAL_PHONE_DIGITS)}`;
  }

  // Preserve the beginning of an explicitly typed +55 while the value is
  // incomplete. This keeps editing stable without accepting other countries.
  if (hasExplicitCountryCode && BRAZIL_COUNTRY_CODE.startsWith(digits)) {
    return `+${digits}`;
  }

  return digits.slice(0, MAX_NATIONAL_PHONE_DIGITS);
}

function formatNationalPhone(digits: string): string {
  if (!digits) return "";
  if (digits.length === 1) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (!subscriber) return `(${areaCode})`;

  // A complete 11-digit number is mobile; fixed lines use four digits before
  // the separator. The grouping adapts as the user types the last digit.
  const prefixLength = digits.length === MAX_NATIONAL_PHONE_DIGITS ? 5 : 4;
  const prefix = subscriber.slice(0, prefixLength);
  const suffix = subscriber.slice(prefixLength, prefixLength + 4);

  return `(${areaCode}) ${prefix}${suffix ? `-${suffix}` : ""}`;
}

export function formatBrazilianPhone(value: string): string {
  const normalized = normalizeBrazilianPhone(value);
  const digits = onlyDigits(normalized);
  const hasBrazilCountryCode = normalized.startsWith(`+${BRAZIL_COUNTRY_CODE}`);

  if (normalized.startsWith("+") && !hasBrazilCountryCode) return normalized;
  if (!hasBrazilCountryCode) return formatNationalPhone(digits);
  const nationalPhone = formatNationalPhone(digits.slice(2));
  return `+${BRAZIL_COUNTRY_CODE}${nationalPhone ? ` ${nationalPhone}` : ""}`;
}

export function phoneCaretAfterDigits(formattedValue: string, digitCount: number): number {
  if (digitCount <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) seenDigits += 1;
    if (seenDigits === digitCount) return index + 1;
  }

  return formattedValue.length;
}
