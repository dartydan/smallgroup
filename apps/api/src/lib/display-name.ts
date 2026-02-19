function hasLettersAndNumbers(value: string): boolean {
  return /[a-z]/i.test(value) && /[0-9]/.test(value);
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
  const fullName = [profile.firstName, profile.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");

  const safeFullName = sanitizeDisplayName(fullName);
  if (safeFullName) return safeFullName;

  const safeFirstName = sanitizeDisplayName(profile.firstName);
  if (safeFirstName) return safeFirstName;

  return sanitizeDisplayName(profile.username);
}

export function resolveDisplayName({
  displayName,
  email,
  fallback = "Member",
}: {
  displayName?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const safeDisplayName = sanitizeDisplayName(displayName);
  if (safeDisplayName) return safeDisplayName;

  if (email) {
    const emailName = formatNameFromEmail(email, fallback);
    const safeEmailName = sanitizeDisplayName(emailName);
    if (safeEmailName) return safeEmailName;
  }

  return fallback;
}
