function hasLettersAndNumbers(value: string): boolean {
  return /[a-z]/i.test(value) && /[0-9]/.test(value);
}

export type PersonNameInput = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  fallback?: string;
};

export type ResolvedPersonName = {
  firstName: string;
  lastName: string;
  fullName: string;
};

export function firstNameOnly(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  return normalized.split(/\s+/)[0] ?? "";
}

export function isGenericDisplayName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === "member";
}

export function isIdLikeDisplayName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;

  const prefixedToken = normalized.match(
    /^(user|org|sess|session|client|sms|email|inv|invite|acct|account|clerk)[\s._:-]+([a-z0-9]+)$/
  );
  if (prefixedToken) {
    const token = prefixedToken[2];
    if (token.length >= 16) return true;
    if (token.length >= 6 && hasLettersAndNumbers(token)) return true;
  }

  if (/^[a-f0-9]{16,}$/.test(normalized)) return true;

  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => token.length >= 18 && hasLettersAndNumbers(token))) {
    return true;
  }

  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  if (compact.length >= 20 && hasLettersAndNumbers(compact)) return true;

  return false;
}

export function sanitizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (isGenericDisplayName(trimmed) || isIdLikeDisplayName(trimmed)) return null;
  return trimmed;
}

export function formatNameFromEmail(
  email: string | null | undefined,
  fallback = "Member"
): string {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart || isIdLikeDisplayName(localPart)) return fallback;

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || isIdLikeDisplayName(cleaned)) return fallback;

  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function getDisplayNameFromClerkProfile(profile: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  username: string | null | undefined;
}): string | null {
  const safeFirstName = sanitizeDisplayName(profile.firstName);
  const safeLastName = sanitizeDisplayName(profile.lastName);
  const structuredName = [safeFirstName, safeLastName].filter(Boolean).join(" ");
  if (structuredName) return structuredName;

  const safeUsername = sanitizeDisplayName(profile.username);
  if (safeUsername) return safeUsername;
  return null;
}

export function resolveFullName({
  firstName,
  lastName,
  displayName,
  email,
  fallback = "Member",
}: PersonNameInput): string {
  const safeFirstName = sanitizeDisplayName(firstName);
  const safeLastName = sanitizeDisplayName(lastName);

  if (safeFirstName && safeLastName) {
    return `${safeFirstName} ${safeLastName}`;
  }

  const safeDisplayName = sanitizeDisplayName(displayName);
  if (safeDisplayName) return safeDisplayName;

  const partialStructuredName = [safeFirstName, safeLastName]
    .filter(Boolean)
    .join(" ");
  if (partialStructuredName) return partialStructuredName;

  if (email) {
    const emailName = formatNameFromEmail(email, fallback);
    const safeEmailName = sanitizeDisplayName(emailName);
    if (safeEmailName) return safeEmailName;
  }

  return fallback;
}

export function resolveFirstName({
  firstName,
  displayName,
  email,
  fallback = "Member",
}: PersonNameInput): string {
  const safeFirstName = sanitizeDisplayName(firstName);
  if (safeFirstName) return safeFirstName;

  const safeDisplayName = sanitizeDisplayName(displayName);
  if (safeDisplayName) return firstNameOnly(safeDisplayName) || fallback;

  if (email) {
    const emailName = formatNameFromEmail(email, fallback);
    const safeEmailName = sanitizeDisplayName(emailName);
    if (safeEmailName) return firstNameOnly(safeEmailName) || fallback;
  }

  return firstNameOnly(fallback) || fallback;
}

export function resolvePersonName(input: PersonNameInput): ResolvedPersonName {
  return {
    firstName: resolveFirstName(input),
    lastName: sanitizeDisplayName(input.lastName) ?? "",
    fullName: resolveFullName(input),
  };
}

/**
 * Compatibility helper for legacy callers. New person-bearing API contracts
 * should return structured name fields from resolvePersonName instead.
 */
export function resolveDisplayName(input: PersonNameInput): string {
  return resolveFullName(input);
}
