# Registro de cambios

La versión que se muestra en «Acerca de» sale de `frontend/package.json` (única fuente).
Se sube antes de cada push y se añade aquí una entrada. Esquema semver: parche = correcciones y ajustes,
menor = funcionalidades nuevas, mayor = cambios incompatibles.

## 1.3.1 — 2026-10-06

- Al pasar del Explorador a Configuración o Administración y volver ya no se recarga nada: el árbol, la nota abierta, su conexión en tiempo real, el scroll y la selección se conservan (la vista se oculta en lugar de desmontarse). El botón «Explorador» vuelve a la última nota abierta.
- Configuración: la sección «Almacenamiento» aparecía duplicada.
- El árbol se revalida en silencio solo si pasaron más de 5 min (antes 30 s), y si no hay cambios no se vuelve a pintar nada.

## 1.3.0 — 2026-10-06

- **Ordenar con arrastrar y soltar en el árbol:** suelta una nota o carpeta entre dos elementos para colocarla ahí (línea azul), o sobre una carpeta para meterla dentro. Funciona con selección múltiple y entre carpetas. El orden se guarda en el servidor (`sp_Node_Move` renumera los hermanos). «Compartido conmigo» no se reordena.
- **Logo:** toda la app usa ahora el mismo diseño del favicon (componente `BrandLogo`).
- «Recientes» aparece colapsado por defecto.
- «Acerca de»: se quita la sección de tecnologías.

## 1.2.0 — 2026-10-06

- **Compartir rehecho desde cero** (los enlaces anteriores nunca llegaron a funcionar y se descartan):
  - **Personas por correo**, con permiso de Lector o Editor que se puede cambiar en cualquier momento sin quitar y volver a dar acceso. Si la persona aún no tiene cuenta, se crea una invitación que se activa al iniciar sesión con ese correo (caduca a los 30 días).
  - **Enlace público de solo lectura** (`/s/…`) que se ve sin cuenta, con copiar, caducidad opcional, regenerar, desactivar y contador de visitas. Imágenes incluidas, sin cookies ni sesión.
  - **Carpetas completas**: el permiso o el enlace se hereda a todo el contenido, también al futuro. El permiso más cercano a la nota prevalece, y el diálogo muestra «heredado de la carpeta X». El enlace de carpeta trae un árbol para navegar.
- **Seguridad:**
  - Gestionar accesos es solo del propietario; antes cualquier usuario autenticado podía listar, crear o revocar permisos de cualquier nota.
  - Solo el propietario borra definitivamente y mueve fuera de una carpeta. Un lector ya no puede duplicar.
  - Grupos: solo propietarios y administradores del grupo gestionan miembros.
  - Al cambiar o quitar un permiso, las sesiones abiertas se actualizan al instante (el usuario deja de recibir cambios), en vez de seguir recibiéndolos hasta cerrar la pestaña.
  - El hub en tiempo real comprueba cuenta bloqueada y pertenencia al grupo; el cursor y la salida de la nota ya no se pueden falsear desde fuera.
  - Las imágenes ya no se guardan 24 h en la caché del navegador, así que dejan de verse al revocar.
  - Endpoint público con límite de peticiones, 404 uniforme, `noindex` y sin cabeceras de identidad.
- **Editor:** un lector ve la nota de verdad en solo lectura (antes se podía escribir y el cambio se perdía en silencio), con insignia y aviso. Se oculta Compartir a quien no es propietario. Aviso en vivo si cambian tus permisos.
- **Navegación:** al abrir un enlace sin sesión, se vuelve a esa nota tras iniciar sesión (antes se perdía el destino). Pantalla «Sin acceso» en vez de 10 s de spinner. Insignias Lector/Editor en «Compartido conmigo». Compartir desde el menú contextual del árbol.
- Auditoría de compartir, cambiar permiso, revocar, e invitar o activar/desactivar enlaces.
- Migración `0005` (invitaciones, un enlace por nota, índices únicos) con copia previa. Términos y Política actualizados (enlaces públicos e invitaciones): versión `2026-10-06`, todos aceptan de nuevo.

## 1.1.0 — 2026-10-05

- **Panel de administración (`/admin`, solo super admin):**
  - Resumen con usuarios, activos, en línea, bloqueados, notas, imágenes, papelera, capacidad de la base de datos y del disco, mayores usuarios y gráficos de actividad.
  - Usuarios: último inicio de sesión y actividad, estado en línea, espacio usado, búsqueda, filtros, orden y paginación; bloquear/desbloquear, cambiar el límite de espacio y nombrar o quitar administradores.
  - Avisos generales o individuales, con importancia y caducidad, entregados en tiempo real.
  - Solo muestra metadatos y espacio usado, nunca el contenido de las notas. Cada acción queda en el registro de auditoría.
- **Super admin:** el correo raíz (`SUPERADMIN_EMAIL`) lo recibe al iniciar sesión (solo si Google verifica el correo) y no se puede degradar ni bloquear. Los demás se nombran desde el panel, siempre quedando al menos uno.
- **Límite de espacio por usuario (250 MB por defecto, ajustable; sin límite para administradores):** se aplica al subir imágenes, guardar notas y duplicar. Al alcanzarlo la cuenta queda en solo lectura y borrado, sin bloquearse. Barra de uso y avisos en Ajustes.
- **Bloqueo de cuentas real:** se aplica al iniciar sesión, al renovar el token, en cada petición y en las conexiones en tiempo real (corrige que `IsActive` no se comprobaba en ningún sitio). El usuario ve un mensaje con el contacto de soporte.
- Presencia en tiempo real (conexión ligera) y banner de avisos.
- Migración `0004` (columnas de administración, tamaño por nota, avisos) aplicada automáticamente con copia de seguridad previa. `db-init` informa de los usuarios que ya superen el límite.
- Términos y Política actualizados (último acceso, límites de espacio, suspensión, avisos): versión `2026-10-05`, cada usuario acepta de nuevo en su próximo inicio de sesión.

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
