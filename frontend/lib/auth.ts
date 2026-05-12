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
  if (typeof window === "undefined") return;

  const payload = decodePayload(token);
  const inferredRole = (payload?.role as UserRole | undefined) || role;
  const email = payload?.email as string | undefined;

  localStorage.setItem(TOKEN_KEY, token);
  if (inferredRole) localStorage.setItem(ROLE_KEY, inferredRole);
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.clear();
}

export function getToken() {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const payload = decodePayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;

  if (exp && Date.now() >= exp * 1000) {
    clearSession();
    return null;
  }

  return token;
}

export function getRole() {
  if (typeof window === "undefined") return null;

  const storedRole = localStorage.getItem(ROLE_KEY) as UserRole | null;
  if (storedRole) return storedRole;

  const token = getToken();
  if (!token) return null;

  const payload = decodePayload(token);
  const role = payload?.role as UserRole | undefined;
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
    return role;
  }

  return null;
}

export function getEmail() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}
