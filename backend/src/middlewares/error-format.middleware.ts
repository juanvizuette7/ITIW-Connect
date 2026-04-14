import { NextFunction, Request, Response } from "express";

function codeFromStatus(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "UNPROCESSABLE_ENTITY";
  if (status === 429) return "RATE_LIMIT_EXCEEDED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_ERROR";
}

export function normalizeErrorResponse(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = ((payload: unknown) => {
    if (res.statusCode < 400) {
      return originalJson(payload);
    }

    const candidate = (payload && typeof payload === "object" ? payload : {}) as {
      error?: unknown;
      message?: unknown;
      code?: unknown;
    };

    const message = String(
      candidate.error || candidate.message || "Ocurrio un error al procesar la solicitud.",
    );
    const code = String(candidate.code || codeFromStatus(res.statusCode));

    return originalJson({
      error: message,
      code,
    });
  }) as typeof res.json;

  next();
}

