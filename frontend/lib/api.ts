import { clearSession } from "./auth";

const LOCAL_API_URL = "http://localhost:4000/api";
const PRODUCTION_API_URL = "https://itiw-connect.onrender.com/api";

function isLocalBrowserHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getApiUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined" && !isLocalBrowserHost(window.location.hostname)) {
    if (!configuredUrl || configuredUrl.includes("localhost") || configuredUrl.includes("127.0.0.1")) {
      return PRODUCTION_API_URL;
    }
  }

  return (configuredUrl || LOCAL_API_URL).replace(/\/+$/, "");
}

interface RequestOptions extends RequestInit {
  token?: string;
}

const requestCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

function cacheKey(path: string, token?: string) {
  return `${token || "public"}:${path}`;
}

function getCacheDuration(path: string, method: string) {
  if (method !== "GET") return 0;
  if (path === "/profile/me") return 20_000;
  if (path === "/categories") return 60 * 60_000;
  return 0;
}

export function invalidateApiCache(path?: string) {
  if (!path) {
    requestCache.clear();
    return;
  }

  for (const key of Array.from(requestCache.keys())) {
    if (key.endsWith(`:${path}`)) {
      requestCache.delete(key);
    }
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const method = (rest.method || "GET").toUpperCase();
  const cacheDuration = getCacheDuration(path, method);
  const key = cacheDuration > 0 ? cacheKey(path, token) : "";

  if (key) {
    const cached = requestCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<T>;
    }
  }

  const requestPromise = executeApiRequest<T>(path, { token, headers, ...rest });

  if (key) {
    requestCache.set(key, {
      expiresAt: Date.now() + cacheDuration,
      promise: requestPromise,
    });

    requestPromise.catch(() => {
      requestCache.delete(key);
    });
  }

  return requestPromise;
}

async function executeApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      "Servicio no disponible, intenta de nuevo en unos minutos.",
      503,
      "SERVICE_UNAVAILABLE",
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    const message = data.error || data.message || "No fue posible completar la solicitud.";
    const code = data.code || undefined;

    if (response.status === 401 && token && typeof window !== "undefined") {
      clearSession();
      window.location.href = "/auth/login";
    }

    throw new ApiError(message, response.status, code);
  }

  return data as T;
}
