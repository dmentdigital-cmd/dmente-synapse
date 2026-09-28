# Agenda Operativa

La agenda combina solicitudes y compromisos existentes en las vistas Hoy, Mañana, Esta semana, Atrasadas, Calendario y Kanban. Los cambios de estado se guardan en Synapse. Aprobar una tarea registra la aprobación y la pasa a En progreso; no ejecuta acciones externas. Las tareas con aprobación requerida no se pueden marcar como Hecho antes de aprobarlas.

## Acceso y privacidad

La API operativa requiere que Synapse tenga `SYNAPSE_OWNER_PASSWORD` y `SYNAPSE_SESSION_SECRET` configurados, además de una sesión autenticada. Sin esas variables, los endpoints operativos responden con error 503. Las fechas se muestran en la zona horaria `America/Bogota`.

## Checklist manual

- Iniciar Synapse con autenticación configurada e iniciar sesión.
- Abrir **Agenda** y revisar las vistas Hoy, Mañana, Esta semana, Atrasadas, Calendario y Kanban.
- Filtrar por dominio, proyecto, agente, prioridad y estado.
- Crear una tarea con responsable, prioridad y fechas; comprobar que aparezca en la agenda.
- Crear una tarea que requiera aprobación; debe quedar en Esperando aprobación hasta que se apruebe.
- Confirmar que la tarea de salud muestra solo el recordatorio mínimo.
- Intentar marcar como Hecho una tarea que requiere aprobación: debe quedar bloqueada.
- Aprobarla y marcarla como Hecho: la interfaz debe registrar ambos cambios.
- Cambiar una tarea entre Pendiente, En progreso y Bloqueado; confirmar que aparece en la columna correspondiente.
- Abrir la agenda a 390 px de ancho y comprobar que no aparezca desbordamiento horizontal.
- Consultar `/api/operational-agenda` sin sesión: debe responder 401.

## Reversión

Los cambios de esquema son aditivos. Para revertir la versión, detener el servidor y restaurar los archivos del cambio desde Git o desde la copia previa. Las siete filas iniciales tienen IDs `agenda-*` deterministas y se insertan con `INSERT OR IGNORE`. Si también se quiere revertir la carga de datos, restaurar una copia previa de `synapse.sqlite`; conservar las columnas nuevas no afecta el resto de solicitudes ni compromisos.

Las rutas fuente `/home/diego/...` recibidas en las instrucciones se guardan como referencias. Su existencia no se comprobó en este entorno.
