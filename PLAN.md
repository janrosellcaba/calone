# Calone — Plan de Desarrollo

> Agregador personal de calendarios (Google Calendar + Microsoft Graph), auto-hosteado, solo lectura en UI, edición vía redirección a la app nativa.

**Estado actual del repo:** scaffolding mínimo.

- `frontend/`: Vite + React 19 + TypeScript (boilerplate; sin Tailwind ni librería de calendario).
- `backend/`: Express 5 + TypeScript + dotenv + cors (sin Prisma ni estructura de `src/` todavía).
- Sin monorepo tooling, sin auth, sin OAuth, sin DB.

**Decisión de alcance v1:** un único usuario (el dueño del servidor). No multi-tenant.

---

## 1. Principios de arquitectura

| Principio | Decisión |
|-----------|----------|
| Aislamiento de cuentas | Cada cuenta OAuth guarda sus propios tokens. Nunca se mezclan permisos entre proveedores ni entre cuentas del mismo proveedor. |
| Tokens en servidor | Access/refresh tokens solo viven en SQLite (backend). El frontend nunca los ve. |
| Refresh silencioso | Antes de llamar a Google/MS Graph, un servicio comprueba `expiresAt` y renueva si hace falta. |
| Frontend read-only | Click en evento → `window.open(originalUrl)`. Sin escritura vía API. |
| Auth de app | Contraseña maestra + sesión por cookie httpOnly (o token de sesión firmado). Suficiente para auto-host de un usuario. |
| Despliegue | Un proceso Node + un archivo SQLite. Ideal para VPS / Docker / Raspberry Pi. |

### Diagrama de flujo (alto nivel)

```
[Browser] --cookie sesión--> [Express]
                                |
                    +-----------+-----------+
                    |           |           |
              /auth/*     /accounts/*   /events
                    |           |           |
              master pwd    OAuth start/  TokenService
                            callback/     (refresh)
                            CRUD          |
                                          +-- Google Calendar API
                                          +-- Microsoft Graph API
                                          |
                                    Normalizer → UnifiedEvent[]
```

---

## 2. Estructura de carpetas propuesta

```
calone/
├── PLAN.md
├── README.md
├── .env.example                 # vars documentadas (sin secretos)
├── docker-compose.yml           # (fase posterior / opcional)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env                     # gitignored
│   └── src/
│       ├── index.ts             # bootstrap Express
│       ├── config.ts            # env tipado
│       ├── db.ts                # PrismaClient singleton
│       ├── middleware/
│       │   ├── requireAuth.ts
│       │   └── errorHandler.ts
│       ├── routes/
│       │   ├── auth.ts          # login / logout / me
│       │   ├── oauth.ts         # Google + Microsoft connect/callback
│       │   ├── accounts.ts      # list / disconnect
│       │   └── events.ts        # GET /events
│       ├── services/
│       │   ├── tokenService.ts  # ensureValidAccessToken
│       │   ├── googleCalendar.ts
│       │   ├── microsoftCalendar.ts
│       │   └── eventAggregator.ts
│       ├── providers/
│       │   ├── googleOAuth.ts
│       │   └── microsoftOAuth.ts
│       └── types/
│           └── events.ts        # UnifiedEvent
└── frontend/
    ├── package.json
    ├── vite.config.ts           # proxy /api → backend en dev
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/client.ts
        ├── auth/
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── CalendarPage.tsx
        │   └── IntegrationsPage.tsx
        ├── components/
        │   ├── EventCalendar.tsx
        │   └── AccountCard.tsx
        └── types/
            └── events.ts
```

---

## 3. Esquema Prisma propuesto

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

/// Sesión del dueño de la instancia (login con contraseña maestra).
/// No hay tabla User: un solo operador. La contraseña vive en env (MASTER_PASSWORD_HASH).
model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique // hash del cookie/token de sesión
  expiresAt DateTime
  createdAt DateTime @default(now())
}

enum Provider {
  GOOGLE
  MICROSOFT
}

/// Una cuenta de calendario conectada (puede haber N de Google y N de Microsoft).
model CalendarAccount {
  id           String   @id @default(cuid())
  provider     Provider
  /// Identificador estable del proveedor (Google sub / Microsoft oid o homeAccountId).
  externalId   String
  email        String?
  displayName  String?
  /// Scopes concedidos (espacio-separados), útil para diagnóstico.
  scopes       String?
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  /// JSON opcional (p. ej. tenantId MS, calendarId por defecto).
  metadata     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([provider, externalId])
  @@index([provider])
}
```

### Notas de diseño del esquema

1. **Sin modelo `User`:** la app es single-user; la contraseña maestra va en `MASTER_PASSWORD` / `MASTER_PASSWORD_HASH` en `.env`.
2. **Tokens en claro en SQLite (v1):** aceptable en auto-host si el filesystem y el backup están protegidos. En v1.1 se puede cifrar con `TOKEN_ENCRYPTION_KEY` (AES-GCM) sin cambiar el contrato de la API.
3. **`@@unique([provider, externalId])`:** reconectar la misma cuenta actualiza tokens en lugar de duplicar filas.
4. **`refreshToken` nullable:** algunos flujos MS pueden no devolverlo si no se pide `offline_access`; lo validaremos en el callback.
5. **`Session.tokenHash`:** no guardamos el valor del cookie en claro; solo un hash (sha256).

### Variables de entorno (`.env.example`)

```bash
# Server
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:5173          # origen del frontend (CORS + redirects post-OAuth)
API_URL=http://localhost:3001          # URL pública del backend (redirect_uri OAuth)
SESSION_SECRET=change-me-long-random
MASTER_PASSWORD=change-me              # o MASTER_PASSWORD_HASH=...

# Database
DATABASE_URL="file:./dev.db"

# Google OAuth (Calendar API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google/callback

# Microsoft OAuth (Graph Calendar)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common             # common | organizations | consumers | {tenant}
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/oauth/microsoft/callback
```

---

## 4. Contrato de datos unificado

```ts
// Shared conceptual type (backend + frontend)

export type CalendarSource = "GOOGLE" | "MICROSOFT";

export interface UnifiedEvent {
  id: string;           // `${provider}:${accountId}:${providerEventId}`
  title: string;
  start: string;        // ISO 8601
  end: string;          // ISO 8601
  allDay: boolean;
  source: CalendarSource;
  accountId: string;    // CalendarAccount.id
  accountEmail?: string;
  originalUrl: string;  // deep-link a Google Calendar / Outlook
  location?: string;
  description?: string; // opcional; truncar en listados
}
```

Query de eventos:

```
GET /api/events?from=2026-08-01T00:00:00.000Z&to=2026-09-01T00:00:00.000Z
```

Respuesta:

```json
{
  "events": [ /* UnifiedEvent[] */ ],
  "errors": [
    { "accountId": "...", "provider": "GOOGLE", "message": "token revoked" }
  ]
}
```

`errors` parciales permiten mostrar el calendario aunque una cuenta falle (UX resiliente).

---

## 5. Estructura de endpoints de la API

Prefijo base: `/api`. Todas las rutas excepto login y callbacks OAuth requieren sesión autenticada (`requireAuth`).

### 5.1 Autenticación de la app (dueño)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | No | Body `{ password }`. Si OK → Set-Cookie `calone_session` (httpOnly, SameSite=Lax, Secure en prod). |
| `POST` | `/api/auth/logout` | Sí | Invalida sesión en DB + limpia cookie. |
| `GET`  | `/api/auth/me` | Sí | `{ authenticated: true }` o 401. Usado por el frontend al arrancar. |

### 5.2 OAuth — conexión de cuentas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/oauth/google/start` | Sí | Genera `state` (CSRF) en cookie/memoria corta, redirige a Google consent. Scopes: `openid email profile https://www.googleapis.com/auth/calendar.readonly`. `access_type=offline`, `prompt=consent` (para forzar refresh_token). |
| `GET` | `/api/oauth/google/callback` | No* | Intercambia `code` → tokens, obtiene perfil, upsert `CalendarAccount`, redirige a `${APP_URL}/integrations?connected=google`. |
| `GET` | `/api/oauth/microsoft/start` | Sí | Igual patrón. Scopes: `openid email profile offline_access Calendars.Read`. |
| `GET` | `/api/oauth/microsoft/callback` | No* | Igual patrón MS Graph `/me` + tokens. |

\* El callback valida `state` (ligado a la sesión iniciada), no exige cookie de app en el redirect del IdP si el `state` ya prueba el origen; implementación recomendada: `state` firmado o almacenado en tabla/sesión temporal asociada al usuario dueño.

### 5.3 Gestión de cuentas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`    | `/api/accounts` | Sí | Lista cuentas conectadas **sin** tokens: `{ id, provider, email, displayName, createdAt, expiresAt }`. |
| `DELETE` | `/api/accounts/:id` | Sí | Desconecta: borra fila. (Opcional v1.1: revocar token en el proveedor.) |

### 5.4 Eventos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/events` | Sí | Query `from`, `to` (ISO). Para cada `CalendarAccount`: `ensureValidAccessToken` → fetch paralelo (`Promise.allSettled`) → normalizar → merge + sort por `start`. |

### 5.5 Salud

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | `{ ok: true }` para Docker/uptime. |

---

## 6. Servicios clave del backend

### 6.1 `tokenService.ensureValidAccessToken(account)`

1. Si `expiresAt` existe y `expiresAt > now + 60s` → devolver `accessToken` actual.
2. Si no hay `refreshToken` → marcar error recuperable / pedir reconexión.
3. Llamar al endpoint de refresh del proveedor.
4. Persistir nuevo `accessToken`, `refreshToken` (si viene), `expiresAt`.
5. Devolver token fresco.

### 6.2 Proveedores de calendario

- **Google:** `GET https://www.googleapis.com/calendar/v3/calendars/primary/events` con `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`. `originalUrl` = `htmlLink` del evento (o construir `https://calendar.google.com/calendar/event?eid=...`).
- **Microsoft:** `GET https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=&endDateTime=` con header `Prefer: outlook.timezone="UTC"`. `originalUrl` = `webLink`.

### 6.3 `eventAggregator`

- Itera cuentas, aplica token refresh, fetch concurrente.
- Mapea a `UnifiedEvent`.
- Concatena resultados OK; acumula fallos en `errors`.
- Ordena por `start` ascendente.

---

## 7. Frontend — pantallas y flujo UX

1. **Login** (`/` o `/login`): un campo contraseña + CTA. Sin registro.
2. **Calendario** (`/` autenticado): vista mes/semana/día (librería a elegir en Fase F).
3. **Integraciones** (`/integrations`): botones “Conectar Google” / “Conectar Microsoft” → `window.location = /api/oauth/.../start`. Lista de cuentas con “Desconectar”.
4. Click evento → `window.open(event.originalUrl, "_blank", "noopener,noreferrer")`.

**Dev proxy:** Vite `server.proxy["/api"] → http://localhost:3001` para same-origin cookies en desarrollo.

**Librería de calendario (decisión en Fase F):** preferencia inicial `@fullcalendar/react` (mejor soporte timezones/all-day) o `react-big-calendar` (más ligera). Se decide tras un spike de 1–2 h.

---

## 8. Plan secuencial de desarrollo (sin bloqueos)

Cada fase deja algo **demostrable**. Backend y frontend avanzan en paralelo cuando no hay dependencia dura.

### Fase 0 — Alineación (este documento)
- [ ] Revisar y aprobar este plan (decisiones abiertas al final).
- [ ] Crear proyectos OAuth en Google Cloud Console y Azure Portal (App Registration).
- [ ] Anotar Client IDs/Secrets en `.env` local (no commitear).

### Fase 1 — Infraestructura de proyecto ✅ (pendiente confirmación del usuario)
**Backend**
- [x] Estructura `src/`, scripts `dev` / `build` / `start` (`tsx` + `tsc`).
- [x] `config.ts` con validación de env.
- [x] Prisma: schema + migrate + `db.ts`.
- [x] Express: CORS (credenciales), cookie-parser, JSON, `errorHandler`, `/api/health`.

**Frontend (en paralelo)**
- [x] Tailwind CSS.
- [x] React Router.
- [x] Cliente `fetch` con `credentials: "include"`.
- [x] Shell de layout (nav: Calendario | Integraciones; Logout en Fase 2).

**Criterio de salida:** `GET /api/health` OK; frontend en blanco con rutas stub.

### Fase 2 — Auth de app (single-user) ✅ (pendiente confirmación del usuario)
**Backend**
- [x] `POST /login`, `POST /logout`, `GET /me`.
- [x] Middleware `requireAuth`.
- [x] Hash de sesión + expiración (30 días).

**Frontend**
- [x] `LoginPage`.
- [x] Guard de rutas: si `/me` → 401, redirigir a login.

**Criterio de salida:** proteger cualquier ruta `/api/*` (salvo health/login/callbacks) y el dashboard.

### Fase 3 — OAuth Google (extremo a extremo)
**Backend**
- [ ] `/oauth/google/start` + `/callback` + upsert `CalendarAccount`.
- [ ] `GET /accounts` + `DELETE /accounts/:id`.
- [ ] `tokenService` refresh Google.
- [ ] Spike: listar 5 eventos de `primary` en un endpoint temporal o log.

**Frontend**
- [ ] `IntegrationsPage`: botón Conectar Google + listado + desconectar.
- [ ] Manejo de query `?connected=` / `?error=`.

**Criterio de salida:** conectar, ver cuenta, desconectar, reconectar sin duplicar.

### Fase 4 — OAuth Microsoft (espejo de Fase 3)
- [ ] Mismos endpoints y UI para Microsoft.
- [ ] Refresh con `offline_access`.
- [ ] Probar cuenta personal (`consumers`) y/o laboral (`organizations`) según `MICROSOFT_TENANT_ID`.

**Criterio de salida:** N cuentas Google + M Microsoft en la misma lista.

### Fase 5 — Agregación de eventos
**Backend**
- [ ] `googleCalendar.ts` + `microsoftCalendar.ts` + `eventAggregator.ts`.
- [ ] `GET /api/events?from&to` con `Promise.allSettled` y `errors[]`.
- [ ] Tests manuales: token caducado → refresh automático sin intervención.

**Frontend**
- [ ] Hook `useEvents(range)` + estados loading / partial error.

**Criterio de salida:** JSON unificado correcto desde Postman/curl y desde el cliente.

### Fase 6 — UI de calendario (read-only)
- [ ] Instalar librería elegida + adapters de fecha.
- [ ] `CalendarPage`: pintar `UnifiedEvent` con color por `source` (o por `accountId`).
- [ ] Click → `originalUrl`.
- [ ] Navegación de rango (mes/semana) que dispare nuevo fetch.

**Criterio de salida:** un mes con eventos de ambos proveedores; click abre Google/Outlook.

### Fase 7 — Endurecimiento y DX de auto-host
- [ ] `.env.example` completo + README de despliegue (Node 20+, migrate, build).
- [ ] Rate limiting básico en `/login`.
- [ ] Logs sin imprimir tokens.
- [ ] (Opcional) Docker multi-stage: backend + static frontend servido por Express o nginx.
- [ ] (Opcional) cifrado de tokens en reposo.

**Criterio de salida:** un tercero puede clonar, configurar OAuth, y levantar Calone en <30 min.

---

## 9. Orden de trabajo recomendado por persona/sesión

Para no bloquearse si trabajamos en un solo hilo:

```
F1 backend (health + prisma)  →  F2 auth
        ↘
         F1 frontend shell + Tailwind
              → F2 login UI (cuando /me exista)
F3 Google OAuth (backend first, UI al tener callback)
F4 Microsoft
F5 /events
F6 Calendar UI
F7 polish
```

El **camino crítico** es: Prisma → Auth app → OAuth Google → `/events` Google → UI calendario. Microsoft es paralelo conceptualmente pero secuencial en implementación para reutilizar el patrón.

---

## 10. Decisiones cerradas

1. **Auth de app:** contraseña maestra en `.env` + cookie de sesión httpOnly.
2. **Scopes:** solo lectura (`calendar.readonly` / `Calendars.Read`).
3. **Calendarios:** solo *primary/default* por cuenta en v1.
4. **Librería UI:** `@fullcalendar/react`.
5. **Cifrado de tokens en DB:** en claro en SQLite (v1); el host ya cifra disco.
6. **Empaquetado:** Express sirve los estáticos del frontend en producción.

---

## 11. Fuera de alcance (v1)

- Escritura/creación de eventos desde Calone.
- Multi-usuario / invitaciones.
- Apple Calendar / CalDAV genérico.
- Sync en background con webhooks/push (polling on-demand por rango de UI es suficiente).
- App móvil nativa.
- Integración con Timbal u otras plataformas.

---

## 12. Criterio de “MVP listo”

Un usuario puede:

1. Arrancar backend + frontend.
2. Entrar con la contraseña maestra.
3. Conectar al menos una cuenta Google y una Microsoft.
4. Ver un calendario unificado del mes actual.
5. Hacer clic en un evento y aterrizar en la UI nativa para editarlo.
6. Desconectar una cuenta sin romper el resto.

---

*Documento vivo. Tras tu OK, empezamos por **Fase 1 (infraestructura)**.*
