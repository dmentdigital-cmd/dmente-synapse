# Configurar respuestas automáticas de LuciaBot desde Hermes

## Objetivo

Cuando Diego escriba en Synapse:

1. Synapse registra la solicitud.
2. El router asigna dominio, proyecto, prioridad, riesgo y agente.
3. Synapse llama al API Server de Hermes.
4. Hermes ejecuta LuciaBot con sus herramientas autorizadas.
5. La respuesta queda guardada en el mismo chat de Synapse.

Synapse no ejecuta correo, WhatsApp, pagos, campañas ni producción sin aprobación explícita.

## Variables de Synapse en Coolify

```env
HERMES_API_URL=http://DIRECCION_PRIVADA_DEL_HOST:8642/v1
HERMES_API_KEY=<misma_clave_del_API_Server_de_Hermes>
HERMES_API_TIMEOUT_MS=90000
```

No guardar `HERMES_API_KEY` en GitHub ni en archivos Markdown.

## Configuración requerida en Hermes

Archivo de secretos de Hermes:

```text
/home/diego/.hermes/.env
```

Variables requeridas:

```env
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=<clave_hexadecimal_larga>
```

`0.0.0.0` permite que el contenedor de Synapse alcance el servicio dentro de la red privada de la VPS. El puerto no debe publicarse directamente a Internet.

Reiniciar Hermes como usuario `diego`:

```bash
runuser -u diego -- env XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus systemctl --user restart hermes-gateway
```

Comprobar el API Server en la VPS:

```bash
curl http://127.0.0.1:8642/health
```

Resultado esperado:

```json
{"status":"ok"}
```

## Dirección privada del host para Coolify

Consultar la puerta de enlace de la red de Coolify:

```bash
docker network inspect coolify --format '{{(index .IPAM.Config 0).Gateway}}'
```

Usar el resultado en `HERMES_API_URL`. Ejemplo ilustrativo:

```text
http://172.18.0.1:8642/v1
```

No asumir esa dirección. Debe usarse la que devuelva el comando en la VPS.

## Verificación final

Después de guardar las variables en Coolify y hacer redeploy:

1. Abrir LuciaBot en Synapse.
2. Escribir un caso concreto.
3. Confirmar que aparece `LuciaBot está trabajando`.
4. Esperar la respuesta en el mismo hilo.
5. Revisar Solicitudes para comprobar el agente asignado.

El endpoint `/api/health` de Synapse devuelve `hermesAutomaticReplies: true` cuando las variables de conexión están presentes. Esto confirma configuración, no conectividad. La prueba real es recibir la respuesta de Hermes.
