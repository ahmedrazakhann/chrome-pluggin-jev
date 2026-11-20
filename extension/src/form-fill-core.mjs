const PROTECTED_SOURCE = [
  "password",
  "passcode",
  "one.?time",
  "otp",
  "verification.?code",
  "security.?code",
  "api.?key",
  "secret",
  "token",
  "credit.?card",
  "card.?number",
  "cardholder",
  "cvv",
  "cvc",
  "cc-",
  "social.?security",
  "ssn",
].join("|");

const SELECT_PLACEHOLDER_SOURCE = [
  "^\\s*(?:",
  "\\[(?:please\\s+)?(?:select|choose)[^\\]]*\\]",
  "|(?:please\\s+)?(?:select|choose)(?:\\s+.+)?",
  ")\\s*$",
].join("");

export const PROTECTED_FIELD_PATTERN = new RegExp(PROTECTED_SOURCE, "i");
export const PROTECTED_FIELD_PATTERN_SOURCE = PROTECTED_SOURCE;
export const SELECT_PLACEHOLDER_PATTERN_SOURCE = SELECT_PLACEHOLDER_SOURCE;

export function isSelectPlaceholder({ label = "", value = "", disabled = false } = {}) {
  return Boolean(disabled) || !String(value).trim() ||
    new RegExp(SELECT_PLACEHOLDER_SOURCE, "i").test(String(label).trim());
}

export function isProtectedMetadata(metadata = {}) {
  const purpose = [
    metadata.type,
    metadata.label,
    metadata.name,
    metadata.id,
    metadata.autocomplete,
    metadata.placeholder,
  ]
    .filter(Boolean)
    .join(" ");
  return PROTECTED_FIELD_PATTERN.test(purpose);
}

export function normalizeFillValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function makeSnapshotId() {
  return `form-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
