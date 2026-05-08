import { prisma } from "../src/config/prisma";

type StepResult = {
  ok: boolean;
  status: number;
  data: any;
};

const API_BASE = process.env.E2E_API_URL || "http://localhost:4000/api";

const clientEmail = "juanvizuette58@gmail.com";
const professionalEmail = "juanvizuette58+pro@gmail.com";
const clientPassword = "Cliente123*";
const professionalPassword = "Profesional123*";

async function request(path: string, init: RequestInit = {}): Promise<StepResult> {
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string> | undefined) || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function fail(step: number, label: string, detail: string): never {
  throw new Error(`FALLO EN PASO ${step} (${label}): ${detail}`);
}

async function registerOrLogin(params: {
  step: number;
  email: string;
  phone: string;
  password: string;
  role: "CLIENTE" | "PROFESIONAL";
  name: string;
}) {
  const reg = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      phone: params.phone,
      password: params.password,
      role: params.role,
      name: params.name,
    }),
  });

  if (!(reg.status === 201 || reg.status === 409)) {
    fail(params.step, `Registro ${params.role}`, `${reg.status} ${JSON.stringify(reg.data)}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: params.email.toLowerCase() },
    select: { otpCode: true },
  });

  if (user?.otpCode) {
    const verify = await request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        otpCode: user.otpCode,
      }),
    });

    if (!verify.ok) {
      fail(params.step + 1, `Verificar OTP ${params.role}`, `${verify.status} ${JSON.stringify(verify.data)}`);
    }
  }

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      password: params.password,
    }),
  });

  if (!login.ok || !login.data?.token) {
    fail(params.step + 2, `Login ${params.role}`, `${login.status} ${JSON.stringify(login.data)}`);
  }

  return login.data.token as string;
}

async function main() {
  try {
    await prisma.$connect();

    const clientToken = await registerOrLogin({
      step: 1,
      email: clientEmail,
      phone: `300${Date.now().toString().slice(-7)}`,
      password: clientPassword,
      role: "CLIENTE",
      name: "Juan Vizuette Cliente",
    });

    const professionalToken = await registerOrLogin({
      step: 4,
      email: professionalEmail,
      phone: `301${Date.now().toString().slice(-7)}`,
      password: professionalPassword,
      role: "PROFESIONAL",
      name: "Juan Vizuette Profesional",
    });

    const categories = await request("/categories");
    if (!categories.ok || !Array.isArray(categories.data)) {
      fail(7, "Consultar categorias", `${categories.status} ${JSON.stringify(categories.data)}`);
    }

    const electricidad = categories.data.find(
      (category: { name?: string }) => (category.name || "").toLowerCase() === "electricidad",
    );
    if (!electricidad?.id) {
      fail(7, "Consultar categorias", "No se encontro la categoria Electricidad");
    }

    const createdRequest = await request("/requests", {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: JSON.stringify({
        categoryId: electricidad.id,
        description: "E2E: necesito revision electrica y cambio de interruptor.",
      }),
    });
    if (!createdRequest.ok || !createdRequest.data?.request?.id) {
      fail(8, "Crear solicitud", `${createdRequest.status} ${JSON.stringify(createdRequest.data)}`);
    }
    const requestId = createdRequest.data.request.id as string;

    const quote = await request(`/requests/${requestId}/quotes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${professionalToken}` },
      body: JSON.stringify({
        amountCop: 150000,
        estimatedHours: 3,
        message: "E2E: cotizacion de prueba",
      }),
    });
    if (!quote.ok) {
      fail(9, "Enviar cotizacion", `${quote.status} ${JSON.stringify(quote.data)}`);
    }

    const detail = await request(`/requests/${requestId}`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    if (!detail.ok || !Array.isArray(detail.data?.quotes) || !detail.data.quotes[0]?.id) {
      fail(10, "Detalle solicitud", `${detail.status} ${JSON.stringify(detail.data)}`);
    }
    const quoteId = detail.data.quotes[0].id as string;

    const accepted = await request(`/requests/${requestId}/quotes/${quoteId}/accept`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    if (!accepted.ok || !accepted.data?.job?.id) {
      fail(11, "Aceptar cotizacion", `${accepted.status} ${JSON.stringify(accepted.data)}`);
    }
    const jobId = accepted.data.job.id as string;

    const paymentCreate = await request(`/jobs/${jobId}/pay`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: JSON.stringify({ action: "create" }),
    });
    if (!paymentCreate.ok || !paymentCreate.data?.paymentIntentId) {
      fail(12, "Crear payment intent", `${paymentCreate.status} ${JSON.stringify(paymentCreate.data)}`);
    }

    const paymentConfirm = await request(`/jobs/${jobId}/pay`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: JSON.stringify({
        action: "confirm",
        paymentIntentId: paymentCreate.data.paymentIntentId,
      }),
    });
    if (!paymentConfirm.ok) {
      fail(13, "Confirmar pago", `${paymentConfirm.status} ${JSON.stringify(paymentConfirm.data)}`);
    }

    const jobConfirm = await request(`/jobs/${jobId}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    if (!jobConfirm.ok) {
      fail(14, "Confirmar trabajo", `${jobConfirm.status} ${JSON.stringify(jobConfirm.data)}`);
    }

    const reviewPayload = {
      rating: 5,
      subcategoryRatings: {
        puntualidad: 5,
        calidad: 5,
        comunicacion: 5,
        limpieza: 5,
      },
      comment: "Excelente servicio E2E.",
    };

    const reviewProfessional = await request(`/reviews/${jobId}/professional`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clientToken}` },
      body: JSON.stringify(reviewPayload),
    });
    if (!reviewProfessional.ok) {
      fail(15, "Cliente califica profesional", `${reviewProfessional.status} ${JSON.stringify(reviewProfessional.data)}`);
    }

    const reviewClient = await request(`/reviews/${jobId}/client`, {
      method: "POST",
      headers: { Authorization: `Bearer ${professionalToken}` },
      body: JSON.stringify({
        ...reviewPayload,
        comment: "Cliente responsable E2E.",
      }),
    });
    if (!reviewClient.ok) {
      fail(16, "Profesional califica cliente", `${reviewClient.status} ${JSON.stringify(reviewClient.data)}`);
    }

    console.log("FLUJO COMPLETO OK");
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(`FALLO EN PASO DESCONOCIDO: ${String(error)}`);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
