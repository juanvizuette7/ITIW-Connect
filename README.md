# ITIW Connect

Marketplace de servicios del hogar en Colombia.

Estado actual: Sprint 1 y Sprint 2 implementados.

## Stack

- Backend: Node.js + Express + TypeScript
- Frontend: Next.js 14 + TailwindCSS
- Base de datos: PostgreSQL (Neon) + Prisma ORM
- Auth: JWT + bcrypt (12 rounds)
- Correos: Nodemailer

## Estado del proyecto

- Sprint 1: autenticacion, OTP, recuperacion de contrasena, perfiles, dashboard base.
- Sprint 2: solicitudes, presupuestos, score IA, notificaciones por correo, pantallas de flujo cliente/profesional.

## Estructura

```text
ITIW_Connect/
  backend/
    prisma/
    src/
  frontend/
    app/
    components/
    lib/
  package.json
```

## Modulos implementados

### Base de datos (Prisma)

Tablas principales:

- `users`
- `client_profiles`
- `professional_profiles`
- `categories`
- `service_requests`
- `quotes`

Enums:

- `Role`: `CLIENTE`, `PROFESIONAL`
- `ServiceRequestStatus`: `ACTIVA`, `AGENDADA`, `COMPLETADA`, `CANCELADA`
- `QuoteStatus`: `PENDIENTE`, `ACEPTADA`, `RECHAZADA`

Seed actual:

- 18 categorias canonicas de Sprint 2 (Electricidad, Plomeria, Carpinteria, etc.)

### Backend API (`/api`)

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Perfil:

- `GET /profile/me` (JWT)
- `PUT /profile/client` (JWT + CLIENTE)
- `PUT /profile/professional` (JWT + PROFESIONAL)

Categorias:

- `GET /categories`

Solicitudes y presupuestos:

- `POST /requests` (JWT + CLIENTE)
- `GET /requests` (JWT + CLIENTE)
- `GET /requests/:id` (JWT)
- `GET /requests/available` (JWT + PROFESIONAL)
- `POST /requests/:id/quotes` (JWT + PROFESIONAL, max 5 presupuestos)
- `PUT /requests/:id/quotes/:quoteId/accept` (JWT + CLIENTE)

Score IA de presupuestos:

```text
score = (avgRating * 0.5) + (totalJobs * 0.3) + ((1 / amountCop) * 0.2)
```

Los presupuestos se devuelven ordenados de mayor a menor score.

### Frontend (Next.js)

Auth:

- `/auth/register`
- `/auth/verify-otp`
- `/auth/login`
- `/auth/forgot-password`
- `/auth/reset-password`

Dashboard:

- `/dashboard`
- `/dashboard/profile`
- `/dashboard/nueva-solicitud`
- `/dashboard/mis-solicitudes`
- `/dashboard/solicitud/[id]`
- `/dashboard/solicitudes-disponibles`

UI:

- Tema dark premium
- Fondo principal `#0a1628`
- Colores `#0f3460` y `#e94560`
- Fuentes Syne + DM Sans
- Formato COP en montos (`$185.000 COP`)

## Correos automatizados

Se envian correos HTML con branding ITIW Connect para:

- Creacion de solicitud
- Nuevo presupuesto recibido
- Presupuesto aceptado
- OTP y recuperacion de contrasena

## Variables de entorno

Archivos usados por el proyecto:

- `backend/.env`
- `frontend/.env.local`

Tambien existen ejemplos:

- `backend/.env.example`
- `frontend/.env.example`

## Comandos principales

Desde la raiz del repo:

Instalar backend + Prisma:

```bash
npm run setup:backend
```

Instalar frontend:

```bash
npm run setup:frontend
```

Levantar backend + frontend:

```bash
npm run dev
```

Levantar por separado:

```bash
npm run dev:backend
npm run dev:frontend
```

Build:

```bash
npm run build:backend
npm run build:frontend
```

## URLs locales

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health check backend: `http://localhost:4000/health`

## Troubleshooting rapido

### Error Prisma `P1001` o `P1002` con Neon

Si aparece conexion intermitente a Neon:

1. Reintenta request o reinicia `npm run dev`.
2. Verifica internet/VPN/firewall.
3. Revisa que el host y puerto `5432` del endpoint Neon esten accesibles.

El backend ya incluye reintentos de consulta y manejo de error `503` para cortes breves de conexion.

### Error `EADDRINUSE: 4000`

Ya hay otro proceso usando el puerto 4000. Cierra el proceso anterior del backend y vuelve a ejecutar.

## Nota de seguridad

- No guardar datos de tarjeta ni documentos sensibles.
- JWT requerido en rutas protegidas.
- Passwords con bcrypt costo 12.

## Verificacion tecnica reciente

- `npm --prefix backend run build` OK
- `npm --prefix frontend run build` OK
- Seed de categorias ejecutado y validado en Neon (18 categorias canonicas)
"# ITIW-Connect" 
