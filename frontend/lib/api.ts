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

  return configuredUrl || LOCAL_API_URL;
}

interface RequestOptions extends RequestInit {
  token?: string;
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
