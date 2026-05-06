# NORA - Plataforma de Conexión

## Stack

| Componente     | Tecnología            |
|---------------|----------------------|
| Runtime       | Node.js              |
| Lenguaje      | TypeScript (strict)  |
| Framework HTTP | Express 5           |
| ORM           | Prisma               |
| Base de datos | PostgreSQL           |
| Auth          | JWT                  |
| Frontend      | Vite + React 19 + Tailwind CSS 4 + react-router-dom |
| Linter        | ESLint + Prettier    |

## Architecture

```
noraconecta/                   # Monorepo root (npm workspaces)
├── backend/
│   ├── src/
│   │   ├── server.ts                  # Entry point: Express app bootstrap
│   │   ├── lib/
│   │   │   ├── prisma.ts              # Prisma client singleton
│   │   │   └── r2-client.ts           # Cloudflare R2 client (presigned URLs)
│   │   ├── middleware/
│   │   │   ├── error-handler.ts       # Global error handler (AppError, 500 fallback)
│   │   │   ├── require-auth.ts        # JWT validation middleware
│   │   │   └── require-super-admin.ts # SUPERADMIN role guard
│   │   ├── utils/
│   │   │   └── jwt.ts                 # signToken / verifyToken
│   │   ├── types/
│   │   │   └── express.d.ts           # Express Request augmentation (req.admin)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts     # POST /auth/login
│   │   │   │   ├── auth.controller.ts # Request validation, response formatting
│   │   │   │   ├── auth.service.ts    # Login logic, bcrypt comparison, JWT signing
│   │   │   │   └── auth.repository.ts # Prisma queries for Admin model
│   │   │   ├── categories/
│   │   │   │   ├── categories.routes.ts     # 6 endpoints under /categories
│   │   │   │   ├── categories.controller.ts # Request validation, response formatting
│   │   │   │   ├── categories.service.ts    # Slug generation, Levenshtein matching
│   │   │   │   └── categories.repository.ts # Prisma queries for Category model
│   │   │   ├── locations/
│   │   │   │   ├── locations.routes.ts     # 7 endpoints under /locations
│   │   │   │   ├── locations.controller.ts # Request validation, response formatting
│   │   │   │   ├── locations.service.ts    # Geo hierarchy business logic
│   │   │   │   └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
│   │   │   ├── users/
│   │   │   │   ├── users.routes.ts         # 4 endpoints under /users
│   │   │   │   ├── users.controller.ts     # Request validation, response formatting
│   │   │   │   ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock
│   │   │   │   └── users.repository.ts     # Prisma queries for User model
│   │   │   └── professionals/
│   │   │       ├── professionals.routes.ts     # 13 endpoints under /professionals
│   │   │       ├── professionals.controller.ts # Request validation, response formatting
│   │   │       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session, panel
│   │   │   └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone (includes category, zones with geoNode), panel data, orders
│   │   │   ├── admin/
│   │   │   │   ├── admin.routes.ts     # GET /admin/metrics (dashboard KPIs)
│   │   │   │   ├── admin.controller.ts # Request handling
│   │   │   │   ├── admin.service.ts    # Aggregates metrics from multiple entities
│   │   │   │   └── admin.repository.ts # Prisma aggregate queries
│   │   │   ├── plans/
│   │   │   │   ├── plans.routes.ts     # 3 endpoints under /plans
│   │   │   │   ├── plans.controller.ts # Request validation, response formatting
│   │   │   │   ├── plans.service.ts    # Plan CRUD, price validation
│   │   │   │   └── plans.repository.ts # Prisma queries for Plan model
│   │   │   ├── memberships/
│   │   │   │   ├── memberships.routes.ts     # 2 endpoints under /professionals
│   │   │   │   ├── memberships.controller.ts # Request validation, response formatting
│   │   │   │   ├── memberships.service.ts    # canReceiveRequests, activateMembership, getStatus
│   │   │   │   └── memberships.repository.ts # Prisma queries for Membership/Professional models
│   │   │   ├── config/
│   │   │   │   ├── config.routes.ts     # 2 endpoints under /config
│   │   │   │   ├── config.controller.ts # Request validation, response formatting
│   │   │   │   ├── config.service.ts    # Key-value config get/update
│   │   │   │   └── config.repository.ts # Prisma queries for SystemConfig model
│   │   │   ├── matching/
│   │   │   │   ├── matching.service.ts    # Scoring ponderado + filtros duros (sin endpoints)
│   │   │   │   └── matching.repository.ts # Prisma queries para motor de matching
│   │   │   ├── requests/
│   │   │   │   ├── requests.routes.ts     # 10 endpoints under /requests
│   │   │   │   ├── requests.controller.ts # Request validation, response formatting
│   │   │   │   ├── requests.service.ts    # Request lifecycle, matching, reassignment, timeouts
│   │   │   │   └── requests.repository.ts # Prisma queries for Request/RequestEvent/Feedback
│   │   │   ├── reputation/
│   │   │   │   ├── reputation.service.ts    # Automatic penalizations, badge evaluation
│   │   │   │   └── reputation.repository.ts # NOT_FULFILLED counting, status/badge updates
│   │   │   ├── escalations/
│   │   │   │   ├── escalations.routes.ts     # 4 endpoints under /escalations
│   │   │   │   ├── escalations.controller.ts # Request validation, response formatting
│   │   │   │   ├── escalations.service.ts    # Escalation lifecycle, status transitions
│   │   │   │   └── escalations.repository.ts # Prisma queries for Escalation model
│   │   │   └── storage/
│   │   │       ├── storage.routes.ts     # POST /storage/presign-upload
│   │   │       ├── storage.controller.ts # Request validation, response formatting
│   │   │       └── storage.service.ts    # Folder/contentType validation, R2 delegation
│   │   │   ├── bot/
│   │   │   │   ├── bot.routes.ts         # POST /bot/message, POST /bot/session/reset
│   │   │   │   ├── bot.controller.ts     # Request validation, response formatting
│   │   │   │   ├── bot.service.ts        # Message processing, flow dispatch, session management, pending notifications
│   │   │   │   ├── bot.repository.ts     # Prisma queries for BotSession model
│   │   │   │   ├── coordination.service.ts # Visit coordination relay: init after accept, send reminders
│   │   │   │   ├── nlp.service.ts        # NLP: category/zone resolution with Levenshtein
│   │   │   │   ├── flows/
│   │   │   │   │   ├── types.ts          # Type definitions for flows
│   │   │   │   │   ├── user-request.flow.ts        # USER_REQUEST conversation flow
│   │   │   │   │   ├── professional-register.flow.ts # PROFESSIONAL_REGISTER flow
│   │   │   │   │   ├── coordination.flow.ts  # COORDINATION: visit scheduling relay flow
│   │   │   │   │   └── flow-handler.factory.ts     # Flow handler resolution
│   │   ├── routes/                    # (placeholder for future shared routes)
│   │   ├── controllers/               # (placeholder for future shared controllers)
│   │   ├── services/                  # (placeholder for future shared services)
│   │   └── repositories/              # (placeholder for future shared repositories)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc
│   ├── .prettierrc
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx                    # Entry point: React 19 root (dev mode)
│   │   ├── main-landing.tsx            # Entry point: landing build (noraconecta.com.ar)
│   │   ├── main-admin.tsx              # Entry point: admin build (admin.noraconecta.com.ar)
│   │   ├── main-app.tsx                # Entry point: app build (app.noraconecta.com.ar)
│   │   ├── App.tsx                     # Root component (dev): host-based routing — all routes on localhost, context-aware on subdomains
│   │   ├── App-landing.tsx             # Root component (landing): /simulator only
│   │   ├── App-admin.tsx               # Root component (admin): /admin/* only (production build)
│   │   ├── App-app.tsx                 # Root component (app): /verify/:token, /panel/:sessionToken (production build)
│   │   ├── index.css                   # Tailwind CSS directives + design tokens
│   │   ├── vite-env.d.ts               # Vite client type reference
│   │   ├── components/
│   │   │   └── chat/
│   │   │       ├── ChatHeader.tsx      # Header with title, phone selector, session status, reset
│   │   │       ├── ChatInput.tsx       # Message input bar with image/audio icons and send button
│   │   │       ├── MessageBubble.tsx   # Individual message bubble (user: emerald right, NORA: slate left)
│   │   │       ├── MessageList.tsx     # Scrollable message list with auto-scroll
│   │   │       ├── PhoneSelector.tsx   # Dropdown to switch between test phones/roles
│   │   │       ├── SessionStatus.tsx   # Pill badge showing active flow and step
│   │   │       ├── EmptyState.tsx      # Centered empty state with icon and instructions
│   │   │       └── TypingIndicator.tsx # Animated typing dots with "Procesando..." label
│   │   ├── hooks/
│   │   │   └── useChat.ts             # Chat state management: messages, loading, session, API calls
│   │   ├── lib/
│   │   │   ├── api.ts                 # REST client for /bot/message, /bot/session/reset, /storage/presign-upload
│   │   │   ├── admin-api.ts           # REST client for all admin endpoints (NEW)
│   │   │   ├── onboarding-api.ts      # API client for professional onboarding (NEW)
│   │   │   ├── panel-api.ts           # API client for professional panel (NEW)
│   │   │   └── host.ts                # Hostname detection: resolveHostContext(), getAdminDashboardPath() (NEW)
│   │   ├── types/
│   │   │   ├── chat.ts                # TypeScript interfaces for messages, responses
│   │   │   ├── onboarding.ts          # OnboardingStep, FileUploadInfo, OnboardingFormData, TokenValidationResponse
│   │   │   ├── admin.ts               # Interfaces for all admin entities (Professional, User, Request, Escalation, etc.) (NEW)
│   │   │   └── panel.ts               # Interfaces for professional panel data (PanelData, PanelOrder, etc.) (NEW)
│   │   ├── context/
│   │   │   └── AuthContext.tsx         # JWT in-memory auth provider (login, logout, role checks) (NEW)
│   │   ├── components/
│   │   │       ├── admin/
│   │   │       │   ├── AdminLayout.tsx     # Sidebar (collapsible mobile) + main content wrapper; context-aware nav links (NEW)
│   │   │       │   ├── ProtectedRoute.tsx  # Auth guard + optional role guard; context-aware redirect paths (NEW)
│   │   │       │   └── ConfirmDialog.tsx   # Reusable confirm modal for destructive actions (NEW)
│   │   ├── pages/
│   │   │   ├── SimulatorPage.tsx       # Main simulator page: composes all chat components, phone/role state
│   │   │   ├── admin/                  # Admin panel pages (NEW)
│   │   │   │   ├── LoginPage.tsx               # Centered login form (email + password)
│   │   │   │   ├── DashboardPage.tsx           # Metrics cards + professional status bars
│   │   │   │   ├── ProfessionalsPage.tsx        # Table with status filter, badges, pagination
│   │   │   │   ├── ProfessionalDetailPage.tsx   # Personal info, docs, history, approve/reject/suspend, generate session URL
│   │   │   ├── UsersPage.tsx                # Table with phone, status, block/unblock actions
│   │   │   │   ├── UsersPage.tsx                # Table with phone, status, block/unblock actions
│   │   │   │   ├── OrdersPage.tsx               # Table with status badges + compact timeline dots
│   │   │   │   ├── EscalationsPage.tsx          # Table with urgency summary, status change + resolve modal
│   │   │   │   ├── ZonesPage.tsx                # Hierarchical tree (Country → Province → Department) with toggles
│   │   │   │   ├── CategoriesPage.tsx           # Table with inline toggles + create/edit modal
│   │   │   │   ├── PlansPage.tsx                # Plan cards with price editing modal
│   │   │   │   └── SettingsPage.tsx             # Config form (matching, limits, integrations, notification toggles)
│   │   │   └── onboarding/
│   │   │       ├── OnboardingPage.tsx  # Main page: token validation, step routing via useOnboarding hook
│   │   │       ├── DESIGN.md           # Design system document (source of truth for visual design)
│   │   │       ├── hooks/
│   │   │       │   └── useOnboarding.ts    # State machine: multi-step form, file uploads, token validation
│   │   │       └── components/
│   │   │           ├── ProgressBar.tsx      # Fixed top progress bar (4px, NORA Green fill)
│   │   │           ├── BottomBar.tsx        # Fixed bottom CTA bar (Volver + Continuar/Enviar)
│   │   │           ├── FileUploadZone.tsx   # Upload zone: empty (dashed) → uploading (spinner) → loaded (green + preview/PDF icon)
│   │   │           ├── WelcomeScreen.tsx    # "Hola, {name}" + Comenzar CTA
│   │   │           ├── ErrorScreen.tsx      # 4 variants: expired (amber), used (red), invalid (red), missing (red)
│   │   │           ├── PersonalDataStep.tsx # DNI (7-8 digits) + CUIL (XX-XXXXXXXX-X) with inline validation
│   │   │           ├── DniPhotoStep.tsx     # Front + back DNI photo uploads
│   │   │           ├── CriminalRecordStep.tsx # Criminal record certificate upload (PDF allowed)
│   │   │           ├── ReferencesStep.tsx   # Optional textarea with "Opcional" badge
│   │   │           ├── VideoStep.tsx        # Optional video upload (MP4/MOV)
│   │   │           ├── ZonesStep.tsx        # Checkbox list of coverage zones
│   │   │           ├── SummaryStep.tsx      # 5-section summary with dividers and file previews
│   │   │           └── ConfirmationScreen.tsx # Success checkmark + "¡Listo, {name}!" message
│   │   │   └── panel/                        # Professional self-service panel (NEW)
│   │   │       ├── ProfessionalPanelPage.tsx  # Main page: session token validation, tab routing
│   │   │       └── components/
│   │   │           ├── ProfessionalLayout.tsx     # 240px sidebar (desktop) + bottom nav bar (mobile) with 6 tabs
│   │   │           ├── SessionErrorScreen.tsx     # Token invalid/expired screen with WhatsApp CTA
│   │   │           ├── ProfessionalProfile.tsx    # Status badge, excellence badge, availability, personal data, docs (read-only)
│   │   │           ├── ProfessionalPendingRequests.tsx # Pending requests: countdown, accept/reject, modal, empty state
│   │   │           ├── ProfessionalInProgress.tsx      # In-progress orders (ACCEPTED + PENDING_CONFIRMATION): coordination status, confirm visit, mark finished, view detail modal (AUT-156)
│   │   │           ├── ProfessionalOrders.tsx     # History: terminal orders (COMPLETED, NOT_FULFILLED, CANCELLED, NO_RESPONSE), stats cards, filters, search, table, pagination, rate user (AUT-156)
│   │   │           └── ProfessionalReputation.tsx # Donut chart, compliance metrics, recommendation %, tips
│   ├── index.html                      # Vite entry HTML (dev mode)
│   ├── index-landing.html               # Vite entry HTML (landing build)
│   ├── index-admin.html                 # Vite entry HTML (admin build)
│   ├── index-app.html                   # Vite entry HTML (app build)
│   ├── .env.landing                     # Env vars for landing build
│   ├── .env.admin                       # Env vars for admin build
│   ├── .env.app                         # Env vars for app build
│   ├── .env.development                 # Env vars for dev mode (npm run dev)
│   ├── package.json                    # @noraconecta/frontend (Vite + React 19 + Tailwind 4)
│   ├── tsconfig.json                   # React + TypeScript strict config
│   └── vite.config.ts                  # Vite + React + Tailwind + API proxy (supports BUILD_TARGET)
├── package.json                 # Root workspace config
├── .gitignore
├── PROJECT.md
└── README.md
```
src/
├── server.ts                  # Entry point: Express app bootstrap
├── lib/
│   └── prisma.ts              # Prisma client singleton
├── middleware/
│   ├── error-handler.ts       # Global error handler (AppError, 500 fallback)
│   ├── require-auth.ts        # JWT validation middleware
│   └── require-super-admin.ts # SUPERADMIN role guard
├── utils/
│   └── jwt.ts                 # signToken / verifyToken
├── types/
  │   └── express.d.ts           # Express Request augmentation (req.admin)
  ├── modules/
  │   ├── auth/
  │   │   ├── auth.routes.ts     # POST /auth/login
  │   │   ├── auth.controller.ts # Request validation, response formatting
  │   │   ├── auth.service.ts    # Login logic, bcrypt comparison, JWT signing
  │   │   └── auth.repository.ts # Prisma queries for Admin model
  │   ├── categories/
  │   │   ├── categories.routes.ts     # 6 endpoints under /categories
  │   │   ├── categories.controller.ts # Request validation, response formatting
  │   │   ├── categories.service.ts    # Slug generation, Levenshtein matching
  │   │   └── categories.repository.ts # Prisma queries for Category model
│   └── locations/
│       ├── locations.routes.ts     # 6 endpoints under /locations
│       ├── locations.controller.ts # Request validation, response formatting
│       ├── locations.service.ts    # Geo hierarchy business logic
│       └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
│   ├── users/
│   │   ├── users.routes.ts         # 4 endpoints under /users
│   │   ├── users.controller.ts     # Request validation, response formatting
│   │   ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock
│   │   └── users.repository.ts     # Prisma queries for User model
│   ├── professionals/
│       ├── professionals.routes.ts     # 13 endpoints under /professionals
│       ├── professionals.controller.ts # Request validation, response formatting
│       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session, panel
│       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone, panel data, orders
│       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session
│       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone
│   └── matching/
│       ├── matching.service.ts    # Scoring ponderado + filtros duros (sin endpoints)
│       └── matching.repository.ts # Prisma queries para motor de matching
├── routes/                    # (placeholder for future shared routes)
├── controllers/               # (placeholder for future shared controllers)
├── services/                  # (placeholder for future shared services)
└── repositories/              # (placeholder for future shared repositories)
```

### Layer rules

- **routes**: HTTP endpoints only, no business logic
- **controllers**: Request/response handling, input validation, delegate to services
- **services**: Business logic, orchestration of repositories
- **repositories**: Database access only (Prisma), no business logic
- **lib**: Shared clients (Prisma instance)
- **utils**: Pure helper functions
- **middleware**: Request interceptors (auth, error handling)

## Build Targets (Frontend Subdomain Configuration)

El frontend tiene tres entrypoints separados para producción, cada uno asociado a un subdominio distinto.
En desarrollo local (`npm run dev`) todo corre en `localhost:5173` con rutas separadas; la separación por subdominios es solo para producción.

| Target   | Subdominio                  | Entrypoint           | HTML Entry             | Output dir   | Descripción                          |
|---------|-----------------------------|---------------------|------------------------|-------------|--------------------------------------|
| landing | noraconecta.com.ar          | `main-landing.tsx`  | `index-landing.html`  | `dist/landing` | Landing page + simulador del bot     |
| admin   | admin.noraconecta.com.ar    | `main-admin.tsx`    | `index-admin.html`    | `dist/admin`   | Panel de administración (login + dashboard + CRUD) |
| app     | app.noraconecta.com.ar      | `main-app.tsx`      | `index-app.html`      | `dist/app`     | Onboarding (`/verify/:token`) + Panel profesional (`/panel/:sessionToken`) |

### Host-based routing en desarrollo

En `npm run dev`, `App.tsx` detecta el hostname vía `resolveHostContext()` (`lib/host.ts`) y renderiza solo las rutas del contexto correspondiente:

| Hostname                    | Contexto | Rutas activas                                    |
|----------------------------|----------|-------------------------------------------------|
| `localhost:5173`           | `all`    | Todas: `/simulator`, `/verify/:token`, `/panel/:sessionToken`, `/admin/*` |
| `admin.noraconecta.local`  | `admin`  | Solo admin (sin prefijo): `/login`, `/professionals`, `/escalations`, etc. |
| `app.noraconecta.local`    | `app`    | Onboarding + panel: `/verify/:token`, `/panel/:sessionToken`, `/` → ErrorScreen "missing" |
| `noraconecta.local`        | `landing`| Solo landing: `/` → `/simulator` |

Los subdominios `.local` requieren mapeo en `/etc/hosts`:
```
127.0.0.1 noraconecta.local www.noraconecta.local admin.noraconecta.local app.noraconecta.local
```

En el contexto `admin`, las rutas no usan el prefijo `/admin` (ej: `/login`, `/professionals`). Los componentes `AdminLayout`, `ProtectedRoute`, `LoginPage`, `ProfessionalsPage` y `ProfessionalDetailPage` usan `resolveHostContext()` o `getAdminDashboardPath()` para generar paths dinámicos según el contexto.
En el contexto `app`, la raíz `/` muestra un `ErrorScreen` con variante `missing` indicando que se necesita un enlace de verificación válido.

### Scripts de build

```json
{
  "build:admin": "BUILD_TARGET=admin vite build",
  "build:app": "BUILD_TARGET=app vite build",
  "build:landing": "BUILD_TARGET=landing vite build",
  "build:all": "npm run build:admin && npm run build:app && npm run build:landing"
}
```

La variable de entorno `BUILD_TARGET` es leída por `vite.config.ts` para:
- Seleccionar el HTML de entrada (`index-{target}.html`)
- Cargar el archivo `.env.{target}` correspondiente
- Redirigir la salida a `dist/{target}/`

### Archivos de entorno del backend

| Variable   | Default                         | Descripción                                  |
|-----------|---------------------------------|----------------------------------------------|
| `APP_URL` | `http://app.noraconecta.local`  | Base URL del frontend para links enviados por WhatsApp (verificación + panel) |

### Archivos de entorno por target (frontend)

| Archivo          | Variables                                   |
|-----------------|---------------------------------------------|
| `.env.landing`    | `VITE_WHATSAPP_NUMBER`                      |
| `.env.admin`      | `VITE_API_URL`                              |
| `.env.app`        | `VITE_API_URL`                              |
| `.env.development`| `VITE_API_URL` (cargado en `npm run dev`)   |

### Nginx en producción (referencia)

```nginx
server {
  server_name admin.noraconecta.com.ar;
  root /var/www/nora/admin;
}

server {
  server_name app.noraconecta.com.ar;
  root /var/www/nora/app;
}

server {
  server_name noraconecta.com.ar;
  root /var/www/nora/landing;
}
```

## Modules

### Auth

| Endpoint         | Método | Descripción                          | Auth requerida |
|-----------------|--------|--------------------------------------|----------------|
| `/health`        | GET    | Health check (sin auth)              | No             |
| `/auth/login`    | POST   | Login de admin (email + password)    | No             |

### Admin Dashboard (NEW)

Agrega métricas del panel de administración agregadas desde múltiples entidades.

| Endpoint                       | Método | Descripción                          | Auth requerida |
|-------------------------------|--------|--------------------------------------|----------------|
| `/admin/metrics`               | GET    | Dashboard KPIs (orders, professionals, escalations, feedback) | OPERATOR |
| `/admin/requests/auto-close`   | POST   | Trigger manual de auto-cierre de pedidos PENDING_CONFIRMATION > 24h (testing) | SUPERADMIN |

Response shape:
```json
{
  "data": {
    "orders": { "active": 15, "last24h": 3, "last7d": 42, "total": 520 },
    "acceptanceRate": 72,
    "coverageRate": 85,
    "avgAcceptanceTimeMinutes": 12,
    "professionals": { "active": 89, "pending": 18, "suspended": 4, "total": 120 },
    "escalations": { "open": 5, "total": 23 },
    "wouldRecommendPct": 94
  }
}
```

### Categories

| Endpoint                   | Método | Descripción                          | Rol mínimo |
|---------------------------|--------|--------------------------------------|-----------|
| `/categories`             | GET    | Lista todas las categorías           | OPERATOR  |
| `/categories/active`      | GET    | Solo categorías activas              | OPERATOR  |
| `/categories/:id`         | GET    | Detalle de categoría                 | OPERATOR  |
| `/categories`             | POST   | Crear categoría (slug autogenerado)  | SUPERADMIN|
| `/categories/:id`         | PATCH  | Editar nombre o descripción          | SUPERADMIN|
| `/categories/:id/toggle`  | PATCH  | Habilitar / deshabilitar categoría   | SUPERADMIN|

### Locations

| Endpoint                       | Método | Descripción                                  | Rol mínimo |
|-------------------------------|--------|----------------------------------------------|-----------|
| `/locations/countries`        | GET    | Lista países disponibles                     | OPERATOR  |
| `/locations/tree/:countryId`  | GET    | Árbol completo de nodos de un país           | OPERATOR  |
| `/locations/leaf-nodes`       | GET    | Solo nodos hoja activos (para matching)      | OPERATOR  |
| `/locations/countries`        | POST   | Crear país + definir niveles                 | SUPERADMIN|
| `/locations/nodes`            | POST   | Crear nodo en cualquier nivel                | SUPERADMIN|
| `/locations/nodes/:id/toggle` | PATCH  | Habilitar / deshabilitar nodo                | SUPERADMIN|
| `/locations/nodes/:id`       | PATCH  | Actualizar nombre del nodo                   | SUPERADMIN|

### Users

| Endpoint               | Método | Descripción                          | Rol mínimo |
|------------------------|--------|--------------------------------------|-----------|
| `/users`               | GET    | Lista paginada de usuarios           | OPERATOR  |
| `/users/:id`           | GET    | Detalle de usuario                   | OPERATOR  |
| `/users/:id/block`     | PATCH  | Bloquear usuario                     | SUPERADMIN|
| `/users/:id/unblock`   | PATCH  | Desbloquear usuario                  | SUPERADMIN|

### Professionals

| Endpoint                               | Método | Descripción                                    | Rol mínimo |
|----------------------------------------|--------|-------------------------------------------------|-----------|
| `/professionals/register`             | POST   | Etapa 1: crear profesional desde bot            | Sin auth  |
| `/professionals/verify/:token`         | GET    | Verificar validez del token y obtener nombre + zonas del profesional | Sin auth  |
| `/professionals/verify/:token`         | POST   | Etapa 2: subir documentación                    | Sin auth  |
| `/professionals/session/:token`        | GET    | Recuperar sesión de profesional por token       | Sin auth  |
| `/professionals/session/:token/panel`  | GET    | Datos consolidados del panel (perfil + membresía + reputación) | Sin auth |
| `/professionals/session/:token/orders` | GET    | Historial de pedidos del profesional (paginado, sin datos del usuario) | Sin auth |
| `/professionals/session/:token/pending-requests` | GET | Pedidos ASSIGNED sin responder: rubro, zona, descripción, tiempo restante | Sin auth |
| `/professionals`                       | GET    | Lista paginada de profesionales (filtros: status, categoryId) | OPERATOR  |
| `/professionals/:id`                   | GET    | Detalle de profesional                          | OPERATOR  |
| `/professionals/:id/approve`           | POST   | Aprobar profesional (UNDER_REVIEW → ACTIVE)     | SUPERADMIN|
| `/professionals/:id/reject`            | POST   | Rechazar profesional (UNDER_REVIEW → REJECTED)  | SUPERADMIN|
| `/professionals/:id/suspend`           | POST   | Suspender profesional                           | SUPERADMIN|
| `/professionals/:id/reactivate`        | POST   | Reactivar profesional (SUSPENDED → ACTIVE)      | SUPERADMIN|
| `/professionals/:id/badge`             | PATCH  | Asignar o remover insignia de reputación        | SUPERADMIN|
| `/professionals/:id/generate-session`  | POST   | Generar token de sesión + panelUrl para portal profesional | SUPERADMIN|

### Plans

| Endpoint         | Método | Descripción                      | Rol mínimo |
|-----------------|--------|----------------------------------|-----------|
| `/plans`        | GET    | Lista todos los planes           | OPERATOR  |
| `/plans`        | POST   | Crear plan (nombre + precio)     | SUPERADMIN|
| `/plans/:id`    | PATCH  | Editar precio o % descuento anual| SUPERADMIN|

### Memberships

| Endpoint                                  | Método | Descripción                          | Rol mínimo |
|------------------------------------------|--------|--------------------------------------|-----------|
| `/professionals/:id/membership`          | GET    | Estado actual de membresía + trial   | OPERATOR  |
| `/professionals/:id/membership`          | POST   | Activar membresía manualmente        | SUPERADMIN|

### Reputation

Servicio interno, invocado por el módulo de Pedidos, Profesionales y los endpoints de calificación.

| Método                     | Descripción                                                     |
|---------------------------|-----------------------------------------------------------------|
| `applyPenalization()`     | Cuenta NOT_FULFILLED, aplica OBSERVATION o SUSPENDED             |
| `evaluateBadge()`         | Otorga badge si cumplimiento 100% y completados ≥ umbral         |
| `removeBadgeIfActive()`   | Remueve badge al recibir NOT_FULFILLED                          |
| `getReputationBreakdown()`| Calcula promedios on-the-fly desde feedbacks: rating, puntualidad, calidad, comunicación, precio justo, % recomendación |

| Método                  | Descripción                                         |
|-------------------------|-----------------------------------------------------|
| `applyPenalization()`   | Cuenta NOT_FULFILLED, aplica OBSERVATION o SUSPENDED |
| `evaluateBadge()`       | Otorga badge si cumplimiento 100% y completados ≥ umbral |
| `removeBadgeIfActive()` | Remueve badge al recibir NOT_FULFILLED              |

**Lógica de penalizaciones:**
- 1er NOT_FULFILLED → status OBSERVATION (sigue en pool de matching)
- 2do+ NOT_FULFILLED → status SUSPENDED (sale del pool) + alerta `PROFESSIONAL_AUTO_SUSPENDED`
- Ejecutado en la misma transacción que el evento NOT_FULFILLED
- El historial de eventos nunca se borra

**Badge automático:**
- Otorgar: count(NOT_FULFILLED) = 0 AND count(COMPLETED) ≥ `BADGE_MIN_COMPLETED_REQUESTS` (default: 10)
- Quitar: al recibir NOT_FULFILLED con badge activo → `hasBadge = false`
- Evaluado en cada COMPLETED (confirmación y auto-complete)

**Matching (actualizado):**
- `findEligibleProfessionals` ahora incluye status ACTIVE y OBSERVATION
- SUSPENDED queda fuera del pool

### Storage

| Endpoint                      | Método | Descripción                                                    | Auth      |
|------------------------------|--------|-----------------------------------------------------------------|-----------|
| `/storage/presign-upload`    | POST   | Genera URL pre-firmada para upload directo a Cloudflare R2      | Sin auth  |

**Validaciones de contentType por folder:**
- `request-photos`: `image/jpeg`, `image/png`, `image/webp`
- `request-audio`: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/webm;codecs=opus`
- `verification`: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/quicktime`

**Lógica de negocio:**
- El backend nunca recibe el contenido binario de los archivos
- El filename original se reemplaza por UUID internamente preservando la extensión
- La URL pre-firmada permite subir directo a R2 con PUT por el tiempo configurado (default: 3600s)

### Escalations

| Endpoint                   | Método | Descripción                          | Rol mínimo |
|---------------------------|--------|--------------------------------------|-----------|
| `/escalations`            | GET    | Lista paginada (filtros: status, professionalId) | OPERATOR  |
| `/escalations/:id`        | GET    | Detalle con request y usuario        | OPERATOR  |
| `/escalations/:id/status` | PATCH  | Cambiar status (OPEN→IN_REVIEW→RESOLVED) | OPERATOR  |
| `/escalations/:id/resolve`| PATCH  | Cerrar con resolución                | OPERATOR  |

**Transiciones de estado válidas:**
- OPEN → IN_REVIEW, RESOLVED
- IN_REVIEW → RESOLVED
- RESOLVED → (ninguna)

**Lógica de negocio:**
- Creada automáticamente al reportar incumplimiento (`reportNoncompliance`) en la misma transacción
- Dispara alerta `ESCALATION_CREATED`
- `resolve` requiere texto de resolución no vacío
- `resolvedBy` registra el adminId del operador que resuelve

### Bot

Módulo de conversación del bot de NORA. Agnóstico al canal de transporte (web o WhatsApp). Recibe mensajes de texto, imagen, audio y ubicación con un `phone` y un `role`, y retorna la respuesta que debe enviarse. El estado persiste en `BotSession`.

| Endpoint               | Método | Descripción                                          | Auth      |
|-----------------------|--------|------------------------------------------------------|-----------|
| `/bot/message`         | POST   | Procesa un mensaje entrante y retorna la respuesta    | Sin auth  |
| `/bot/session/reset`   | POST   | Resetea la sesión de un teléfono (para testing)       | Sin auth  |

**Arquitectura interna:**
```
POST /bot/message
  → BotController
  → BotService.processMessage(phone, message)
    → UsersService.findOrCreateByPhone(phone)  // garantiza User en DB
    → BotRepository.findByPhone(phone)
    → detectar pendingMessage (notificación proactiva de coordinación)
    → determinar rol (USER / PROFESSIONAL)
    → despachar al FlowHandler correspondiente
    → FlowHandler ejecuta el paso actual
    → procesar pendingNotification (notificar al otro participante)
    → actualiza sesión
    → retorna { text, mediaUrls?, options?, flow?, step?, requestId? }
```

**Mensajería proactiva (pending notification):**
- `BotSession.tempData` puede contener `pendingMessage`: un mensaje que NORA necesita entregar proactivamente
- Cuando el usuario envía cualquier mensaje, si hay `pendingMessage`, se entrega primero y se limpia
- Los flujos de coordinación generan `pendingNotification` en `tempData` para notificar al otro participante:
  ```ts
  { targetPhone, targetRole, message, flow, step, tempData }
  ```
- `BotService` procesa la notificación: crea/actualiza la sesión del destinatario con el `pendingMessage`
- `CoordinationService.notifyWorkFinished(requestId)`: invocado por `POST /requests/:id/finish`, envía pendingMessage al usuario con el mensaje de confirmación de cierre y limpia el flujo de coordinación de su sesión (AUT-158)

**Soporte de ubicación (WhatsApp location):**
- `POST /bot/message` acepta campo `location: { latitude, longitude }` en el body
- Si el proveedor no soporta reenvío de mensajes `location`, se genera un link de Google Maps: `https://maps.google.com/?q={lat},{lng}`

**Flujos implementados:**

| Flow                    | Estados                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `USER_REQUEST`         | INIT → ASK_NAME → ASK_SERVICE → ASK_ZONE → ASK_DESCRIPTION → ASK_PHOTOS → ASK_AUDIO → CONFIRM → SEARCHING |
| `PROFESSIONAL_REGISTER`| ASK_NAME → ASK_SERVICE → ASK_ZONES → ASK_AVAILABILITY → SEND_LINK     |
| `COORDINATION`         | AWAITING_AVAILABILITY → AWAITING_CONFIRMATION → AWAITING_LOCATION → SCHEDULED |

**Lógica de paso ASK_AUDIO (AUT-155):** Cuando el usuario envía un mensaje de tipo `audio`, el bot lo guarda en `tempData.audioUrl` y avanza directamente a `CONFIRM`. Si el usuario escribe "listo" o cualquier otro texto sin audio, también avanza a `CONFIRM`. Solo repite la pregunta si el mensaje está vacío y no contiene audio.

**Lógica de flujo PROFESSIONAL_REGISTER:**
- `ASK_NAME`: ignora el contenido del primer mensaje, siempre pregunta el nombre. Usa flag `_nameAsked` en tempData para detectar si ya preguntó.
- `ASK_SERVICE`: resuelve el oficio vía NLP (exacto + Levenshtein).
- `ASK_ZONES`: divide el input por coma, "y" y "e", resuelve cada zona por separado, registra múltiples zoneIds en tempData.
- `ASK_AVAILABILITY`: recolecta disponibilidad, luego llama a `ProfessionalsService.register()` que genera UUID v4 real como `verificationToken` (expira 72h), crea el registro en DB, asocia las zonas vía `ProfessionalsRepository.addZone()`, actualiza `availability`, y retorna la URL de verificación con el token real.

**NLP (nlp.service.ts):**
- `resolveCategory(text)`: búsqueda exacta por nombre/slug, luego Levenshtein con max distance 3 como fallback
- `resolveZone(text)`: ídem para GeoNode
- Retorna `{ match, confidence: 'exact' | 'fuzzy' | 'none' }`

**Simulador web (frontend):**
- Interfaz React + Tailwind en `frontend/src/pages/SimulatorPage.tsx`
- Input de texto libre para ingresar cualquier numero de telefono + toggle de rol (Usuario / Profesional)
- Burbujas de chat diferenciadas: usuario (emerald, derecha), NORA (slate, izquierda)
- Indicador de estado de sesión (flujo + paso actual)
- Estados: vacío, carga (typing indicator con dots animados), conversación activa
- Diseño responsive: single-column centrado, 720px max-width en desktop, full-width en mobile
- Botón de imagen: file picker con filtro `image/jpeg,png,webp` (máx 3), upload directo a R2 vía presign, preview con miniaturas antes del envío
- Botón de audio: grabación con Web Audio API (MediaRecorder), upload a R2 vía presign, indicador visual de grabación activa (pulsing dot), preview "Audio listo" antes del envío
- Mensajes con media: render de thumbnails (grid 1 o 2 columnas) y reproductor de audio inline con play/pause
- Polling de estado del pedido: cuando se crea un pedido y el bot retorna `requestId`, el simulador inicia polling cada 5s a `GET /requests/:id` y muestra mensajes automáticos de cambio de estado en el chat. Antes del primer poll, se inicializan los refs de estado con los valores actuales del pedido para evitar mensajes duplicados (AUT-158). Detecta tanto cambios de `status` como de `coordinationStatus`:
  - `PENDING_CONFIRMATION` → opciones "conforme" / "con observaciones" / "no conforme"
  - `coordinationStatus = AWAITING_LOCATION` → "{nombre} ya confirmó el horario. Respondé con tu dirección..."
  - `coordinationStatus = SCHEDULED` → "¡Todo listo! La visita quedó coordinada..."
  - `ASSIGNED` → "Encontramos un profesional..."
  - `ACCEPTED` + `coordinationStatus = AWAITING_AVAILABILITY` → "¡Buenas noticias! {nombre} aceptó tu pedido..."
  - `NO_RESPONSE` → "No encontramos profesionales disponibles..."
  - `CANCELLED` → "El pedido fue cancelado."
  - El teléfono del profesional NUNCA se muestra al usuario en el simulador
  - **Ubicación simulada (AUT-152)**: Cuando NORA pide compartir ubicación desde WhatsApp, aparece un botón "📍 Compartir ubicación (simulada)" en la barra de herramientas del chat. Envía coordenadas hardcodeadas de Mendoza (`-32.8908, -68.8272`) como `location` en el body de `POST /bot/message`. Exclusivo para testing en desarrollo.
  - Se detiene al llegar a estado final (CANCELLED, COMPLETED, NOT_FULFILLED, NO_RESPONSE)

### Config (actualizado)

| Key                            | Default | Descripción                              |
|-------------------------------|---------|------------------------------------------|
| `BADGE_MIN_COMPLETED_REQUESTS` | 10     | Mínimo de pedidos completados para badge |

| Endpoint         | Método | Descripción                      | Rol mínimo |
|-----------------|--------|----------------------------------|-----------|
| `/config`       | GET    | Ver toda la configuración        | SUPERADMIN|
| `/config/:key`  | PATCH  | Actualizar un parámetro          | SUPERADMIN|

### Matching

Servicio interno sin endpoints REST. Invocado por el módulo de Pedidos.

| Método                  | Descripción                                         |
|-------------------------|-----------------------------------------------------|
| `findBestCandidate()`   | Encuentra el mejor profesional para categoría + zona |
| `calculateScore()`      | Calcula el score individual de un profesional       |

**Filtros duros**: status ACTIVE, zona coincidente, categoría coincidente, `canReceiveRequests = true`, máximo 2 pedidos activos, no rechazó el pedido actual.

**Scoring** (calculado en tiempo real, no almacenado): Cumplimiento (50%) + TasaRespuesta (30%) + Recomendación (10%) + Distribución (10%). Parámetros configurables vía `SystemConfig` con defaults.

**Desempate por plan**: Cuando dos profesionales tienen score similar (diferencia < 5 puntos), el de mayor `plan.priority` gana la posición. Premium (3) > Profesional (2) > Básico (1). Si no tiene membresía activa, se trata como priority=1.

**Logs de diagnóstico**: `applyHardFilters()` loguea cada profesional excluido con su motivo (cannot receive requests con membership/trialUsed/limit, o max active requests alcanzado). `findEligibleProfessionals()` loguea los resultados crudos de la query y los filtros aplicados.

### Requests

| Endpoint                               | Método | Descripción                                    | Auth      |
|----------------------------------------|--------|------------------------------------------------|-----------|
| `/requests`                            | POST   | Crear pedido (bot: phone + category + zone)    | Sin auth  |
| `/requests/:id/accept`                 | POST   | Profesional acepta pedido asignado             | Sin auth  |
| `/requests/:id/reject`                 | POST   | Profesional rechaza pedido → reasigna          | Sin auth  |
| `/requests/:id/cancel`                 | POST   | Usuario cancela pedido                         | Sin auth  |
| `/requests/:id/mark-completed`         | POST   | Profesional marca trabajo como completado      | Sin auth  |
| `/requests/:id/finish`                 | POST   | Profesional finaliza pedido (ACCEPTED → PENDING_CONFIRMATION). Notifica al usuario vía pendingMessage. | Sin auth  |
| `/requests/:id/confirm`                | POST   | Usuario confirma satisfacción (SATISFIED/PARTIAL/UNSATISFIED) | Sin auth  |
| `/requests/:id/dispute`                | POST   | Usuario disputa pedido (→ NOT_FULFILLED + Escalation) | Sin auth  |
| `/requests/:id/confirm-completion`     | POST   | Usuario confirma (Sí/No) el trabajo (legacy)   | Sin auth  |
| `/requests/:id/report-noncompliance`   | POST   | Usuario reporta incumplimiento                 | Sin auth  |
| `/requests/:id/submit-feedback`        | POST   | Usuario envía feedback del trabajo             | Sin auth  |
| `/requests/:id/rate-professional`     | POST   | Usuario califica al profesional (7 ejes)       | Sin auth  |
| `/requests/:id/rate-user`             | POST   | Profesional califica al usuario (4 ejes)       | Sin auth  |
| `/requests/:id/confirm-visit`         | POST   | Profesional confirma horario de visita (desde panel) | Sin auth  |
| `/requests`                            | GET    | Lista paginada de pedidos                      | OPERATOR  |
| `/requests/:id`                        | GET    | Detalle de pedido con eventos, feedback, profesional asignado (incluye teléfono cuando está ACCEPTED) y datos de coordinación | Sin auth (polling simulador) |

**GET /requests/:id (polling simulador):** El endpoint incluye datos relacionados para el polling de estado:
- `assignedProfessional` → `{ name, phone }` del profesional (phone incluido para mostrar datos de contacto al usuario cuando el pedido es ACCEPTED)
- `events` → historial de eventos
- `feedback` → feedback del usuario
- `coordination` → (solo si `coordinationStatus !== 'SCHEDULED'`) `{ status, scheduledAt, clientAddress, hasLocation }` para que el frontend muestre el estado de coordinación

**GET /requests (admin):** El endpoint incluye datos relacionados (`include`) para poblar la tabla de pedidos:
- `user` → nombre del cliente
- `category` → nombre del servicio
- `assignedProfessional` → nombre del profesional (puede ser null si no está asignado)
- `events` → historial de eventos
- `feedback` → feedback del usuario

**Flujo de estados:**
```
CREATED → [matching] → ASSIGNED → [acepta] → ACCEPTED
                                → [rechaza/timeout] → [reasigna] → ASSIGNED (loop)
                                                    → [sin candidatos] → NO_RESPONSE
CREATED/ASSIGNED → [usuario cancela] → CANCELLED
ACCEPTED → [profesional marca completo] → PENDING_CONFIRMATION → [usuario confirma Sí] → COMPLETED → [feedback]
                                                                   → [usuario confirma No] → NOT_FULFILLED
         → [usuario reporta incumplimiento] → NOT_FULFILLED
ACCEPTED → [auto-complete 24h sin confirmación] → COMPLETED
```

**Lógica de negocio:**
- Crear: validar usuario sin pedido activo (409 si ya tiene) → crea en CREATED → matching → si encuentra candidato transiciona a ASSIGNED con `assignmentTimeoutAt`. Si no encuentra, permanece en CREATED con `assignmentTimeoutAt` para que el cron reintente.
- Aceptar: incrementar `trialRequestsUsed` si no tiene membresía activa
- Rechazar: registrar evento REJECTED → reasignar excluyendo todos los rejectores anteriores
- Timeout: ASSIGNED con `assignmentTimeoutAt < now()` → NO_RESPONSE para el profesional actual → reasignar. CREATED con `assignmentTimeoutAt < now()` → reintenta matching → si falla → NO_RESPONSE
- Cancelación: solo permitida en CREATED o ASSIGNED
- Finalización (finish): profesional cambia estado ACCEPTED → PENDING_CONFIRMATION + registra `completedAt` + evento PENDING_CONFIRMATION. Envía pendingMessage al usuario con "El profesional {nombre} indicó que finalizó el trabajo. ¿Cómo quedó? (Conforme / Con observaciones / No conforme)" y limpia el flujo de coordinación de la sesión del usuario (AUT-158).
- Confirmación (confirm): usuario envía satisfaction (SATISFIED/PARTIAL/UNSATISFIED)
  - SATISFIED/PARTIAL → COMPLETED + evento COMPLETED + evaluateBadge
  - UNSATISFIED → NOT_FULFILLED + crea Escalation + evento NOT_FULFILLED + applyPenalization + removeBadgeIfActive
- Disputa (dispute): alias de confirm con UNSATISFIED
- Confirm-completion (legacy): usuario confirma Sí/No → COMPLETED o NOT_FULFILLED
- Auto-complete: 24h después de `updatedAt` en PENDING_CONFIRMATION sin confirmación → COMPLETED automático con metadata `{ autoClosedAt, reason: "timeout_user_confirmation" }`. No dispara flujo de calificación.
- Todos los cambios de estado registran su `RequestEvent`
- Jobs (sin endpoints): `processTimeouts()` (cada 15 min), `autoClosePendingConfirmations()` (cada hora) invocados por cron en `server.ts`
- El estado PENDING_CONFIRMATION se considera activo (el usuario no puede crear otro pedido mientras esté en este estado)

**Config keys usadas:**
- `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2)
- `AUTO_COMPLETE_HOURS` (default: 24)
- `TRIAL_REQUESTS_LIMIT` (default: 3)

### Professional Panel (NEW)

Portal de autogestión para profesionales. Acceso exclusivo vía magic link (`app.noraconecta.com.ar/panel/:sessionToken`), sin login con credenciales. El sessionToken (UUID, 30 días de validez) se genera desde el panel admin.

**Arquitectura frontend:**
- Desktop: sidebar fijo 240px con 6 tabs (Perfil, Pedidos pendientes, En curso, Historial, Membresía, Reputación) (AUT-156)
- Mobile: bottom navigation bar con los mismos 6 tabs
- Sin header; diseño light mode con NORA Green #0B6E4F, DM Sans, JetBrains Mono para números
- Mismo design system que AUT-131/132 (assets/9140616588152080241)

**Tabs:**

| Tab | Componente | Descripción |
|---|---|---|
| Perfil | `ProfessionalProfile` | Estado con badge (Activo/Suspendido/En observación), badge Excelencia NORA, disponibilidad en chips, datos personales, docs R2 (solo lectura) |
| Pedidos pendientes | `ProfessionalPendingRequests` | Lista de pedidos ASSIGNED sin responder, con indicador de tiempo restante, botones Aceptar/Rechazar y modal de confirmación. Sección temporal para testing del flujo de asignación (reemplazable por WhatsApp en AUT-134) |
| En curso | `ProfessionalInProgress` | Pedidos aceptados y en proceso de coordinación (ACCEPTED + PENDING_CONFIRMATION). Muestra estado de coordinación (AWAITING_AVAILABILITY, AWAITING_CONFIRMATION, AWAITING_LOCATION, SCHEDULED) con etiquetas descriptivas ("Coordinando visita", "Esperando ubicación", "Visita coordinada · jueves 8/5 a las 17:00hs"). Stats cards (total, aceptados, esperando confirmación), búsqueda, tabla con acciones (Confirmar visita, Ver detalle con modal ampliado, Marcar finalizado) |
| Historial | `ProfessionalOrders` | Pedidos en estados terminales (COMPLETED, NOT_FULFILLED, CANCELLED, NO_RESPONSE). Stats cards, filtros por status (chips + búsqueda), tabla con fecha/rubro/zona/estado. Pedidos COMPLETED sin calificar: botón "Calificar". Paginación + empty state |
| Membresía | `ProfessionalMembership` | Plan activo (nombre, tipo mensual/anual, fechas, beneficios, precio). Trial: barra de progreso "X de 5 pedidos gratuitos". Expirado: instrucciones + alias de pago + botón WhatsApp |
| Reputación | `ProfessionalReputation` | Donut chart con score de cumplimiento (%), breakdown completados/rechazados/no cumplidos, % recomendación, tasa de aceptación, tiempo de respuesta, consejos |

**Endpoints del panel (sin auth, protegidos por sessionToken):**

| Endpoint | Método | Descripción |
|---|---|---|
| `/professionals/session/:token/panel` | GET | Datos consolidados: perfil, membresía, reputación |
| `/professionals/session/:token/orders` | GET | Historial de pedidos paginado: incluye datos del cliente (nombre, teléfono), descripción, rubro, zona, estado, campos de coordinación (coordinationStatus, clientAddress, clientLatitude, clientLongitude, scheduledAt), photoUrls, audioUrl, flags de calificación |
| `/professionals/session/:token/pending-requests` | GET | Pedidos ASSIGNED sin responder: rubro, zona, descripción, tiempo restante |

**Response shape `GET /session/:token/panel` (ACTUALIZADO AUT-142):**
```json
{
  "data": {
    "professional": { "id", "name", "phone", "status", "category", "zones", "availability", "hasBadge", "dniFrontUrl", "dniBackUrl", "criminalRecordUrl", "cuil", "references", "presentationVideoUrl" },
    "membership": { "activeMembership": { "plan", "type", "status", "startDate", "endDate" } | null, "trialRequestsUsed": 0, "trialRequestsLimit": 5 },
    "reputation": {
      "complianceScore": 87,
      "completedRequests": 32,
      "rejectedRequests": 5,
      "notFulfilledRequests": 2,
      "totalRequests": 47,
      "wouldRecommendPct": 92,
      "averageRating": 4.2,
      "averagePunctuality": 4.1,
      "averageQuality": 4.5,
      "averageCommunication": 4.3,
      "averagePriceFairness": 4.0,
      "totalRated": 20
    }
  }
}
```

**Response shape `GET /session/:token/orders` (ACTUALIZADO AUT-154):**
```json
{
  "data": [{
    "id", "createdAt", "status", "description", "userName", "userPhone",
    "category": { "name" }, "geoNode": { "name" },
    "ratedByProfessional": false, "ratedByUser": true,
    "coordinationStatus": "SCHEDULED", "clientAddress": "Calle 123",
    "clientLatitude": -32.89, "clientLongitude": -68.84,
    "scheduledAt": "2026-05-06T14:00:00.000Z",
    "photoUrls": ["https://r2.example.com/uuid.jpg"],
    "audioUrl": null
  }],
  "pagination": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

**Response shape `GET /session/:token/pending-requests` (ACTUALIZADO AUT-155):**
```json
{
  "data": [
    {
      "id": "cuid",
      "category": { "id": "cuid", "name": "Plomería" },
      "geoNode": { "id": "cuid", "name": "Maipú" },
      "description": "Se rompió un caño en el baño",
      "createdAt": "2026-05-03T12:00:00.000Z",
      "assignmentTimeoutAt": "2026-05-03T15:00:00.000Z",
      "userName": "Carlos López",
      "photoUrls": ["https://r2.example.com/uuid1.jpg", "https://r2.example.com/uuid2.jpg"],
      "audioUrl": "https://r2.example.com/uuid-audio.webm"
    }
  ]
}
```

**generateSession response (ACTUALIZADO):**
```json
{
  "data": {
    "professional": { ... },
    "sessionToken": "uuid-v4",
    "panelUrl": "http://app.noraconecta.local/panel/uuid-v4"
  }
}
```

`panelUrl` usa la variable de entorno `APP_URL` (default: `http://app.noraconecta.local`). En producción: `https://app.noraconecta.com.ar/panel/:sessionToken`.

### Pedidos pendientes del profesional (AUT-140)

Sección temporal para testing del flujo de asignación. El profesional ve los pedidos en estado `ASSIGNED` donde figura como `assignedProfessionalId`, con indicador del tiempo restante antes del timeout (configurable vía `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS`).

- **Aceptar** (POST `/requests/:id/accept`): cambia estado a `ACCEPTED`, incrementa `trialRequestsUsed` si no tiene membresía ACTIVA
- **Rechazar** (POST `/requests/:id/reject`): registra evento REJECTED, el motor reasigna excluyendo al rejector
- **Modal de confirmación**: antes de aceptar o rechazar, muestra confirmación con el nombre del usuario y datos del pedido (AUT-155)
- **Multimedia en card**: la card muestra miniaturas de fotos clickeables (lightbox) y reproductor de audio inline si existen `photoUrls` o `audioUrl` (AUT-155)
- **Empty state**: "No tenés pedidos pendientes por responder" cuando no hay pedidos ASSIGNED
- Esta sección se reemplazará por notificaciones WhatsApp en AUT-134

**Response shape `GET /session/:token/pending-requests` (ACTUALIZADO AUT-155):**
```json
{
  "data": [
    {
      "id": "cuid",
      "category": { "id": "cuid", "name": "Plomería" },
      "geoNode": { "id": "cuid", "name": "Maipú" },
      "description": "Se rompió un caño en el baño",
      "createdAt": "2026-05-03T12:00:00.000Z",
      "assignmentTimeoutAt": "2026-05-03T15:00:00.000Z",
      "userName": "Carlos López",
      "photoUrls": ["https://r2.example.com/uuid1.jpg"],
      "audioUrl": null
    }
  ]
}
```

**Flujo de acceso:**
1. Admin genera sesión desde `ProfessionalDetailPage` → botón "Generar enlace de acceso"
2. Admin copia `panelUrl` y la envía al profesional por WhatsApp
3. Profesional abre el enlace → `ProfessionalPanelPage` valida el token
4. Si es inválido/expirado → `SessionErrorScreen` con instrucción de WhatsApp
5. Si es válido → `ProfessionalLayout` con los 4 tabs

**Diseño Stitch:** Pantallas generadas en proyecto `projects/1505486100227666482`, screenshots en `.stitch/professional/`.

### Roles
- `SUPERADMIN`: acceso total
- `OPERATOR`: acceso limitado (futuro)

#### JWT Payload
```ts
{
  adminId: string;
  email: string;
  role: 'SUPERADMIN' | 'OPERATOR';
}
```

## Schema (Prisma)

### Admin
| Columna      | Tipo     | Descripción                    |
|-------------|----------|--------------------------------|
| id          | UUID     | PK, autogenerado               |
| email       | String   | Único, identificador de login  |
| passwordHash| String   | Hash bcrypt (10 rounds)        |
| name        | String   | Nombre visible del admin       |
| role        | Enum     | SUPERADMIN \| OPERATOR        |
| createdAt   | DateTime | Autogenerado                   |
| updatedAt   | DateTime | Autogenerado (on update)       |

### GeoLevel
| Columna   | Tipo     | Descripción                                    |
|----------|----------|------------------------------------------------|
| id       | CUID     | PK, autogenerado                               |
| countryId| CUID     | FK a GeoNode (nodo raíz del país)              |
| level    | Int      | Número de nivel dentro del país (1, 2, ...)    |
| name     | String   | Nombre del nivel ("Provincia", "Departamento") |
| createdAt| DateTime | Autogenerado                                   |
| updatedAt| DateTime | Autogenerado (on update)                       |

- Unique constraint: `(countryId, level)`

### GeoNode
| Columna   | Tipo     | Descripción                                     |
|----------|----------|-------------------------------------------------|
| id       | CUID     | PK, autogenerado                                |
| name     | String   | Nombre del nodo ("Mendoza", "Maipú")            |
| levelId  | CUID?    | FK a GeoLevel (null para países)                |
| parentId | CUID?    | FK a GeoNode padre (null para países)           |
| isActive | Boolean  | Habilitado para matching (default: true)        |
| createdAt| DateTime | Autogenerado                                    |
| updatedAt| DateTime | Autogenerado (on update)                        |

- Self-referencing relation: `parent` / `children` (GeoTree)
- Países son nodos raíz: `parentId = null`, `levelId = null`
- Relaciones: `professionalZones` → ProfessionalZone[], `requests` → Request[]

### Category
| Columna    | Tipo     | Descripción                     |
|-----------|----------|---------------------------------|
| id        | CUID     | PK, autogenerado                |
| name      | String   | Único, nombre de la categoría   |
| slug      | String   | Único, slug para URLs           |
| description| String? | Descripción opcional            |
| isActive  | Boolean  | Habilitado (default: true)      |
| createdAt | DateTime | Autogenerado                    |
| updatedAt | DateTime | Autogenerado (on update)        |

- Relaciones: `professionals` → Professional[], `requests` → Request[]

### User
| Columna   | Tipo     | Descripción                     |
|----------|----------|---------------------------------|
| id       | CUID     | PK, autogenerado                |
| phone    | String   | Único, identificador del usuario|
| name     | String   | Nombre del usuario              |
| status   | Enum     | ACTIVE \| BLOCKED               |
| createdAt| DateTime | Autogenerado                    |
| updatedAt| DateTime | Autogenerado (on update)        |

- Relaciones: `requests` → Request[], `escalations` → Escalation[]

### Professional
| Columna               | Tipo     | Descripción                             |
|----------------------|----------|-----------------------------------------|
| id                   | CUID     | PK, autogenerado                        |
| phone                | String   | Único                                   |
| name                 | String   | Nombre visible                          |
| status               | Enum     | PENDING \| UNDER_REVIEW \| ACTIVE \| OBSERVATION \| SUSPENDED \| PAUSED \| REJECTED |
| categoryId           | CUID     | FK a Category                           |
| availability         | String?  | Disponibilidad (texto libre)            |
| verificationToken    | String   | Único, token de verificación WhatsApp   |
| verificationTokenExp | DateTime | Expiración del token                    |
| verificationTokenUsed| Boolean  | Token ya usado (default: false)         |
| sessionToken         | String?  | Único, token de sesión activa           |
| sessionTokenExp      | DateTime?| Expiración del token de sesión          |
| dniNumber            | String?  | Número de DNI                           |
| dniFrontUrl          | String?  | URL Cloudflare R2: frente DNI           |
| dniBackUrl           | String?  | URL Cloudflare R2: dorso DNI            |
| cuil                 | String?  | CUIL del profesional                    |
| criminalRecordUrl    | String?  | URL Cloudflare R2: antecedentes penales |
| references           | String?  | Referencias laborales                   |
| presentationVideoUrl | String?  | URL Cloudflare R2: video presentación   |
| hasBadge             | Boolean  | Insignia de reputación (default: false) |
| trialRequestsUsed    | Int      | Pedidos de prueba usados (default: 0)   |
| lastAssignedAt       | DateTime?| Última asignación de pedido             |
| createdAt            | DateTime | Autogenerado                            |
| updatedAt            | DateTime | Autogenerado (on update)                |

- Relaciones: `zones` → ProfessionalZone[], `memberships` → Membership[], `requests` → Request[] (@relation "AssignedProfessional"), `events` → RequestEvent[]

### ProfessionalZone
| Columna        | Tipo     | Descripción                     |
|---------------|----------|---------------------------------|
| id            | CUID     | PK, autogenerado                |
| professionalId| CUID     | FK a Professional               |
| geoNodeId     | CUID     | FK a GeoNode                    |
| createdAt     | DateTime | Autogenerado                    |

- Unique constraint: `(professionalId, geoNodeId)`

### Plan
| Columna           | Tipo     | Descripción                          |
|------------------|----------|--------------------------------------|
| id               | CUID     | PK, autogenerado                     |
| name             | String   | Único, nombre del plan               |
| monthlyPrice     | Float    | Precio mensual                       |
| annualDiscountPct| Float    | % descuento plan anual               |
| priority         | Int      | Prioridad del plan (1=Básico, 2=Profesional, 3=Premium, default: 1) |
| isActive         | Boolean  | Plan activo (default: true)          |
| createdAt        | DateTime | Autogenerado                         |
| updatedAt        | DateTime | Autogenerado (on update)             |

- Relaciones: `memberships` → Membership[]

### Membership
| Columna        | Tipo     | Descripción                                |
|---------------|----------|--------------------------------------------|
| id            | CUID     | PK, autogenerado                           |
| professionalId| CUID     | FK a Professional                          |
| planId        | CUID     | FK a Plan                                  |
| type          | Enum     | MONTHLY \| ANNUAL                          |
| status        | Enum     | ACTIVE \| INACTIVE \| EXPIRED              |
| startDate     | DateTime | Fecha de inicio                            |
| endDate       | DateTime | Fecha de fin                               |
| paymentRef    | String?  | Referencia de pago                         |
| activatedBy   | String?  | Admin que activó la membresía              |
| createdAt     | DateTime | Autogenerado                               |
| updatedAt     | DateTime | Autogenerado (on update)                   |

### SystemConfig
| Columna   | Tipo     | Descripción                     |
|----------|----------|---------------------------------|
| key      | String   | PK, clave de configuración      |
| value    | String   | Valor (string)                  |
| updatedAt| DateTime | Autogenerado (on update)        |

### Request
| Columna                | Tipo       | Descripción                                  |
|-----------------------|-----------|----------------------------------------------|
| id                    | CUID      | PK, autogenerado                             |
| userId                | CUID      | FK a User                                    |
| categoryId            | CUID      | FK a Category                                |
| geoNodeId             | CUID      | FK a GeoNode (ubicación del pedido)          |
| description           | String    | Descripción del pedido                       |
| photoUrls             | String[]  | URLs de fotos (Cloudflare R2)                |
| audioUrl              | String?   | URL de audio                                 |
| status                | Enum      | CREATED \| ASSIGNED \| ACCEPTED \| CANCELLED \| NO_RESPONSE \| COMPLETED \| NOT_FULFILLED |
| assignedProfessionalId| CUID?     | FK a Professional (relación "AssignedProfessional") |
| assignedAt            | DateTime? | Timestamp de asignación                      |
| acceptedAt            | DateTime? | Timestamp de aceptación                      |
| completedAt           | DateTime? | Timestamp de finalización                    |
| assignmentTimeoutAt   | DateTime? | Timeout de respuesta del profesional         |
| scheduledAt           | DateTime? | Fecha y hora confirmada de la visita         |
| clientAddress         | String?   | Dirección exacta ingresada por el usuario    |
| clientLatitude        | Float?    | Latitud del pin de WhatsApp                  |
| clientLongitude       | Float?    | Longitud del pin de WhatsApp                 |
| coordinationStatus    | String?   | AWAITING_AVAILABILITY \| AWAITING_CONFIRMATION \| AWAITING_USER_CONFIRMATION \| AWAITING_LOCATION \| SCHEDULED |
| negotiationRounds     | Int       | Rondas de negociación de horario (default: 0) |
| createdAt             | DateTime  | Autogenerado                                 |
| updatedAt             | DateTime  | Autogenerado (on update)                     |

- Relaciones: `events` → RequestEvent[], `feedback` → Feedback?, `escalation` → Escalation?

### RequestEvent
| Columna        | Tipo     | Descripción                           |
|---------------|----------|---------------------------------------|
| id            | CUID     | PK, autogenerado                      |
| requestId     | CUID     | FK a Request                          |
| professionalId| CUID?    | FK a Professional                     |
| type          | Enum     | ASSIGNED \| ACCEPTED \| REJECTED \| NO_RESPONSE \| COMPLETED \| NOT_FULFILLED \| CANCELLED |
| metadata      | Json?    | Datos adicionales del evento          |
| createdAt     | DateTime | Autogenerado                          |

### Feedback
| Columna                 | Tipo      | Descripción                                          |
|------------------------|----------|------------------------------------------------------|
| id                     | CUID     | PK, autogenerado                                      |
| requestId              | CUID     | Único, FK a Request                                   |
| rating                 | Int?     | Calificación general del usuario al profesional        |
| punctualityRating      | Int?     | Puntualidad                                           |
| qualityRating          | Int?     | Calidad del trabajo                                   |
| communicationRating    | Int?     | Comunicación                                          |
| priceFairnessRating    | Int?     | Relación precio-calidad                               |
| wouldRecommend         | Boolean? | ¿Recomendaría al profesional?                         |
| userComment            | String?  | Comentario del usuario                                |
| ratedByUserAt          | DateTime?| Fecha de calificación del usuario                     |
| requestClarityRating   | Int?     | Claridad del pedido (calificación del profesional al usuario) |
| userAvailabilityRating | Int?     | Disponibilidad del usuario                            |
| userTreatmentRating    | Int?     | Trato del usuario                                     |
| wouldServeAgain        | Boolean? | ¿Atendería de nuevo al usuario?                       |
| professionalComment    | String?  | Comentario del profesional                            |
| ratedByProfessionalAt  | DateTime?| Fecha de calificación del profesional                  |
| createdAt              | DateTime | Autogenerado                                          |
| updatedAt              | DateTime | Autogenerado (on update)                              |

### Escalation
| Columna        | Tipo     | Descripción                              |
|---------------|----------|------------------------------------------|
| id            | CUID     | PK, autogenerado                         |
| requestId     | CUID     | Único, FK a Request                      |
| reportedBy    | CUID     | FK a User (quien reporta)                |
| professionalId| CUID     | FK a Professional (reportado)            |
| status        | Enum     | OPEN \| IN_REVIEW \| RESOLVED            |
| resolution    | String?  | Texto de resolución                      |
| resolvedBy    | String?  | Admin que resolvió                       |
| createdAt     | DateTime | Autogenerado                             |
| updatedAt     | DateTime | Autogenerado (on update)                 |

### BotSession
| Columna     | Tipo     | Descripción                           |
|------------|----------|---------------------------------------|
| id         | CUID     | PK, autogenerado                      |
| phone      | String   | Único, teléfono del usuario           |
| role       | Enum?    | USER \| PROFESSIONAL                  |
| currentFlow| String?  | Flujo actual del bot                  |
| currentStep| String?  | Paso actual dentro del flujo          |
| tempData   | Json?    | Datos temporales de la conversación   |
| createdAt  | DateTime | Autogenerado                          |
| updatedAt  | DateTime | Autogenerado (on update)              |

### Enums

- **AdminRole**: SUPERADMIN, OPERATOR
- **UserStatus**: ACTIVE, BLOCKED
- **ProfessionalStatus**: PENDING, UNDER_REVIEW, ACTIVE, OBSERVATION, SUSPENDED, PAUSED, REJECTED
- **MembershipStatus**: ACTIVE, INACTIVE, EXPIRED
- **MembershipType**: MONTHLY, ANNUAL
- **RequestStatus**: CREATED, ASSIGNED, ACCEPTED, PENDING_CONFIRMATION, CANCELLED, NO_RESPONSE, COMPLETED, NOT_FULFILLED
- **RequestEventType**: ASSIGNED, ACCEPTED, REJECTED, NO_RESPONSE, PENDING_CONFIRMATION, COMPLETED, NOT_FULFILLED, CANCELLED
- **EscalationStatus**: OPEN, IN_REVIEW, RESOLVED
- **BotRole**: USER, PROFESSIONAL
- **ErrorVariant** (frontend): expired, used, invalid, missing

## Environment Variables

| Variable            | Requerida | Descripción                              |
|--------------------|-----------|------------------------------------------|
| `DATABASE_URL`     | Sí        | Connection string de PostgreSQL          |
| `JWT_SECRET`       | Sí        | Secreto para firmar/verificar JWT        |
| `PORT`             | No (3000) | Puerto del servidor HTTP                 |
| `PUBLIC_URL`       | No (http://localhost:3000) | URL pública para links de verificación   |
| `SEED_ADMIN_EMAIL` | No        | Email del superadmin inicial (seed)      |
| `SEED_ADMIN_PASSWORD`| No      | Password del superadmin inicial (seed)   |
| `R2_ACCOUNT_ID`     | Sí        | Cloudflare R2 account ID                |
| `R2_ACCESS_KEY_ID`  | Sí        | Cloudflare R2 access key ID             |
| `R2_SECRET_ACCESS_KEY`| Sí      | Cloudflare R2 secret access key         |
| `R2_BUCKET_NAME`    | Sí        | Cloudflare R2 bucket name               |
| `R2_PUBLIC_URL`     | Sí        | URL pública base del bucket R2          |
| `BUILD_TARGET`      | No        | Target de build: `admin`, `app`, o `landing` (solo frontend) |
| `VITE_API_URL`      | No        | URL de la API para builds admin/app (.env.admin, .env.app) |
| `VITE_WHATSAPP_NUMBER`| No      | Número de WhatsApp para build landing (.env.landing) |

## Business Rules

- Passwords se hashean con bcrypt (10 rounds de salt)
- JWT expira en 24 horas
- Solo usuarios con rol `SUPERADMIN` pueden acceder a rutas protegidas con `requireSuperAdmin`
- Errores de autenticación retornan 401 (credenciales inválidas o token inválido/expirado)
- Errores de autorización retornan 403 (rol insuficiente)
- El seed crea/actualiza superadmin, jerarquía geográfica, configuración del sistema, planes y categorías si no existen previamente
- Jerarquía geográfica:
  - Países son nodos raíz (`parentId = null`, `levelId = null`)
  - Cada país define N niveles con nombres configurables (GeoLevel)
  - La unidad mínima para matching es siempre el nodo hoja (sin hijos), sin importar en qué nivel esté
  - Un nodo no puede activarse si su padre está inactivo
  - Desactivar un nodo padre desactiva en cascada todos sus hijos
  - No se puede hacer toggle de un país directamente (422)
- Categorías:
  - El slug se genera automáticamente desde el name (lowercase, sin acentos, espacios → guiones)
  - El slug es inmutable una vez creado (no se puede editar)
  - No se permite crear categorías con name o slug duplicado → 409
  - `findBySlugOrName(query)`: búsqueda exacta por slug o name, luego Levenshtein con threshold configurable (max distance: 3) como fallback; retorna `null` si no hay match
- Usuarios:
  - El usuario no se registra explícitamente; el bot lo crea automáticamente al detectar un número nuevo
  - `findOrCreateByPhone(phone, name?)`: busca por teléfono; si no existe, crea uno nuevo con `name` (default: phone)
  - `isBlocked(phone)`: retorna `true` si el status es BLOCKED; si el usuario no existe, retorna `false`
  - No existe endpoint de creación manual ni de eliminación de usuarios
  - Bloquear un usuario ya bloqueado retorna 409; desbloquear uno activo retorna 409
- Profesionales:
  - El registro es en dos etapas: etapa 1 (bot WhatsApp) crea en PENDING con token de verificación, etapa 2 (web) sube documentación y pasa a UNDER_REVIEW
  - Token de verificación: UUID v4, expira en 72h, un solo uso (segundo intento retorna 400)
  - `GET /professionals/verify/:token` retorna `{ valid, professionalName, zones: [{ id, name }] }` — las zonas provienen de la tabla ProfessionalZone con include de GeoNode
  - `POST /professionals/verify/:token` acepta `{ dniNumber, cuil, dniFrontUrl, dniBackUrl, criminalRecordUrl?, references?, presentationVideoUrl? }` — todos los campos son opcionales en backend; el frontend valida obligatoriedad de DNI, CUIL, dniFrontUrl y dniBackUrl
  - El frontend de onboarding (`/verify/:token`) es standalone (sin header ni nav), mobile-first (375px), con barra de progreso de 8 pasos y upload de archivos a R2 vía presigned URLs
  - El sistema nunca aprueba profesionales automáticamente — siempre requiere revisión manual de un SUPERADMIN
  - Aprobación: solo permite transición UNDER_REVIEW → ACTIVE
  - Rechazo: solo permite transición UNDER_REVIEW → REJECTED. El motivo se registra en logs (no hay campo en DB para rejectionReason en MVP)
  - Suspensión: cualquier estado → SUSPENDED (excepto si ya está suspendido → 409)
  - Reactivación: solo permite transición SUSPENDED → ACTIVE
  - Badge: se puede asignar y remover; asignar un valor ya existente retorna 409
  - Token de sesión: UUID v4, expira en 30 días, solo generable para profesionales ACTIVE
  - `getActiveCandidates(categoryId, geoNodeId)`: retorna profesionales ACTIVE con zona y rubro coincidentes, con trialRequestsUsed < 5 y `canReceiveRequests() = true`
  - En MVP: un solo rubro por profesional
- Planes:
  - Tres planes: Básico ($9.000/mes, prioridad 1), Profesional ($20.000/mes, prioridad 2), Premium ($40.000/mes, prioridad 3)
  - `monthlyPrice` debe ser un número no negativo
  - `annualDiscountPct` debe estar entre 0 y 100
  - No se permite crear planes con nombre duplicado → 409
- Membresías:
  - `canReceiveRequests(professionalId)`: retorna `true` si hay membresía ACTIVE con `endDate > now()`, o si `trialRequestsUsed < TRIAL_REQUESTS_LIMIT`; en cualquier otro caso retorna `false`
  - Activación manual: MONTHLY → `endDate = startDate + 30 días`; ANNUAL → `endDate = startDate + 365 días`
  - Expiración lazy: si al consultar estado se detecta `endDate <= now()` → se marca la membresía como EXPIRED
  - La lógica de activación no conoce el origen del pago (preparada para integración con MercadoPago)
- Configuración del sistema:
  - `TRIAL_REQUESTS_LIMIT` define el máximo de pedidos de prueba por profesional (default: 3)
  - `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` define el timeout de respuesta del profesional asignado (default: 2)
  - `AUTO_COMPLETE_HOURS` define las horas sin confirmación para auto-completar un pedido (default: 24)
  - Las claves de configuración se crean/actualizan vía upsert
- Motor de matching:
  - Scoring en tiempo real, no persistido en DB
  - Filtros duros: status ACTIVE, zona, categoría, canReceiveRequests, máximo 2 activos, no rechazó el pedido
  - Score = Cumplimiento × 0.50 + TasaRespuesta × 0.30 + Recomendación × 0.10 + Distribución × 0.10
  - Cumplimiento: base 100, -50 por NOT_FULFILLED atenuado linealmente hasta `REPUTATION_DECAY_DAYS` (default: 90). Mín 0.
  - TasaRespuesta: base 100, -25 por NO_RESPONSE. Mín 0.
  - Recomendación: % feedbacks con `wouldRecommend = true`. Sin feedbacks → 50.
  - Distribución: `min(100, días × 10)`. Sin pedidos previos → 100.
  - Todos los pesos, penalizaciones y límites son configurables vía `SystemConfig` con defaults en `MATCHING_*` keys.
   - `findBestCandidate()` retorna `null` si ningún profesional pasa los filtros.
   - Sin endpoints REST propios — es invocado internamente por el módulo de Pedidos.
- Pedidos:
  - Usuario con pedido activo (CREATED, ASSIGNED, ACCEPTED, PENDING_CONFIRMATION) no puede crear otro → 409
  - Usuario bloqueado no puede crear pedidos → 403
  - Creación dispara matching automáticamente vía `findBestCandidate()`; si no hay candidatos → NO_RESPONSE
  - `assignmentTimeoutAt` se setea al asignar: `now() + PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2h)
  - Aceptar: incrementa `trialRequestsUsed` si el profesional no tiene membresía ACTIVA vigente. Limpia `assignmentTimeoutAt`
  - Rechazar: registra evento REJECTED, recolecta todos los rejectores anteriores (incluyendo al actual) y reasigna excluyéndolos
  - Sin candidatos tras reasignación → NO_RESPONSE
  - Cancelación: solo permitida en CREATED o ASSIGNED → CANCELLED
  - `finish`: profesional finaliza trabajo → PENDING_CONFIRMATION + setea `completedAt` + evento PENDING_CONFIRMATION. Solo permitido en ACCEPTED.
  - `confirm`: usuario confirma satisfacción (SATISFIED/PARTIAL/UNSATISFIED). SATISFIED/PARTIAL → COMPLETED + evaluateBadge. UNSATISFIED → NOT_FULFILLED + Escalation + penalización. Solo permitido en PENDING_CONFIRMATION.
  - `dispute`: alias de `confirm(UNSATISFIED)`. Crea Escalation y penaliza al profesional automáticamente.
  - `markCompleted`: (legacy) profesional setea `completedAt`, el status sigue ACCEPTED
  - `confirmCompletion`: (legacy) usuario confirma Sí → COMPLETED, o No → NOT_FULFILLED
  - `reportNoncompliance`: (legacy) usuario reporta incumplimiento → NOT_FULFILLED
  - `submitFeedback`: solo para pedidos COMPLETED; un solo feedback por pedido → 409 si ya existe
- Timeout job: busca ASSIGNED con `assignmentTimeoutAt < now()`, crea NO_RESPONSE para el profesional, excluye al profesional vencido + rejectores, reasigna
- Auto-complete job: busca PENDING_CONFIRMATION con `updatedAt < now() - AUTO_COMPLETE_HOURS` (default: 24h) → COMPLETED + evento con metadata `{ autoClosedAt, reason: "timeout_user_confirmation" }`. El cron corre cada hora (`node-cron` en `server.ts`). No dispara flujo de calificación.
- **Reminders job:** busca SCHEDULED con `scheduledAt` entre 23h y 24h en el futuro → envía `pendingMessage` a usuario y profesional vía `BotSession`. El cron corre cada hora (`node-cron` en `server.ts`).
- Endpoint manual de testing: `POST /admin/requests/auto-close` (SUPERADMIN) ejecuta el mismo proceso bajo demanda.
- Los jobs `processTimeouts()` y `autoClosePendingConfirmations()` son métodos públicos invocados por el cron job interno
- **Coordinación de visita (AUT-151, AUT-152):**
  - Al aceptar un pedido (`POST /requests/:id/accept`), `RequestsController` dispara `CoordinationService.initAfterAccept()` que setea `coordinationStatus = AWAITING_AVAILABILITY` y configura la sesión del usuario en el bot
  - NORA actúa como relay entre usuario y profesional para coordinar día, hora, dirección y ubicación
  - Estados de coordinación: `AWAITING_AVAILABILITY` → `AWAITING_CONFIRMATION` → `AWAITING_LOCATION` → `SCHEDULED`
  - El usuario comparte disponibilidad horaria vía chat → el coordination flow guarda la disponibilidad en `clientAddress` y notifica al profesional
  - El profesional confirma desde el panel (`POST /requests/:id/confirm-visit`) → `scheduledAt` se guarda, `coordinationStatus = AWAITING_LOCATION`, NORA pide ubicación al usuario
  - El usuario comparte dirección (`clientAddress`) y ubicación (`clientLatitude`/`clientLongitude` vía pin de WhatsApp)
  - Si el usuario solo comparte uno de los dos (texto o pin), NORA pide el faltante
  - Al completar ambos → `coordinationStatus = SCHEDULED`, NORA notifica al profesional con todos los datos
  - El profesional ve en su panel: botón "Confirmar visita" (cuando AWAITING_CONFIRMATION), indicador "Esperando ubicación" (cuando AWAITING_LOCATION, no permite marcar finalizado) y botón "Ver detalle" (cuando SCHEDULED, muestra dirección y link Google Maps)
  - El simulador web incluye un botón "📍 Compartir ubicación (simulada)" que envía coordenadas hardcodeadas de Mendoza (`-32.8908, -68.8272`) cuando NORA pide compartir ubicación desde WhatsApp — exclusivo para testing en desarrollo
  - El usuario NUNCA recibe el teléfono del profesional en ningún momento
  - El profesional SÍ recibe el teléfono del usuario en el modal "Ver detalle" del panel
  - Cron job `sendVisitReminders()` busca pedidos SCHEDULED con `scheduledAt` dentro de 23-24h y envía recordatorio a ambas partes vía `pendingMessage` en BotSession
  - El coordination flow y el coordination service están aislados del módulo de requests — `RequestsService.create()` no importa dependencias de coordinación
  - El polling del simulador (`useChat`) detecta cambios de `coordinationStatus` y muestra mensajes automáticos: disponibilidad solicitada, horario confirmado, pedido de ubicación, visita coordinada
  - El `POST /bot/message` acepta campo `location: { latitude, longitude }` en el body para simular pines de WhatsApp
- Todos los cambios de estado (asignación, aceptación, rechazo, cancelación, finalización, no respuesta) registran su `RequestEvent` inmutable
- Penalizaciones automáticas: 1er NOT_FULFILLED → OBSERVATION, 2do+ → SUSPENDED + alerta. Se ejecutan en la misma transacción que el evento.
- Reactivación (manual vía SUPERADMIN) conserva todo el historial de eventos
- Badge se otorga automáticamente cuando cumplimiento = 100% y pedidos completados ≥ `BADGE_MIN_COMPLETED_REQUESTS`
- Badge se remueve automáticamente al recibir un NOT_FULFILLED con badge activo
- Los profesionales con status OBSERVATION siguen en el pool de matching (se consideran elegibles junto con ACTIVE)
- Los profesionales con status SUSPENDED quedan fuera del pool
- Storage: el backend nunca recibe el contenido binario de archivos; los clientes suben directo a R2 usando URLs pre-firmadas
- El filename en R2 se reemplaza por UUID preservando la extensión original
- Cada folder (`request-photos`, etc.) tiene su propia lista blanca de contentTypes
- La URL pre-firmada expira después de un tiempo configurable (default: 3600 segundos)
- Escalations se crean automáticamente en `reportNoncompliance` dentro de la misma transacción
- Escalations solo pueden transicionar OPEN→IN_REVIEW→RESOLVED; RESOLVED es terminal
- `resolve` requiere texto de resolución no vacío; registra el admin que resuelve
- Calificación post-servicio (AUT-142):
  - `POST /requests/:id/rate-professional`: solo pedidos COMPLETED; una calificación por usuario (ratedByUserAt) → 409 si ya calificó
  - `POST /requests/:id/rate-user`: solo pedidos COMPLETED; una calificación por profesional (ratedByProfessionalAt) → 409 si ya calificó
  - Todos los campos numéricos entre 1 y 5; comentarios opcionales con máximo 300 caracteres
  - La reputación (promedios por eje, % recomendación, total calificados) se calcula on-the-fly desde los feedbacks, sin campos nuevos en Professional
  - El panel del profesional muestra desglose por eje (puntualidad, calidad, comunicación, precio justo) con estrellas
  - El profesional puede calificar al usuario desde la pestaña "Mis Pedidos" del panel (botón "Calificar" en pedidos COMPLETED sin calificar)
  - El panel admin muestra reputación real con desglose por eje en el detalle del profesional
  - El simulador guía al usuario paso a paso por los 7 ejes de calificación cuando el pedido pasa a COMPLETED

## Frontend: Admin Panel (NEW — AUT-132)

Panel de administración completo con 11 pantallas. Autenticación JWT en memoria (no localStorage), layout con sidebar colapsable en mobile, y guardas de ruta por rol (SUPERADMIN / OPERATOR).

### Tech Stack
- React 19 + TypeScript
- Tailwind CSS 4 (tokens del DESIGN.md)
- lucide-react (íconos)
- react-router-dom v7 (rutas protegidas)

### Design System
- Stitch project: `projects/1505486100227666482`
- Design asset: `assets/9140616588152080241`
- DESIGN.md: `.stitch/admin/DESIGN.md`
- Modo claro, DM Sans + JetBrains Mono, NORA Green (#0B6E4F) como acento
- Todos los elementos interactivos (botones, links, toggles, cards clickeables) usan `cursor-pointer` (AUT-156)

### Pages

| Ruta | Pantalla | Rol mínimo | Funcionalidad |
|------|----------|-----------|--------------|
| `/admin/login` | Login | Ninguno | Formulario email + contraseña → JWT en memoria |
| `/admin` | Dashboard | OPERATOR | 4 métricas + rendimiento + profesionales por estado |
| `/admin/professionals` | Lista Profesionales | OPERATOR | Tabla con filtros, badges, paginación |
| `/admin/professionals/:id` | Detalle Profesional | OPERATOR | Info, docs R2, historial, acciones SUPERADMIN |
| `/admin/users` | Usuarios | OPERATOR | Tabla, footer métricas, bloquear/desbloquear |
| `/admin/orders` | Pedidos | OPERATOR | Tabla con timeline de 3 dots, filtros |
| `/admin/escalations` | Escaladas | OPERATOR | Summary críticas, cambiar estado, modal resolver |
| `/admin/zones` | Zonas | OPERATOR | Árbol con acordeón, toggles, agregar/editar nodos |
| `/admin/categories` | Categorías | OPERATOR | Tabla con toggle inline, modal crear/editar |
| `/admin/plans` | Planes | OPERATOR | Cards de planes + edición de precio |
| `/admin/settings` | Configuración | SUPERADMIN | Parámetros matching, límites, integraciones, toggles |

### Auth Flow
1. Login → `POST /auth/login` → JWT almacenado en variable en memoria
2. Cada request incluye `Authorization: Bearer <token>`
3. Logout → se limpia el token de memoria → redirect a `/admin/login`
4. `ProtectedRoute` verifica autenticación y opcionalmente rol requerido
5. OPERATOR no ve Configuración; botones SUPERADMIN ocultos para OPERATOR
6. Todas las acciones destructivas (aprobar, rechazar, suspender, reactivar, bloquear, desbloquear, cambiar estado de escalada, resolver) tienen un `ConfirmDialog` que muestra el nombre del afectado antes de ejecutar el request

## Scripts

| Comando              | Descripción                          |
|---------------------|--------------------------------------|
| `npm run dev:backend`  | Inicia servidor backend en modo desarrollo   |
| `npm run dev:frontend` | Inicia servidor frontend (Vite dev server)   |
| `npm run build:backend`| Compila TypeScript del backend a `dist/`     |
| `npm run build:frontend`| Compila y empaqueta frontend con Vite        |
| `npm run build:landing` | Build solo de landing (`BUILD_TARGET=landing`) |
| `npm run build:admin`   | Build solo de admin (`BUILD_TARGET=admin`)    |
| `npm run build:app`     | Build solo de app (`BUILD_TARGET=app`)        |
| `npm run build:all`     | Build secuencial de los tres targets          |
| `npm run lint`      | Ejecuta ESLint                       |
| `npm run format`    | Formatea código con Prettier         |
| `npm run prisma:generate` | Genera Prisma Client           |
| `npm run prisma:migrate`  | Ejecuta migraciones de Prisma  |
| `npm run prisma:seed`     | Ejecuta seed (superadmin + Argentina)  |
