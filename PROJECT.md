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
  │   └── locations/
  │       ├── locations.routes.ts     # 6 endpoints under /locations
  │       ├── locations.controller.ts # Request validation, response formatting
  │       ├── locations.service.ts    # Geo hierarchy business logic
  │       └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
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

### Locations

| Endpoint                       | Método | Descripción                                  | Rol mínimo |
|-------------------------------|--------|----------------------------------------------|-----------|
| `/locations/countries`        | GET    | Lista países disponibles                     | OPERATOR  |
| `/locations/tree/:countryId`  | GET    | Árbol completo de nodos de un país           | OPERATOR  |
| `/locations/leaf-nodes`       | GET    | Solo nodos hoja activos (para matching)      | OPERATOR  |
| `/locations/countries`        | POST   | Crear país + definir niveles                 | SUPERADMIN|
| `/locations/nodes`            | POST   | Crear nodo en cualquier nivel                | SUPERADMIN|
| `/locations/nodes/:id/toggle` | PATCH  | Habilitar / deshabilitar nodo                | SUPERADMIN|

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

## Environment Variables

| Variable            | Requerida | Descripción                              |
|--------------------|-----------|------------------------------------------|
| `DATABASE_URL`     | Sí        | Connection string de PostgreSQL          |
| `JWT_SECRET`       | Sí        | Secreto para firmar/verificar JWT        |
| `PORT`             | No (3000) | Puerto del servidor HTTP                 |
| `SEED_ADMIN_EMAIL` | No        | Email del superadmin inicial (seed)      |
| `SEED_ADMIN_PASSWORD`| No      | Password del superadmin inicial (seed)   |

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
