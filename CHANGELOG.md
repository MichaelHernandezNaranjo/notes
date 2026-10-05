# Registro de cambios

La versión que se muestra en «Acerca de» sale de `frontend/package.json` (única fuente).
Se sube antes de cada push y se añade aquí una entrada. Esquema semver: parche = correcciones y ajustes,
menor = funcionalidades nuevas, mayor = cambios incompatibles.

## 1.0.2 — 2026-10-03

- Páginas públicas `/terms` y `/privacy` (sin sesión, con selector de idioma), necesarias para la verificación de Google.
- Login: enlaces reales a Términos y Privacidad (también en el pie) y una frase que explica qué hace Notes, visible en móvil.
- Política de privacidad: se añade la declaración de la Política de Datos de Usuario de las API de Google.
- **Versión de los términos `2026-10-03`** (frontend y backend): cada usuario debe aceptarla de nuevo en su próximo inicio de sesión.

## 1.0.1 — 2026-10-03

- Responsive para móvil y tableta:
  - Barra de navegación inferior en móvil (oculta dentro del editor) y altura dinámica (`dvh`).
  - Una sola pantalla a la vez en móvil: explorador o nota, con flecha para volver.
  - Botón ⋯ en cada elemento del árbol y menú contextual como hoja inferior en pantallas táctiles.
  - Nueva acción «Mover a…» con selector de carpetas (alternativa táctil al arrastrar y soltar).
  - Zonas táctiles de 44 px, campos a 16 px (evita el zoom de iOS) y atajo `Ctrl K` oculto en táctil.
  - Diálogo de compartir sobre el modal común, Ajustes y barra del editor adaptados a pantallas estrechas.
- Versionado: se añade este registro de cambios.

## 1.0.0

Versión inicial, que agrupa todo lo construido hasta ahora:

- Notas y carpetas con edición colaborativa en tiempo real (BlockNote + Yjs + SignalR).
- Explorador con selección múltiple, creación y renombrado en línea, nombres únicos por carpeta y caché entre módulos.
- Búsqueda por nombre (sin distinguir acentos ni mayúsculas) y sección «Compartido conmigo».
- Papelera de solo lectura con restauración (incluidas las carpetas contenedoras).
- Imágenes en notas, compartir con permisos y exportación a PDF/PNG/JPG.
- Inicio de sesión con Google, renovación automática del token y aceptación explícita de Términos y Privacidad.
- Migraciones de base de datos versionadas y despliegue con Docker + Cloudflare Tunnel.
