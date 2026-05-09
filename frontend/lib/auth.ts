export type UserRole = "CLIENTE" | "PROFESIONAL" | "ADMIN";

const TOKEN_KEY = "itiw_token";
const ROLE_KEY = "itiw_role";
const EMAIL_KEY = "itiw_email";

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveSession(token: string, role?: UserRole) {
  const payload = decodePayload(token);
  const inferredRole = (payload?.role as UserRole | undefined) || role;
  const email = payload?.email as string | undefined;

  localStorage.setItem(TOKEN_KEY, token);
  if (inferredRole) localStorage.setItem(ROLE_KEY, inferredRole);
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  localStorage.clear();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY) as UserRole | null;
}

export function getEmail() {
  return localStorage.getItem(EMAIL_KEY);
}
