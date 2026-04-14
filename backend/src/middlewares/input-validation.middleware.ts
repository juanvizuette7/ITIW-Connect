import { NextFunction, Request, Response } from "express";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?\d{10,15}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateField(key: string, value: unknown): string | null {
  if (typeof value === "string") {
    if (value.length > 2000) {
      return `El campo ${key} supera la longitud maxima permitida.`;
    }

    if (key.toLowerCase().includes("email") && value.trim() && !EMAIL_REGEX.test(value.trim())) {
      return `El campo ${key} debe tener un formato de correo valido.`;
    }

    if ((key.toLowerCase().includes("phone") || key.toLowerCase().includes("telefono")) && value.trim() && !PHONE_REGEX.test(value.trim())) {
      return `El campo ${key} debe tener entre 10 y 15 digitos.`;
    }

    if (key.toLowerCase().includes("password") && value && value.length < 8) {
      return `El campo ${key} debe tener minimo 8 caracteres.`;
    }
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return `El campo ${key} debe ser un numero valido.`;
  }

  return null;
}

function walkPayload(value: unknown, path = "body"): string | null {
  if (Array.isArray(value)) {
    if (value.length > 200) {
      return `El campo ${path} supera la cantidad maxima permitida de elementos.`;
    }
    for (let index = 0; index < value.length; index += 1) {
      const nested = walkPayload(value[index], `${path}[${index}]`);
      if (nested) return nested;
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const entries = Object.entries(value);
  if (entries.length > 100) {
    return `El campo ${path} contiene demasiadas propiedades.`;
  }

  for (const [key, fieldValue] of entries) {
    const fieldPath = `${path}.${key}`;
    const fieldError = validateField(fieldPath, fieldValue);
    if (fieldError) {
      return fieldError;
    }

    const nested = walkPayload(fieldValue, fieldPath);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function validateRequestInput(req: Request, res: Response, next: NextFunction) {
  const methodsWithBody = new Set(["POST", "PUT", "PATCH"]);
  if (!methodsWithBody.has(req.method)) {
    return next();
  }

  if (!isPlainObject(req.body)) {
    return res.status(400).json({
      message: "El cuerpo de la solicitud debe enviarse en formato JSON valido.",
      code: "INVALID_BODY_FORMAT",
    });
  }

  const error = walkPayload(req.body);
  if (error) {
    return res.status(400).json({
      message: error,
      code: "INVALID_INPUT",
    });
  }

  return next();
}

