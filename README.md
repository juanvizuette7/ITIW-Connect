# ITIW Connect

> Marketplace de servicios del hogar en Colombia.
> Conecta clientes con profesionales verificados, cotizaciones inteligentes y pagos seguros con escrow.

## Estado Actual

**Sprint 1 + Sprint 2 + Sprint 3 implementados**

- Auth completa con JWT + bcrypt
- Solicitudes, cotizaciones y score IA basico
- Jobs, pagos en escrow con Stripe (test/mock), liberacion manual y automatica
- Chat interno por solicitud (solo participantes)
- Frontend dark premium en Next.js 14

---

## Stack Tecnologico

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- JWT + bcrypt (12 rounds)
- Nodemailer
- Stripe (modo test)
- node-cron

### Frontend
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- Stripe Elements

---

## Lo Que Ya Hace la Plataforma

### Sprint 1 (Base)
- Registro/login por rol (`CLIENTE` / `PROFESIONAL`)
- Verificacion OTP por correo
- Recuperacion y reset de contrasena
- Perfiles por rol
- Dashboard base y rutas protegidas

### Sprint 2 (Marketplace)
- Crear solicitudes de servicio
- Profesionales envian cotizaciones (max 5)
- Cliente acepta cotizacion y crea job
- Score IA para ordenar cotizaciones:

```text
score = (avgRating * 0.5) + (totalJobs * 0.3) + ((1 / amountCop) * 0.2)
```

- Seed de 18 categorias reales
- Correos de flujo (solicitud creada, nuevo presupuesto, presupuesto aceptado)

### Sprint 3 (Pagos + Chat)
- Jobs con estado operativo y estado de pago
- Pago con Stripe en escrow
- Comision automatica del 10%
- Confirmacion del cliente para liberar pago
- Liberacion automatica a las 72 horas por scheduler
- Chat interno por solicitud/job
- Correos de pago y mensajes

---

## Arquitectura del Proyecto

```text
ITIW_Connect/
  backend/
    prisma/
      migrations/
      schema.prisma
      seed.ts
    src/
      config/
      controllers/
      middlewares/
      routes/
      services/
      utils/
  frontend/
    app/
      auth/
      dashboard/
    components/
    lib/
  scripts/
  package.json
```

---

## Base de Datos (Prisma)

Modelos principales:
- `users`
- `client_profiles`
- `professional_profiles`
- `categories`
- `service_requests`
- `quotes`
- `jobs`
- `payments`
- `messages`

Enums relevantes:
- `Role`
- `ServiceRequestStatus`
- `QuoteStatus`
- `JobStatus`
- `JobPaymentStatus`
- `PaymentStatus`

---

## API (Backend) - Endpoints Principales

Base URL local: `http://localhost:4000/api`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Perfil
- `GET /profile/me` (JWT)
- `PUT /profile/client` (JWT + CLIENTE)
- `PUT /profile/professional` (JWT + PROFESIONAL)

### Marketplace
- `GET /categories`
- `POST /requests` (CLIENTE)
- `GET /requests` (CLIENTE)
- `GET /requests/:id` (JWT)
- `GET /requests/available` (PROFESIONAL)
- `GET /requests/my-quotes` (PROFESIONAL)
- `POST /requests/:id/quotes` (PROFESIONAL)
- `PUT /requests/:id/quotes/:quoteId/accept` (CLIENTE)

### Jobs y Pagos
- `POST /jobs/:jobId/pay` (CLIENTE)
- `POST /jobs/:jobId/confirm` (CLIENTE)
- `GET /jobs` (JWT)
- `GET /jobs/:jobId` (JWT)

### Chat
- `POST /messages/:requestId` (JWT)
- `GET /messages/:requestId` (JWT)

Health check:
- `GET /health`

---

## Frontend - Rutas Implementadas

### Publicas / Auth
- `/`
- `/auth/register`
- `/auth/verify-otp`
- `/auth/login`
- `/auth/forgot-password`
- `/auth/reset-password`

### Dashboard
- `/dashboard`
- `/dashboard/profile`
- `/dashboard/nueva-solicitud`
- `/dashboard/mis-solicitudes`
- `/dashboard/solicitud/[id]`
- `/dashboard/solicitudes-disponibles`
- `/dashboard/mis-cotizaciones`
- `/dashboard/mis-jobs`
- `/dashboard/job/[jobId]`
- `/dashboard/job/[jobId]/pagar`
- `/dashboard/job/[jobId]/chat`

---

## UI/UX

- Tema dark premium
- Fondo principal: `#0a1628`
- Primario: `#0f3460`
- Acento: `#e94560`
- Fuentes: **Syne** (titulos) + **DM Sans** (cuerpo)
- Montos: formato colombiano (`$185.000 COP`)
- Responsive mobile + desktop

---

## Configuracion de Entorno

Archivos esperados:
- `backend/.env`
- `frontend/.env.local`

Ejemplos disponibles:
- `backend/.env.example`
- `frontend/.env.example`

> Importante: nunca subas credenciales reales al repositorio.

---

## Instalacion y Ejecucion (Windows)

Desde la raiz del repo:

```bash
npm run setup:backend
npm run setup:frontend
```

Levantar todo:

```bash
npm run dev
```

Si hay conflictos de puertos/caches:

```bash
npm run dev:fresh
```

Build:

```bash
npm run build:backend
npm run build:frontend
```

---

## Scripts Utiles

- `npm run setup:backend`
- `npm run setup:frontend`
- `npm run dev`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run dev:clean`
- `npm run dev:fresh`
- `npm run build:backend`
- `npm run build:frontend`

---

## Correos Automatizados Implementados

- OTP y verificacion
- Recuperacion de contrasena
- Nueva solicitud creada
- Nuevo presupuesto recibido
- Presupuesto aceptado
- Pago retenido en escrow
- Pago liberado al profesional
- Pago liberado automaticamente
- Nuevo mensaje en chat

Todos con template HTML y branding ITIW Connect.

---

## Seguridad

- Password hashing con bcrypt (cost 12)
- JWT obligatorio en rutas protegidas
- Middleware por roles
- No se almacenan datos de tarjeta (solo `stripePaymentIntentId`)
- Control de acceso en chat (solo participantes del job)

---

## Troubleshooting Rapido

### Prisma P1001/P1002 (Neon)
1. Reintenta `npm run setup:backend`
2. Verifica conectividad de red/firewall/VPN
3. Reinicia backend: `npm run dev:backend`

### `EADDRINUSE` en puertos 3000/4000
- Usa: `npm run dev:fresh`

### Error raro de Next (`Cannot find module './xx.js'` en `.next`)
- Limpia cache: `npm run dev:clean`

---

## Roadmap Sugerido

- Sistema de calificaciones/reviews post-servicio
- WebSockets para chat en tiempo real
- Adjuntos multimedia en chat y solicitudes
- Panel admin de moderacion y soporte
- Observabilidad (logs estructurados + metricas)

---

## Licencia

Uso interno / MVP ITIW Connect.