export type UserRole = "CLIENTE" | "PROFESIONAL";

const TOKEN_KEY = "itiw_token";
const ROLE_KEY = "itiw_role";
const EMAIL_KEY = "itiw_email";

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
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
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EMAIL_KEY);
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