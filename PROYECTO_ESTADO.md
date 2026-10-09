# Estado del Proyecto : DMENTE SYNAPSE

**Última actualización:** 2026-10-09 (America/Bogota)
**Responsable:** Diego (dmentdigital@gmail.com)
**Estado general:** Los controles de cumplimiento y el borrado administrativo de cuentas están publicados en `main` en el commit `89a894d`. El healthcheck y las páginas legales responden HTTP 200. La validación autenticada de producción, la infraestructura externa, el aislamiento multi cliente y la revisión jurídica siguen pendientes de verificación.

Dmente Synapse es la oficina operativa de agentes de Dmente Digital: coordina proyectos, solicitudes, agentes, prioridades, riesgos y aprobaciones. El historial del proyecto identifica `https://synapse.dmentedigital.co` como dominio de producción y menciona Coolify y una VPS Hostinger; proveedor y configuración actual pendientes de reconfirmación.

---

## Actualización del 9 de octubre de 2026: cierre técnico del borrado de cuentas

- Se añadió `POST /api/admin/data-deletion-requests/complete` para completar una solicitud revisada.
- La cuenta se anonimiza, se desactiva y pierde credenciales, dominios, términos aceptados y secretos MFA.
- Se eliminan credenciales WebAuthn, desafíos pendientes y autorización parental asociada.
- Se revocan las sesiones activas y se conserva la solicitud como registro de cumplimiento.
- La interfaz administrativa ahora permite completar el borrado desde la cola de solicitudes.
- Commit publicado: `89a894d` en `origin/main`.
- La suite completa volvió a presentar timeouts de arranque en los servidores de prueba; el cambio no se puede declarar verificado en producción hasta completar el despliegue y la prueba autenticada.

**Pendiente real para cierre total:** proveedor y región de VPS, condiciones de Hermes/GPT, copias y restauración, aislamiento entre clientes, borrado de contenido operativo compartido, prueba de accesibilidad, revisión jurídica y registro formal de la empresa.

---

## Actualización del 8 de octubre de 2026: checklist de cumplimiento SaaS y apps

**Alcance comprobado:** código de la versión de pruebas, cuentas creadas por administración, commit y endpoints públicos de producción. No se verificaron sesiones autenticadas en producción, ubicación de datos de la VPS, contratos de proveedores ni una revisión jurídica final. `CUMPLIMIENTO_SYNAPSE.md` contiene la matriz completa; `AUDITORIA_TERCEROS.md` y `LICENCIAS_ACTIVOS.md` registran terceros y 30 activos publicados.

**Implementado localmente:** páginas públicas de privacidad, términos y cookies; aceptación explícita de términos registrada en cuenta antes de usar la API; aviso de cookies sin activar analítica opcional; finalidad en formularios de acceso, chat, cuentas, agenda y proyectos; solicitud visible de supresión y cola para administración; bloqueo de envío automático a Hermes de familia, salud y educación salvo activación explícita; autorización parental expresa, verificación por otro administrador, referencia sin documento del menor, revocación y bloqueo de esos dominios para cuentas no administrativas hasta su verificación; contacto legal en el pie de página; foco visible, control de Tab/Escape en diálogos, textos alternativos y aumento de contraste en 95 declaraciones de color de texto; inventario de paquetes y activos.

**No aplica a esta versión de pruebas:** checkout, suscripciones, cobros, reembolsos operativos, testimonios y plantillas de correo automatizado. Si se habilitan, implementar precios, impuestos, renovaciones, cancelación, evidencia de reseñas y desuscripción funcional antes de publicar.

**Verificación técnica local:** `npm run build` y `npm run server:check` terminaron sin errores; `npm test` pasó 41/41, incluida la prueba de autorización parental, acceso y revocación. La consulta de dependencias de producción `npm audit --omit=dev --json` del 8 de octubre devolvió cero avisos conocidos. Esto no certifica WCAG ni conformidad legal.

**Publicación verificada el 8 de octubre:** commit `f18f11da4de0beb4e120ac10b96eddbc3abf6a97` enviado a `origin/main`; el usuario inició el despliegue manual en Coolify. `https://synapse.dmentedigital.co/api/version` reportó ese mismo commit y rama `main`; `/api/health` y `/legal/privacidad.html`, `/legal/terminos.html`, `/legal/cookies.html` respondieron HTTP 200 con los documentos correctos. No se verificaron inicio de sesión, autorización parental, borrado ni accesibilidad dentro de la aplicación de producción.

**Estado central:** `ESTADO PROYECTO DMENTE SYNAPSE.md` se actualizó en la carpeta `ESTADOS DE PROYECTOS` de Google Drive mediante la cuenta Dmente Digital, conservando el ID `14A5w3dNyneZLKdNj7im-PtlqUGxcPCNT`. El archivo local y la copia de Drive se comprobaron por tamaño y suma MD5 iguales después de la sincronización final.

**Bloqueos para ofrecer Synapse a clientes:** comprobar proveedor y región de alojamiento, cadena y condiciones de Hermes/IA, retención y restauración de respaldos; definir y ejecutar supresión de datos compartidos y copias; verificar formalmente representación parental en operación e incorporar aislamiento entre clientes; confirmar licencia o cesión formal de imágenes a Tania Alvarado garcia; medir contraste real y completar recorrido con teclado/lector de pantalla; revisión jurídica y nueva aceptación cuando cambien los textos. Los plazos de conservación propuestos en `CUMPLIMIENTO_SYNAPSE.md` aún no están implementados. No asignar rol administrador a clientes en esta arquitectura.

**Próxima acción:** probar los flujos nuevos con una sesión autorizada en producción; obtener los datos y contratos de infraestructura y Hermes, definir el procedimiento de supresión y copias, completar pruebas funcionales de accesibilidad y verificación parental, y revisar los textos con asesoría jurídica antes de activar acceso de clientes.

---

## Pendiente de integrar — Carga desde archivos de estado (6 de octubre de 2026)

- Hecho por Claude en una copia aislada, sobre `ed22abe` (lo que hoy está en `main`). **No está en `main` ni desplegado.**
- Entrega: `entrega_archivos_de_estado_2026-10-06.bundle` en esta carpeta, con 2 commits (`c3bd377`, `67e0330`). Para cargarla: `git fetch entrega_archivos_de_estado_2026-10-06.bundle feat/projects-module:feat/project-state-files`.
- Qué agrega: Synapse lee el archivo de estado de cada proyecto (`PROYECTO_ESTADO.md`, `ESTADO_PROYECTO.md`, `estado.md`, «Estado proyecto X.md»…) y guarda estado general, avance, en progreso, pendientes, próximos pasos, siguiente acción y bloqueo principal. Crea el proyecto si no existe y lo confirma si estaba `por_clasificar`. Tabla nueva `project_states`; herramienta MCP `synapse_import_project_state`; pestaña **Estado** en el detalle del proyecto.
- Carga masiva: `npm run sync:states -- "C:\Users\diego\Documents\DIEGOSAN" --dry-run` (usa `SYNAPSE_MCP_TOKEN` con permiso de escritura; `--exclude TEXTO` omite carpetas). En simulación sobre DIEGOSAN encontró 34 archivos de estado.
- Verificado en la copia aislada: `npm test` (39 pruebas, 0 fallas), chequeo TypeScript del servidor y `npm run build`. **No verificado:** interfaz en navegador, ni la carga real contra producción.

---

## Resumen ejecutivo

| Componente | Estado | Notas |
|---|---|---|
| App web / oficina visual | Desplegada | `main` y `origin/main` están en `ed22abe`; Coolify reportó `Success` y `Finished` para ese commit. |
| Agenda Operativa | Funcionalidad publicada | Edición y borrado desplegados previamente; reprogramación de tareas atrasadas publicada en `c3435ad` y ajuste del calendario nativo en `a8395de` |
| Solicitudes | Desplegada | Protección ante errores de render en `46f728e`; Diego indicó que aparentemente ya funciona |
| API + MCP remoto (`/mcp`) | En producción | Auth Bearer con `SYNAPSE_MCP_TOKEN` |
| Hermes / LuciaBot | Respondiendo | Respuesta real verificada en producción |
| Integración Obsidian | Referencias | Campos `obsidianNote` en solicitudes |
| Puente Claude → Synapse | Implementado | Ver abajo; token ya configurado |
| Ciberseguridad | Primera fase desplegada; 2FA reportada | Seguridad y RBAC integrados a `main` y desplegados. Diego informó el 4 de octubre que configuró la 2FA; no se ha verificado para qué cuenta o entorno ni un inicio de sesión con el segundo factor |
| Sincronización cronjob → Agenda | Capacidad MCP desplegada | `synapse_create_commitment` admite `externalId` idempotente; falta verificar que Hermes/VPS invoque la herramienta y probar el flujo completo |
| Estado de proyectos en Drive | Actualizado | Se conserva el archivo canónico de `ESTADOS DE PROYECTOS`; acceso de Hermes pendiente de comprobar |
| Leads de landing | Código desplegado; flujo pendiente de validación | `POST /api/public/leads`, lectura protegida y vista Leads están incluidos en producción; falta verificar el flujo real con n8n y sus secretos. |

---

## Actualización verificada del 6 de octubre de 2026 — Módulo de Proyectos

- La rama `feat/projects-module` se integró en `main` mediante fast-forward. `main`, `origin/main` y Coolify apuntan al commit `ed22abe3cd8509d87a63da73262f0f5a7d692961`.
- Entrega: `entrega_modulo_proyectos_2026-10-06.bundle` en la raíz de esta carpeta. Para cargarla: `git fetch entrega_modulo_proyectos_2026-10-06.bundle feat/projects-module:feat/projects-module`.
- Contenido: tablas `clients`, `projects`, `project_milestones`, `project_updates`, `project_metrics`, `project_invoices`; columna `commitments.project_id`; API `/api/projects`, `/api/clients`, `/api/project-digest`; sección **Proyectos** en la interfaz; hitos visibles en Agenda como solo lectura; 11 herramientas MCP nuevas para Lucía (`synapse_list_projects`, `synapse_get_project`, `synapse_projects_digest`, `synapse_project_report`, `synapse_create_project`, `synapse_update_project`, `synapse_create_milestone`, `synapse_update_milestone`, `synapse_add_project_update`, `synapse_set_project_metric`, `synapse_resolve_blocker`).
- Semáforo, avance y días de atraso se calculan en el servidor. Presupuesto y cobros solo se ven con acceso al dominio `finance`. No hay borrado de proyectos por MCP.
- Los `project_id` que ya usaban las tareas se registran como proyectos en estado `por_clasificar`; Diego debe activar los reales.
- Verificado localmente: `npm run build` terminó correctamente.
- `npm test`: 35 pruebas, 13 pasan y 22 fallan por timeout al iniciar los servidores de prueba en los puertos `3055`, `3056` y `3057`; el proceso anuncia la API, pero los hooks agotan su espera de inicio.
- Verificado en producción: Coolify reportó `Success` y `Finished` para `ed22abe`; `https://synapse.dmentedigital.co/api/health` respondió HTTP 200 con `{"ok":true,"service":"dmente-synapse-api"}`.
- Antes del despliegue se creó en Coolify un respaldo manual `Success` del volumen `j20dljqtnxzcq5nrxhxdrrik-dmente-synapse-data`, de `447.55 KB`, almacenado localmente en Coolify.
- **No verificado:** la interfaz de proyectos no se revisó funcionalmente en navegador en producción; tampoco se probó el flujo real de Lucía/Hermes con las herramientas nuevas.
- Pendiente: investigar los timeouts de la suite; revisar la pantalla de proyectos en escritorio y móvil; validar permisos, datos reales y herramientas MCP en producción; conexión de Bitácora por endpoint (requiere aprobar un token nuevo); puente `synapse_register_project_state` hacia proyectos; aviso proactivo de Lucía.
- Especificación de origen: `instrucciones_codex_modulo_proyectos_cronograma_2026-10-06.md`.
- Archivos temporales que se pueden borrar: `.git/claude-transfer.tgz` y `.git/claude-stale-index-lock.tmp`.

---

## Actualización verificada del 4 de octubre de 2026

### Agenda: reprogramación de tareas atrasadas

- Se añadió el botón **Esta semana** en cada tarea atrasada.
- La acción permite escoger por tarea si se mueve el inicio y el vencimiento, solo el inicio o solo el vencimiento.
- Se pueden ajustar las horas de inicio y vencimiento.
- La fecha se selecciona mediante un campo nativo `type="date"`, por lo que al hacer clic se abre el calendario emergente del navegador, igual que en **Editar tarea**.
- El calendario limita la selección a hoy y los próximos siete días calculados por la agenda.
- El cambio usa la edición existente de Agenda y conserva la validación de fechas del backend.

### Despliegue

- Commit inicial publicado en la rama de producción: `c3435ad`.
- Ajuste posterior del selector de fecha publicado en `main`: `a8395de`.
- Coolify importó `c3435ad` desde `dmentdigital-cmd/dmente-synapse:main` y mostró el estado **In progress** en la captura compartida por Diego.
- No puedo verificar desde este entorno que el despliegue de `a8395de` haya terminado con **Success** ni que la funcionalidad ya sea visible en el dominio público.
- El código de la funcionalidad se compiló localmente con `npm run build` después del ajuste del calendario.
- Los archivos locales no relacionados permanecieron fuera de los commits publicados.

### Próxima verificación

1. Confirmar en Coolify que `a8395de` terminó con **Success** y que el servicio está **Running**.
2. Probar en producción: **Atrasadas → Esta semana → clic en fecha → calendario emergente → Reprogramar tarea**.
3. Confirmar que la tarea aparece en **Esta semana** con la fecha escogida y deja de aparecer como atrasada cuando su vencimiento queda en el futuro.

---

## Actualización reportada el 4 de octubre de 2026

- Diego informó: «ya configuré la 2FA». Se registra como avance reportado por el usuario, no como validación técnica de MFA en producción.
- El código contempla activación individual por TOTP y expone `mfaEnabled` en el estado de sesión. En esta actualización no se consultó una sesión autenticada ni se comprobó un inicio de sesión con código TOTP. Tampoco se confirmó la cuenta o el entorno donde se configuró.
- Siguiente verificación: confirmar cuenta y entorno; comprobar que el estado de sesión de esa cuenta indique MFA activa y que un nuevo inicio de sesión exija y acepte el código, sin compartir códigos ni secretos en este documento.

---

## Estado verificado al 3 de octubre de 2026

Esta actualización describe el trabajo local de recepción de leads. No modifica las verificaciones históricas de producción que siguen más abajo.

- Rama de trabajo: `codex/public-leads-ingest`, creada desde `codex/deployment-version-info`. Los cambios de leads y de esta vista están en el directorio de trabajo, sin commit ni despliegue. La rama base ya tenía cinco commits respecto a `main`; revisar esa diferencia antes de preparar un PR.
- `POST /api/public/leads` recibe JSON de n8n servidor a servidor. Exige `Authorization: Bearer` con `SYNAPSE_LEADS_INGEST_TOKEN`, independiente de MCP y de la sesión administrativa. Solo esta ruta omite la validación de origen de mutaciones; no se habilitó CORS. El navegador de la landing no debe llamar al endpoint.
- La tabla `leads` guarda nombre, correo, teléfono, empresa, servicio, último mensaje, idioma, UTM, página, embudo, etapa, responsable, estado, número de envíos y fechas. El nombre y WhatsApp internacional con prefijo `+` son obligatorios. Se normalizan teléfono y correo; se validan longitudes y se rechazan campos desconocidos.
- La deduplicación usa correo o teléfono. Un envío diferente del mismo contacto actualiza el registro y aumenta `submission_count`; un envío idéntico no lo incrementa. La cabecera opcional `Idempotency-Key` queda registrada en `lead_ingest_attempts` para reconocer reintentos tardíos de n8n sin revertir datos posteriores. Si correo y teléfono señalan dos leads distintos, la API devuelve `409` para revisión manual. `message` conserva el texto más reciente, no un historial de mensajes.
- Embudo, etapa y responsable iniciales se toman de `LEADS_DEFAULT_PIPELINE`, `LEADS_DEFAULT_STAGE` y `LEADS_DEFAULT_OWNER_ID`; los valores por defecto del código son `ventas`, `nuevo` y `diego-local`. La ruta devuelve `201` al crear, `200` al actualizar o reconocer un reintento, `400` para datos inválidos, `401` para token ausente o incorrecto y `429` al superar el límite. Hay un límite propio de 20 solicitudes por IP cada 60 segundos, además del límite general de API. Ambos viven en memoria del proceso.
- `GET /api/leads` permite lectura paginada con sesión y acceso al dominio `sales`. La nueva pestaña **Leads** muestra lista y detalle del contacto, último mensaje, origen, embudo, etapa y responsable. No crea tareas, notificaciones ni mensajes externos.
- Verificación local: `npm test` pasó con 21 pruebas y 0 fallas; `npm run build` y `git diff --check` pasaron. La vista se comprobó localmente en escritorio y a 390 × 844 con un lead de prueba; el navegador no mostró errores de consola. El servidor y la base temporal usados para esa comprobación se cerraron y eliminaron.
- No se probó el endpoint en producción ni la integración real con n8n. No se verificó la cadena de proxy y la IP efectiva para los límites. No se sabe si n8n dispone de un identificador estable por envío. No se han creado estas variables para el despliegue en Coolify en esta sesión.

### Decisiones y próximos pasos de leads

1. Revisar la rama y definir la base del futuro PR sin arrastrar commits no deseados.
2. Configurar en Coolify `SYNAPSE_LEADS_INGEST_TOKEN` como secreto aleatorio de al menos 32 caracteres y los tres valores `LEADS_DEFAULT_*` acordados; entregar el token a n8n por un canal seguro, sin ponerlo en la landing ni en este documento.
3. Configurar n8n para enviar una `Idempotency-Key` estable por envío y reutilizarla en reintentos. Verificar autenticación, deduplicación, respuesta `201`/`200` y manejo de `409`/`429` en un entorno de prueba.
4. Validar la cadena de proxies y `SYNAPSE_TRUSTED_PROXY_HOPS` antes de interpretar el límite por IP. Desplegar solo con autorización posterior y probar el flujo completo landing → n8n → Synapse.

---

## Estado verificado al 2 de octubre de 2026

Esta sección recoge las comprobaciones de la sesión actual y actualiza los antecedentes conservados más abajo.

- Producción: `https://synapse.dmentedigital.co`.
- Repositorio: `https://github.com/dmentdigital-cmd/dmente-synapse`, rama publicada `main`.
- Versión desplegada: `b950cd3aa87ed6d9ec575e2ef137acbd7cf1c088` (merge squash del PR #6). Coolify reportó `Success`, servicio `Running`, healthcheck `healthy` y actualización completada.
- La sesión pública `/api/auth/session` respondió `configured: true`, `authenticated: false`. Esto no constituye una prueba de inicio de sesión autenticado.
- La Agenda incluye botones **Editar** y **Eliminar** en las tarjetas. Su presencia en producción se comprobó en la captura aportada por Diego después del despliegue.
- La edición reutiliza el formulario existente. El borrado solicita confirmación del título y conserva la fila con `deleted_at`, su historial y auditoría. Los listados excluyen la fila marcada; los registros sembrados conservan su identificador para evitar su reinserción al reiniciar.
- API del propietario: `PATCH /api/operational-agenda/items/:id/details`, `DELETE /api/operational-agenda/items/:id` y `PATCH`/`DELETE /api/commitments/:id`. Se validan sesión, origen, campos y el título exacto del registro antes del borrado.
- Se verificó por `tools/list` que producción ofrece `synapse_update_task`, `synapse_delete_task`, `synapse_update_commitment` y `synapse_delete_commitment`. Estas operaciones requieren alcance de escritura y respetan los dominios configurados; comparten las validaciones con la API de Agenda.
- El contexto de coordinación de Lucía incluye las herramientas nuevas y pide comprobar ID/título, ejecutar el borrado ante instrucción explícita de Diego y comunicarlo solo después de una respuesta de éxito.

### Borrado realizado y verificado

- Borrada de los listados: “Grabar video de verificación para permiso faltante de Instagram en Facebook Developers”, ID `876d2cc7-3b4d-49fb-86a5-a1466b331080`.
- Conservada: “Grabar video faltante permiso mensajes de Instagram”, ID `dbbc7974-ec06-4819-9d4f-5d8217fc8f4c`.
- Se usó `synapse_delete_commitment`. La respuesta confirmó `deleted: true`; la consulta posterior confirmó que la duplicada no aparecía y que todos los datos del compromiso conservado coincidían exactamente con los anteriores al borrado.

### Verificación técnica y despliegue

- Nueve pruebas de integración y seguridad aprobadas: permisos, validación de fechas, aprobación, comprobación de título, conservación del registro indicado, historial y persistencia del borrado tras reinicio.
- `npm run server:check`, `npm run build` y `git diff --check`: correctos en el cambio implementado.
- Revisión visual local en escritorio y móvil de 390 × 844. Se corrigió el ciclo de foco de los diálogos durante el guardado.
- El despliegue anterior de `4e14e08` falló porque Coolify invocaba `server/healthcheck.mjs` y el archivo no estaba incluido. `c6a8e82` incorpora ese comprobador Node de `/api/health`; su ejecución local devolvió código 0 y el despliegue posterior terminó con `Success`.
- La implementación se publicó desde una copia aislada dentro de `VERTICE DMENTE/.synapse-task-edit`; los cambios de seguridad preparados en el checkout original no se incluyeron en este despliegue.

### Seguridad y sincronización desplegadas el 2 de octubre de 2026

- El PR #6 se integró a `main` con el commit `b950cd3aa87ed6d9ec575e2ef137acbd7cf1c088` (`security: harden Synapse and sync Hermes calendar events`). Incluye el endurecimiento de Synapse y soporte MCP para compromisos de cronjobs con `externalId` estable e idempotencia.
- Coolify reportó despliegue `Success`; el servicio quedó `Running` y el healthcheck `healthy`.
- Diego actualizó `SYNAPSE_OWNER_PASSWORD` y `SYNAPSE_SESSION_SECRET` en Production. La interpolación de Coolify de la clave de sesión quedó en modo `Literal` para conservar caracteres `$`. Los valores secretos no se almacenan en este archivo.
- `/api/auth/session` respondió `configured: true`, `authenticated: false`. No se ha comprobado un login real, MFA individual ni todos los permisos RBAC en producción.
- El consumidor MCP puede llamar `synapse_create_commitment` con un `externalId` estable para reutilizar/actualizar el compromiso en lugar de duplicarlo. El soporte Synapse está desplegado; no se verificó que el cronjob real de Hermes en la VPS llame a esa herramienta ni que los eventos aparezcan de extremo a extremo en Agenda.
- Las pruebas de integración, chequeo TypeScript, build y `git diff --check` pasaron antes de integrar el PR, según el registro de esa implementación. No se ejecutó una nueva suite contra producción durante esta actualización.

### Decisiones, límites y siguiente acción

- Se mantiene el historial mediante borrado lógico. Este cambio no incluye una interfaz de restauración.
- No se modificó el compromiso más nuevo ni se borraron otras tareas de títulos parecidos.
- La disponibilidad de las herramientas MCP y el borrado real están verificados. No se probó una conversación natural en la que Lucía o Secretaria ejecutara una edición o un borrado, ni la interacción de teclado de los diálogos en producción.
- Para desplegar por terminal, el token local de Coolify carece del permiso `deploy`; las conexiones SSH probadas fueron rechazadas. Diego inició el despliegue desde Coolify. Esto no bloquea las funciones ya desplegadas.
- Siguiente comprobación pendiente: solicitar a Lucía una edición autorizada de una tarea concreta y verificar su resultado por API. No crear ni borrar registros de prueba en producción sin una instrucción concreta.
- Antes de publicar otros cambios desde el checkout original, sincronizarlo con `main` en `b950cd3` y preservar cualquier cambio local no integrado.
- La autorización de esta sesión cubrió el despliegue y el borrado del ID indicado; no quedan aprobaciones pendientes para ese borrado.

## Completado

- Integración Hermes por API y respuestas de LuciaBot en Synapse - Completado 2026-09-25
  Qué: Hermes responde dentro de las solicitudes; `synapse_reply_to_request` disponible en el MCP.
  Estado: Verificado en producción (`hermesReachable: true`).
- Integración con Obsidian - Completado 2026-09-25
  Qué: Las solicitudes guardan referencias a notas de Obsidian, estado local y carpeta de Drive.
  Estado: Listo para usar.
- App móvil instalable (PWA) con branding - Completado 2026-09-26
  Qué: Manifest, iconos y service worker (la caché excluye `/api/` y `/mcp`).
  Estado: Listo para usar.
- MCP local `synapse-bridge` - Completado 2026-09-26
  Qué: Proyecto Node/TS en `HERRAMIENTAS\synapse-bridge-mcp` con 6 herramientas. `synapse_register_project_state` actualiza la solicitud PMO activa o crea una, sin duplicar. Registrado en Claude Desktop y Claude Code. Regla global: al actualizar cualquier `PROYECTO_ESTADO.md` se registra en Synapse. Solo acciones internas.
  Estado: Funciona; token verificado contra producción.

- Agenda Operativa - Desplegada 2026-09-28
  Qué: vista Hoy, Mañana, Esta semana, Atrasadas, Calendario y Kanban; filtros por dominio, proyecto, agente, prioridad y estado; aprobación registrada; creación de tareas; animaciones de personajes por estado de trabajo y soporte para movimiento reducido.
  Estado: Coolify reportó `Success` para el commit `8995e2f`. La portada pública muestra el acceso protegido y `https://synapse.dmentedigital.co/api/health` respondió `ok: true`. La validación autenticada de las vistas y del formulario en producción sigue pendiente.
  Verificación local: `npm run build` y `npm run server:check` pasaron; la API en base temporal creó una tarea con aprobación y fechas. La automatización de navegador local no confirmó la persistencia de las fechas introducidas desde el formulario, por lo que se debe comprobar manualmente en Synapse.

- Estabilidad de Agenda y Solicitudes - Desplegada 2026-09-28
  Qué: `eb7e14d` ajustó la navegación móvil de Agenda; `5401ef8` añadió protección ante fallos de render en Agenda; `46f728e` añadió protección ante fallos de render en Solicitudes.
  Estado: Diego compartió capturas de Coolify con los tres despliegues exitosos y reportó que aparentemente está bien. Falta una ronda de validación autenticada completa en el teléfono.

- Enrutamiento de solicitudes a Marketing - Revisado 2026-09-28
  Qué: las solicitudes se guardan en el chat/área activa y el enrutador puede asignar el área Marketing por el contenido. El backend envía a Hermes la asignación como contexto.
  Estado actual: Hermes responde mediante la identidad general LuciaBot; no se verificó que los especialistas tengan runtimes separados. El indicador “LuciaBot está trabajando” identifica al orquestador visible, no demuestra por sí solo qué especialista ejecuta el trabajo.
  Comportamiento deseado por Diego: al iniciar desde Marketing, Lucia debe revisar la solicitud, usar JEV como mecanismo de evaluación/delegación indicado por Diego, asignarla al especialista correspondiente y presentar la respuesta de ese especialista en el mismo chat. Si la tarea no corresponde a Marketing, Lucia debe redirigirla al área adecuada. El contrato exacto de JEV y la ejecución autónoma de especialistas quedan por confirmar e implementar.

- Estado de Dmente Synapse sincronizado a Drive - 2026-09-28
  Qué: contenido completo actualizado en el archivo canónico `ESTADO PROYECTO DMENTE SYNAPSE.md`, conservando su ID y enlace.
  Estado: archivo canónico actualizado y verificado en `ESTADOS DE PROYECTOS`; la conexión de Hermes a la carpeta no se ha comprobado.

- Primera tanda de endurecimiento de seguridad - Local, 2026-09-28
  Qué: sesiones HMAC con cookie Secure en producción; MFA TOTP configurable; limitación local de intentos de login y tasa de API; verificación de origen para cambios con cookies; límites y validación de JSON; cabeceras HTTP; CORS sin autorización de origen cruzado; protección de `/api/profile` y `/api/agents`; sanitización de errores; auditoría con resumen sustituido por hash y triggers contra UPDATE/DELETE; scopes separados de lectura/escritura MCP; aprobación forzada para solicitudes MCP; instrucción de tratamiento de contenido externo no confiable para LuciaBot; CI y configuración semanal de Dependabot.
  Verificación local: `npm test` (6 pruebas), `npm run server:check`, `npm run build` y `npm audit --audit-level=high` pasaron. Prueba HTTP local: API privada sin sesión devolvió 401, origen cruzado devolvió 403, login válido creó cookie HttpOnly firmada y health público no reveló estado de Hermes. Se añadieron workflow de CI y configuración semanal de Dependabot para cuando los cambios se integren a GitHub.
  Límite: cambios locales sin despliegue; rate limits y sesiones viven en memoria, por lo que requieren validar configuración de proxy y persistencia antes de producción. La instrucción anti-inyección no sustituye clasificación formal de fuentes ni red-team.
  Detalle y pasos de configuración: `SEGURIDAD_IMPLEMENTACION.md`.

## Completado recientemente — Ajuste de archivos de estado y despliegue del lector

- **Rama `feat/project-state-fase` cargada y verificada:** el bundle `entrega_archivos_de_estado_2026-10-06.bundle` agregó exactamente un commit sobre `67e0330`: `0d45327` (`feat: read "Fase:" as the general status of a status file`). La diferencia fue de un archivo y una línea modificada.
- **Integración Git:** `main` recibió el commit mediante fast-forward y se subió a GitHub.
- **Coolify:** se verificó el despliegue del commit `0d453272213920a72da58ef1e8ae4457a296e3f6`. El build terminó, el healthcheck `node /app/server/healthcheck.mjs` devolvió 0, el contenedor nuevo quedó saludable y el anterior fue retirado.
- **Archivos de estado reorganizados sin inventar información:** A de Dra. Vianeth quedó como archivo vigente; B conserva su contenido con referencia a A y el mismo `projectId`. El archivo más reciente de Can & Friends conserva la fuente vigente y quedó asociado a `can-friends-grooming-studio`. El archivo más reciente del Diplomado conserva como vigente el estado del 28 de septiembre y recibió contexto histórico no contradictorio. Vocero e Instagram recibieron sus identificadores de Synapse.
- **Identificadores agregados o corregidos:** `dra-vianeth`, `can-friends-grooming-studio`, `corpav-diplomado-steam-ia`, `circulo-vocero-vibe-community` e `instagram-saas-app-review`.
- **Simulación de sincronización:** el comando solicitado produjo exactamente 22 proyectos a partir de 34 archivos encontrados. No apareció `marca-personal-dra-vianet`; los duplicados de Can & Friends y Diplomado se deduplicaron por `projectId` y se seleccionaron los archivos más recientes.
- **Sincronización real completada:** se cargaron los 22 estados en `https://synapse.dmentedigital.co` usando el token configurado. Resultado: 16 `CREADO`, 6 `ACTUALIZADO`, 0 `SIN CAMBIOS` y 0 `ERROR`.
- **Cierre de proyecto:** `pastor-perinan-escuela-biblica` quedó en estado `completado` mediante MCP con el comentario: “Proyecto terminado. Si se abre uno nuevo con el pastor, será un proyecto aparte.”

## En progreso

- Integración de leads de la landing: código y vista local terminados; pendiente configurar n8n y Coolify, revisar rama, desplegar con autorización y verificar el flujo completo.
- Comprobar una edición autorizada mediante conversación con Lucía o Secretaria y la interacción de los formularios en producción. Las cuatro herramientas están disponibles; el borrado del compromiso indicado está verificado por API.

- Validación funcional autenticada de Agenda y Solicitudes en producción, incluyendo comprobación de la 2FA reportada por Diego y permisos por rol.
  Qué: comprobar en móvil navegación, carga de vistas, filtros y creación de tareas/solicitudes con sesión real.
  Nota: los despliegues recientes son exitosos según las capturas compartidas por Diego; falta confirmar el recorrido completo y persistencia de fechas.
- Confirmar que Hermes puede leer la carpeta compartida de estados de Drive.
- Definir e implementar el ciclo de delegación Lucia/JEV/especialistas: revisión, selección del agente ejecutor, respuesta en el chat de origen y señalización visible de quién responde.
- Completar la revisión de seguridad. El código RBAC/MFA/scopes está integrado y desplegado, pero faltan pruebas funcionales de MFA/login y permisos en producción; migrar clientes MCP a tokens dedicados; validar proxy/rate limit/CSP desde fuera; confirmar backups cifrados y ensayar restauración; configurar monitoreo, exportación remota de auditoría y pruebas red-team. Confirmar si Coolify dispone de staging y las protecciones de infraestructura necesarias.
- Configurar/verificar en Hermes/VPS la llamada a `synapse_create_commitment` para cada cronjob que deba aparecer en Agenda, con `externalId` estable; probar un evento futuro y su repetición para validar que no se duplica.

## Pendiente

- Prueba de escritura de aceptación (`test-claude-synapse`) y registro de un proyecto real (`circulo-vocero-vibe-community`).
- Fase 3-4 del puente: detección automática de `PROYECTO_ESTADO.md`, vista por proyecto y tablero por agente en Synapse.

---

## Próximos pasos

Prioridad nueva: preparar la integración de leads según la sección del 3 de octubre; mantener el despliegue pendiente de autorización.
1. Verificar con un cronjob de prueba que Hermes/VPS llama `synapse_create_commitment` con `externalId` estable y que el evento aparece en Agenda sin duplicarse al repetirlo.
2. Revisar el contrato de JEV y diseñar/probar el ciclo Lucia → especialista → respuesta en chat.
3. Validar en staging proxy, cookies, rate limits y cabeceras antes de desplegar cambios de seguridad.
4. Confirmar cuenta y entorno de la 2FA reportada por Diego; validar login y MFA individual en producción; migrar clientes MCP a tokens separados de lectura/escritura y probar permisos por dominio.
5. Definir backups cifrados y ejecutar una restauración en staging.
6. Completar pruebas red-team para entradas no confiables y evaluar monitoreo/alertas.
7. Confirmar acceso de Hermes a la carpeta de estados de Drive.
8. Correr pruebas de aceptación del puente y registrar el primer proyecto real.
9. Reiniciar Claude Desktop / sesiones de Claude Code para que carguen `synapse-bridge`.

---

## Synapse

projectId: dmente-synapse
sourcePath: C:\Users\diego\Documents\DIEGOSAN\PROYECTO D MENTE DIGITAL\DMENTE SYNAPSE\PROYECTO_ESTADO.md
obsidianNote:
sourceDriveFolder: https://drive.google.com/drive/folders/156DKmGKqakCACN-2Or6kGIdo1ZJ2685K
sourceDriveFile: https://drive.google.com/file/d/14A5w3dNyneZLKdNj7im-PtlqUGxcPCNT/view?usp=drivesdk

agentes:
- pmo: coordinación, estado y prioridades
- tecnico: web, automatizaciones, tracking, integraciones

bloqueoPrincipal: Para uso con clientes faltan verificación de proveedores y región, supresión y respaldos, aislamiento entre clientes, prueba operativa de representación parental, validación WCAG completa y revisión jurídica. En producción se confirmó el commit y las páginas públicas, pero faltan pruebas autenticadas de los flujos nuevos, proyectos, MCP, Hermes, MFA/RBAC y restauración.
proximaAccion: Probar los flujos nuevos con sesión autorizada; verificar proveedor y cadena de Hermes, acordar y probar supresión y restauración, medir accesibilidad y revisar textos legales antes de abrir el acceso a clientes.
requiereAprobacion: no
