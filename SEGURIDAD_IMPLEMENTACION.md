# Implementación de seguridad de Dmente Synapse

## Estado

El endurecimiento de código descrito abajo está en el checkout local. No se ha publicado ni desplegado. Antes de producción, validar en staging detrás de la misma cadena de proxies de Coolify y configurar los secretos requeridos; el servidor ahora rechaza iniciar en producción si faltan contraseña, clave de sesión o clave de cifrado TOTP válidas.

## Controles implementados localmente

- Cookies de sesión `HttpOnly`, `SameSite=Lax`, `Secure` en producción y firma HMAC con `SYNAPSE_SESSION_SECRET`. La sesión vence a las 8 horas y se invalida al cerrar sesión.
- MFA heredado de la cuenta inicial mediante `SYNAPSE_OWNER_TOTP_SECRET`, con ventana de verificación de 30 segundos más tolerancia de un paso a cada lado. El campo del código también sirve para las cuentas con MFA individual.
- Cinco fallos de autenticación por dirección durante una ventana de 15 minutos activan un bloqueo temporal de 15 minutos.
- Límite de 100 llamadas por minuto a API/MCP por dirección, con almacenamiento en memoria.
- Comprobación de `Origin`/`Referer` en mutaciones de API basadas en cookie; `SYNAPSE_ALLOWED_ORIGINS` permite declarar orígenes HTTPS adicionales.
- Cuerpos JSON limitados a 64 KiB, tipo de contenido requerido y rechazo de JSON inválido. Mensajes y respuestas se limitan a 10.000 caracteres.
- Cabeceras CSP, HSTS en producción, `nosniff`, `DENY`, `Referrer-Policy` y `Permissions-Policy`. CORS no autoriza orígenes externos.
- Perfil y lista de agentes requieren sesión. El healthcheck público devuelve solo estado básico; el detalle de Hermes requiere sesión.
- RBAC local con roles `viewer`, `operator`, `approver` y `admin`. Las cuentas usan hashes de contraseña scrypt, pueden limitarse a dominios y las rutas API verifican el rol y dominio en el servidor. La cuenta inicial de `SYNAPSE_OWNER_USERNAME` se crea como `admin` al iniciar con `SYNAPSE_OWNER_PASSWORD` configurado.
- Administración de cuentas disponible para administradores autenticados desde Configuración y por API: `GET/POST /api/admin/users` y `PATCH /api/admin/users/:id`. Las altas y cambios de contraseña requieren al menos 12 caracteres; las bajas se hacen desactivando la cuenta. No se permite desactivar o degradar la última cuenta admin activa.
- MFA TOTP individual con alta y confirmación de código, cifrado AES-256-GCM en SQLite y comprobación de contraseña y código para desactivarlo. Requiere `SYNAPSE_TOTP_ENCRYPTION_KEY`, una clave aleatoria de al menos 32 caracteres, persistente y distinta de las demás claves. Al iniciar, si esa clave está definida, el TOTP heredado de `SYNAPSE_OWNER_TOTP_SECRET` se cifra y migra a la cuenta inicial.
- En producción, las cuentas admin sin MFA no pueden consultar datos operativos; solo pueden configurar MFA y cerrar sesión. Se revocan sus sesiones activas al cambiar la contraseña.
- Los mensajes guardan el dominio para que las lecturas por API, MCP y el contexto enviado a Hermes respeten el alcance autorizado, incluso cuando un agente tiene conversaciones de varios dominios.
- MCP admite `SYNAPSE_MCP_READ_TOKEN` y `SYNAPSE_MCP_WRITE_TOKEN`. Si se configura un token de escritura, el token heredado `SYNAPSE_MCP_TOKEN` queda con acceso de lectura. Los tokens aplican alcance por dominio mediante `SYNAPSE_MCP_READ_DOMAINS` y `SYNAPSE_MCP_WRITE_DOMAINS`; en producción, listas vacías no conceden acceso.
- En producción, el arranque exige contraseña del propietario de al menos 12 caracteres, `SYNAPSE_SESSION_SECRET` y `SYNAPSE_TOTP_ENCRYPTION_KEY` de al menos 32 caracteres. Las cuentas admin sin MFA individual o heredado solo pueden entrar a la configuración de MFA, no a los datos operativos.
- Crear solicitudes por MCP fuerza aprobación. Las herramientas MCP validan agentes, dominios, fechas, tamaños y relaciones entre solicitud y mensaje.
- Auditoría sustituye el resumen libre por un marcador redactado y guarda SHA-256 del detalle. Los triggers SQLite rechazan UPDATE y DELETE de eventos.
- Instrucción de sistema de LuciaBot trata documentos, páginas y salidas de herramientas como datos no confiables, no como autoridad para aprobar acciones.
- Workflow de CI para `npm audit`, pruebas, chequeo TypeScript y build; Dependabot semanal para npm y GitHub Actions. Aún no se ha ejecutado en GitHub porque los cambios no se han publicado.

## Configuración comprobada en Coolify el 2026-10-01

- Sesión de Coolify autenticada y recurso de producción identificado: `j20dljqtnxzcq5nrxhxdrrik`.
- Volumen persistente `j20dljqtnxzcq5nrxhxdrrik-dmente-synapse-data`, montado en `/app/data`.
- Se creó un respaldo del volumen y Coolify indicó `Success`, 338.71 KB. Es local al servidor; aún no se comprobó restauración ni réplica externa.
- Copia diaria configurada a las 08:00 UTC, 03:00 de Bogotá. Coolify detiene el contenedor durante el archivo para evitar escrituras concurrentes, lo que produce una interrupción breve.
- `SYNAPSE_TOTP_ENCRYPTION_KEY` creada con 32 bytes aleatorios, codificados en 64 caracteres hexadecimales, solo disponible en runtime. No se guarda en el repositorio.
- Listas explícitas `SYNAPSE_MCP_READ_DOMAINS` y `SYNAPSE_MCP_WRITE_DOMAINS` configuradas con los dominios actuales de la plataforma para conservar el alcance existente de Hermes. Continúa el token heredado; la separación de clientes con tokens dedicados requiere migrar su configuración.
- Healthcheck configurado para el próximo despliegue: `node /app/server/healthcheck.mjs`, intervalo de 30 segundos, timeout de 5 segundos, 3 reintentos y arranque de 30 segundos.
- Bloqueo del despliegue: la contraseña del propietario tiene 10 caracteres y la clave de sesión 20. El servidor nuevo exige 12 y 32 respectivamente. Deben actualizarse antes de desplegar. Sus valores no se exponen en este documento.

## Configuración antes del despliegue

1. Mantener `SYNAPSE_OWNER_PASSWORD` y `SYNAPSE_SESSION_SECRET` solo en variables secretas del servidor.
2. Crear `SYNAPSE_TOTP_ENCRYPTION_KEY` como secreto aleatorio persistente de al menos 32 caracteres. Cada persona debe activar su TOTP desde Configuración y confirmar el código antes de cerrar la sesión.
3. Crear valores aleatorios independientes para `SYNAPSE_MCP_READ_TOKEN` y `SYNAPSE_MCP_WRITE_TOKEN`, además de declarar dominios mínimos en `SYNAPSE_MCP_READ_DOMAINS` y `SYNAPSE_MCP_WRITE_DOMAINS`. Actualizar Hermes y clientes MCP para usar el token adecuado. Cuando el token de escritura dedicado esté configurado, el token heredado queda limitado a lectura; retirarlo después de confirmar la migración.
4. Revisar la cadena real de proxies y definir `SYNAPSE_TRUSTED_PROXY_HOPS` según el número de proxies confiables que agregan `X-Forwarded-For`. El valor por defecto es `0`, que usa la conexión directa. No confiar en ese header sin validar la cadena.
5. Configurar `SYNAPSE_ALLOWED_ORIGINS` solo para orígenes HTTPS adicionales confirmados.
6. Confirmar que el proxy termina TLS y que la PWA entrega los recursos permitidos por CSP.
7. Publicar a una rama para ejecutar CI y revisar alertas de Dependabot. Estos archivos no actúan hasta que se suban a GitHub.

## Pendiente de infraestructura o diseño

- El MFA individual no se ha desplegado ni comprobado en staging. Si se pierde o cambia `SYNAPSE_TOTP_ENCRYPTION_KEY`, los TOTP guardados no pueden descifrarse; su respaldo y rotación requieren un procedimiento operativo.
- Las cuentas y asignaciones de rol se almacenan en SQLite local. Falta definir el procedimiento de alta inicial en staging y respaldar/proteger esa base junto con los demás datos operativos.
- Las sesiones, rate limits y bloqueo de login son locales a un proceso. Reiniciar el servidor los reinicia y varias réplicas no comparten el estado.
- El bloqueo de autenticación y los límites por IP siguen en memoria de proceso; para despliegues con varias réplicas hace falta almacenamiento compartido y la configuración comprobada de proxies confiables.
- No hay herramientas externas de correo, WhatsApp, campañas, DNS o despliegue en el backend actual. Si se agregan, requieren un motor de aprobación independiente y permisos por acción antes de integrarse.
- No se encontró endpoint de subida ni fetch arbitrario iniciado por usuario. Si se añaden, aplicar sandbox, allowlist y protección SSRF antes de habilitarlos.
- No se verificó si Coolify tiene staging, backups cifrados, restauraciones, retención y alertas configurados. Esos controles necesitan configurar y comprobar el proveedor.
- La instrucción anti-inyección de LuciaBot es defensa en profundidad, no clasificador formal. Falta suite red-team con correo, documentos, páginas y salidas de herramientas hostiles.
- La auditoría local no es inmutable frente a un administrador de base de datos o del filesystem. Los hashes permiten detectar cambios de contenido, pero faltan exportación remota y verificación de cadena.
- Falta verificación desde fuera de producción para TLS, headers, CORS, límites efectivos del proxy y recuperación de backups.

## Verificación local

Verificado en el checkout local el 2026-10-01:

- `npm test`: 7 pruebas pasan, incluidas sesiones, headers, límites, proxy, auditoría, permisos MCP y filtrado por dominio.
- `npm run server:check`: correcto.
- `npm run build`: correcto.
- `git diff --check`: correcto.
- `npm audit --audit-level=high`: correcto, 0 vulnerabilidades reportadas.
- Healthcheck probado contra un servidor HTTP aislado: código 200 da salida 0 y código 503 da salida 1.
- No se ha verificado el arranque con secretos de producción, la configuración real del proxy, TLS, headers públicos, restauración de copias, monitorización ni las vistas autenticadas en staging/producción.

## Modelo RBAC

| Rol | Lectura | Escritura interna | Aprobar solicitudes | Gestionar cuentas |
| --- | --- | --- | --- | --- |
| `viewer` | Sí, dentro de dominios asignados | No | No | No |
| `operator` | Sí, dentro de dominios asignados | Sí, dentro de dominios asignados | No | No |
| `approver` | Sí, dentro de dominios asignados | Sí, dentro de dominios asignados | Sí, dentro de dominios asignados | No |
| `admin` | Sí | Sí | Sí | Sí |

El primer inicio de sesión administrativo sigue usando las variables existentes. Para crear otras cuentas, iniciar sesión como admin y enviar `POST /api/admin/users` con `{ "username", "name", "password", "role", "domains" }`. Para cambiar rol, dominios, contraseña o estado, usar `PATCH /api/admin/users/:id`. `domains` acepta los dominios definidos por Synapse; los administradores tienen alcance global.
