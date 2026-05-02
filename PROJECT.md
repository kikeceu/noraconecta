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
| Linter        | ESLint + Prettier    |

## Architecture

```
noraconecta/                   # Monorepo root (npm workspaces)
├── backend/
│   ├── src/
│   │   ├── server.ts                  # Entry point: Express app bootstrap
│   │   ├── lib/
│   │   │   └── prisma.ts              # Prisma client singleton
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
│   │   │   │   ├── locations.routes.ts     # 6 endpoints under /locations
│   │   │   │   ├── locations.controller.ts # Request validation, response formatting
│   │   │   │   ├── locations.service.ts    # Geo hierarchy business logic
│   │   │   │   └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
│   │   │   ├── users/
│   │   │   │   ├── users.routes.ts         # 4 endpoints under /users
│   │   │   │   ├── users.controller.ts     # Request validation, response formatting
│   │   │   │   ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock
│   │   │   │   └── users.repository.ts     # Prisma queries for User model
│   │   │   └── professionals/
│   │   │       ├── professionals.routes.ts     # 11 endpoints under /professionals
│   │   │       ├── professionals.controller.ts # Request validation, response formatting
│   │   │       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session
│   │   │       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone
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
│   │   └── .gitkeep             # Placeholder (frontend modules TBD)
│   ├── package.json             # @noraconecta/frontend
│   └── tsconfig.json            # React + TypeScript base config
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
│       ├── professionals.routes.ts     # 11 endpoints under /professionals
│       ├── professionals.controller.ts # Request validation, response formatting
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

## Modules

### Auth

| Endpoint         | Método | Descripción                          | Auth requerida |
|-----------------|--------|--------------------------------------|----------------|
| `/health`        | GET    | Health check (sin auth)              | No             |
| `/auth/login`    | POST   | Login de admin (email + password)    | No             |

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
| `/professionals/verify/:token`         | GET    | Verificar validez del token de verificación      | Sin auth  |
| `/professionals/verify/:token`         | POST   | Etapa 2: subir documentación                    | Sin auth  |
| `/professionals/session/:token`        | GET    | Recuperar sesión de profesional por token       | Sin auth  |
| `/professionals`                       | GET    | Lista paginada de profesionales (filtros: status, categoryId) | OPERATOR  |
| `/professionals/:id`                   | GET    | Detalle de profesional                          | OPERATOR  |
| `/professionals/:id/approve`           | POST   | Aprobar profesional (UNDER_REVIEW → ACTIVE)     | SUPERADMIN|
| `/professionals/:id/reject`            | POST   | Rechazar profesional (UNDER_REVIEW → REJECTED)  | SUPERADMIN|
| `/professionals/:id/suspend`           | POST   | Suspender profesional                           | SUPERADMIN|
| `/professionals/:id/reactivate`        | POST   | Reactivar profesional (SUSPENDED → ACTIVE)      | SUPERADMIN|
| `/professionals/:id/badge`             | PATCH  | Asignar o remover insignia de reputación        | SUPERADMIN|
| `/professionals/:id/generate-session`  | POST   | Generar token de sesión para portal profesional | SUPERADMIN|

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

### Config

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

### Requests

| Endpoint                               | Método | Descripción                                    | Auth      |
|----------------------------------------|--------|------------------------------------------------|-----------|
| `/requests`                            | POST   | Crear pedido (bot: phone + category + zone)    | Sin auth  |
| `/requests/:id/accept`                 | POST   | Profesional acepta pedido asignado             | Sin auth  |
| `/requests/:id/reject`                 | POST   | Profesional rechaza pedido → reasigna          | Sin auth  |
| `/requests/:id/cancel`                 | POST   | Usuario cancela pedido                         | Sin auth  |
| `/requests/:id/mark-completed`         | POST   | Profesional marca trabajo como completado      | Sin auth  |
| `/requests/:id/confirm-completion`     | POST   | Usuario confirma (Sí/No) el trabajo            | Sin auth  |
| `/requests/:id/report-noncompliance`   | POST   | Usuario reporta incumplimiento                 | Sin auth  |
| `/requests/:id/submit-feedback`        | POST   | Usuario envía feedback del trabajo             | Sin auth  |
| `/requests`                            | GET    | Lista paginada de pedidos                      | OPERATOR  |
| `/requests/:id`                        | GET    | Detalle de pedido con eventos y feedback       | OPERATOR  |

**Flujo de estados:**
```
CREATED → [matching] → ASSIGNED → [acepta] → ACCEPTED
                                → [rechaza/timeout] → [reasigna] → ASSIGNED (loop)
                                                    → [sin candidatos] → NO_RESPONSE
CREATED/ASSIGNED → [usuario cancela] → CANCELLED
ACCEPTED → [profesional marca completo] → [usuario confirma Sí] → COMPLETED → [feedback]
                                        → [usuario confirma No] → NOT_FULFILLED
         → [usuario reporta incumplimiento] → NOT_FULFILLED
ACCEPTED → [auto-complete 24h sin confirmación] → COMPLETED
```

**Lógica de negocio:**
- Crear: validar usuario sin pedido activo (409 si ya tiene) → matching → asignar con `assignmentTimeoutAt`
- Aceptar: incrementar `trialRequestsUsed` si no tiene membresía activa
- Rechazar: registrar evento REJECTED → reasignar excluyendo todos los rejectores anteriores
- Timeout: ASSIGNED con `assignmentTimeoutAt < now()` → NO_RESPONSE para el profesional actual → reasignar
- Cancelación: solo permitida en CREATED o ASSIGNED
- Finalización: profesional marca `completedAt` → usuario confirma Sí/No → COMPLETED o NOT_FULFILLED
- Auto-complete: 24h después de `completedAt` sin confirmación → COMPLETED automático
- Todos los cambios de estado registran su `RequestEvent`
- Jobs (sin endpoints): `processTimeouts()`, `processAutoCompletes()` para ser invocados por cron

**Config keys usadas:**
- `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2)
- `AUTO_COMPLETE_HOURS` (default: 24)

#### Roles
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
| Columna        | Tipo     | Descripción                     |
|---------------|----------|---------------------------------|
| id            | CUID     | PK, autogenerado                |
| requestId     | CUID     | Único, FK a Request             |
| workCompleted | Boolean  | ¿El trabajo se completó?        |
| wouldRecommend| Boolean  | ¿Recomendaría al profesional?   |
| comment       | String?  | Comentario opcional             |
| createdAt     | DateTime | Autogenerado                    |

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
- **RequestStatus**: CREATED, ASSIGNED, ACCEPTED, CANCELLED, NO_RESPONSE, COMPLETED, NOT_FULFILLED
- **RequestEventType**: ASSIGNED, ACCEPTED, REJECTED, NO_RESPONSE, COMPLETED, NOT_FULFILLED, CANCELLED
- **EscalationStatus**: OPEN, IN_REVIEW, RESOLVED
- **BotRole**: USER, PROFESSIONAL

## Environment Variables

| Variable            | Requerida | Descripción                              |
|--------------------|-----------|------------------------------------------|
| `DATABASE_URL`     | Sí        | Connection string de PostgreSQL          |
| `JWT_SECRET`       | Sí        | Secreto para firmar/verificar JWT        |
| `PORT`             | No (3000) | Puerto del servidor HTTP                 |
| `PUBLIC_URL`       | No (http://localhost:3000) | URL pública para links de verificación   |
| `SEED_ADMIN_EMAIL` | No        | Email del superadmin inicial (seed)      |
| `SEED_ADMIN_PASSWORD`| No      | Password del superadmin inicial (seed)   |
| `PLAN_MONTHLY_PRICE`| No      | Precio mensual del plan (seed)           |
| `PLAN_ANNUAL_DISCOUNT_PCT`| No | % descuento plan anual (seed)           |

## Business Rules

- Passwords se hashean con bcrypt (10 rounds de salt)
- JWT expira en 24 horas
- Solo usuarios con rol `SUPERADMIN` pueden acceder a rutas protegidas con `requireSuperAdmin`
- Errores de autenticación retornan 401 (credenciales inválidas o token inválido/expirado)
- Errores de autorización retornan 403 (rol insuficiente)
- El seed solo crea el superadmin y la jerarquía geográfica si no existen previamente
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
  - Usuario con pedido activo (CREATED, ASSIGNED, ACCEPTED) no puede crear otro → 409
  - Usuario bloqueado no puede crear pedidos → 403
  - Creación dispara matching automáticamente vía `findBestCandidate()`; si no hay candidatos → NO_RESPONSE
  - `assignmentTimeoutAt` se setea al asignar: `now() + PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2h)
  - Aceptar: incrementa `trialRequestsUsed` si el profesional no tiene membresía ACTIVA vigente. Limpia `assignmentTimeoutAt`
  - Rechazar: registra evento REJECTED, recolecta todos los rejectores anteriores (incluyendo al actual) y reasigna excluyéndolos
  - Sin candidatos tras reasignación → NO_RESPONSE
  - Cancelación: solo permitida en CREATED o ASSIGNED → CANCELLED
  - `markCompleted`: profesional setea `completedAt`, el status sigue ACCEPTED
  - `confirmCompletion`: usuario confirma Sí → COMPLETED, o No → NOT_FULFILLED
  - `reportNoncompliance`: usuario reporta incumplimiento → NOT_FULFILLED
  - `submitFeedback`: solo para pedidos COMPLETED; un solo feedback por pedido → 409 si ya existe
  - Timeout job: busca ASSIGNED con `assignmentTimeoutAt < now()`, crea NO_RESPONSE para el profesional, excluye al profesional vencido + rejectores, reasigna
  - Auto-complete job: busca ACCEPTED con `completedAt < now() - AUTO_COMPLETE_HOURS` (default: 24h) → COMPLETED
  - Los jobs `processTimeouts()` y `processAutoCompletes()` son métodos públicos sin endpoints, para ser invocados por cron externo
  - Todos los cambios de estado (asignación, aceptación, rechazo, cancelación, finalización, no respuesta) registran su `RequestEvent` inmutable

## Scripts

| Comando              | Descripción                          |
|---------------------|--------------------------------------|
| `npm run dev`       | Inicia servidor en modo desarrollo   |
| `npm run build`     | Compila TypeScript a `dist/`         |
| `npm start`         | Ejecuta build de producción          |
| `npm run lint`      | Ejecuta ESLint                       |
| `npm run format`    | Formatea código con Prettier         |
| `npm run prisma:generate` | Genera Prisma Client           |
| `npm run prisma:migrate`  | Ejecuta migraciones de Prisma  |
| `npm run prisma:seed`     | Ejecuta seed (superadmin + Argentina)  |
