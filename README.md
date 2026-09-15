 

# Collaborative Workspace & Note App

Plataforma modular de gestión de notas y archivos con edición colaborativa en tiempo real.

## Stack

- **Frontend:** React + TypeScript + TailwindCSS + BlockNote + Yjs + SignalR client
- **Backend:** .NET 10 Web API (Clean Architecture por capas) + SignalR + Dapper
- **Base de datos:** SQL Server, 100% acceso vía Stored Procedures

## Estructura

```
/notes
├── backend/            .NET 10 Web API
│   ├── Database/
│   │   ├── Tables/               scripts idempotentes de creación de tablas
│   │   └── StoredProcedures/      todos los SPs (CRUD, árbol, permisos, auditoría)
│   ├── Domain/                    entidades, enums, interfaces de repositorio
│   ├── Application/DTOs/          contratos de request/response
│   ├── Infrastructure/
│   │   ├── Data/                  DapperContext + implementaciones de repositorio
│   │   ├── Auth/                  JwtTokenService, GoogleOAuthService
│   │   └── Realtime/              YjsDocumentStore (persistencia debounced)
│   ├── Services/                  lógica de negocio (AuthService, NodeService, ...)
│   ├── Hubs/                      CollaborativeNoteHub (SignalR)
│   └── Controllers/
└── frontend/           React + Vite + TypeScript
    └── src/
        ├── app/                   AppLayout (sidebar colapsable)
        ├── i18n/                  traducciones ES/EN
        ├── theme/                 ThemeProvider (estado UI)
        ├── features/
        │   ├── auth/              Google OAuth (Authorization Code Flow)
        │   ├── tree-explorer/     TreeExplorer con Drag & Drop nativo
        │   ├── editor/            BlockNote + Yjs + SignalR provider + export
        │   ├── sharing/           ShareDialog (enlaces y permisos)
        │   ├── groups/            gestión de grupos de usuarios
        │   └── settings/          perfil, idioma, sesiones
        ├── pages/                 Login, NotePage, About, Google callback
        └── services/              apiClient (fetch + refresh JWT), nodesApi, etc.
```

## Puesta en marcha

### 1. Base de datos

1. Crear una base de datos SQL Server vacía (p. ej. `NotesAppDb`).
2. Ejecutar en orden los scripts de `backend/Database/Tables/*.sql`.
3. Ejecutar todos los scripts de `backend/Database/StoredProcedures/*.sql`.

### 2. Backend

```
cd backend
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:SqlServer" "Server=...;Database=NotesAppDb;..."
dotnet user-secrets set "Jwt:Secret" "<random-secret-32+chars>"
dotnet user-secrets set "Authentication:Google:ClientId" "<google-client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<google-client-secret>"
dotnet run
```

La API queda disponible en `http://localhost:5080` (ajustar según `launchSettings.json`).

### 3. Frontend

```
cd frontend
copy .env.example .env
# editar VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Abrir `http://localhost:5173`.

### Google OAuth

Configurar en Google Cloud Console un cliente OAuth 2.0 con el redirect URI:
`http://localhost:5173/auth/google/callback`.

## Notas de arquitectura

- **Acceso a datos:** ningún query SQL inline; todo Dapper + `CommandType.StoredProcedure`.
- **Colaboración en tiempo real:** documento Yjs (CRDT) sincronizado vía `CollaborativeNoteHub`
  (SignalR) en lugar de WebRTC; persistencia a SQL Server con debounce de 3s.
- **Auth:** Authorization Code Flow — el `client_secret` de Google nunca sale del backend.
- **Exportación:** `html-to-image` + `jsPDF` (únicas librerías de terceros añadidas fuera del stack pactado).
