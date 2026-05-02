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
│   └── users/
│       ├── users.routes.ts         # 4 endpoints under /users
│       ├── users.controller.ts     # Request validation, response formatting
│       ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock
│       └── users.repository.ts     # Prisma queries for User model
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
