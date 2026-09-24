# Opciones para conectar Lucía/Hermes con Dmente Synapse

**Fecha:** 2026-09-24  
**Proyecto:** Dmente Synapse  
**Objetivo:** evaluar formas reales para que Lucía/Hermes pueda conectarse con Synapse y orquestar los agentes desde la aplicación.

---

## Estado verificado

Synapse ya responde públicamente por API:

```text
GET https://synapse.dmentedigital.co/api/health
→ {"ok":true,"service":"dmente-synapse-api", ...}

GET https://synapse.dmentedigital.co/api/agents
→ LuciaBot, Legal, Marketing, Secretaria, Ventas
```

Esto confirma que existe una base real para integrar, pero todavía no hay endpoints de puente para Hermes ni MCP.

---

## Recomendación principal

La mejor arquitectura es **bidireccional pero controlada**:

```text
Lucía/Hermes ↔ Synapse API/MCP ↔ SQLite/Agentes/Interfaz
```

Dividido así:

1. **Hermes → Synapse:** mediante un MCP o herramienta para leer/escribir en Synapse.
2. **Synapse → Hermes:** mediante webhook seguro cuando la interfaz necesite activar a Lucía.
3. **Nunca conectar servicios externos directamente sin aprobación:** WhatsApp, correo, Calendar, Meta Ads y Coolify deben pasar por gates de aprobación.

---

## Opción 1 — Synapse como MCP server para Hermes

### Idea

Implementar en Synapse un endpoint MCP, por ejemplo:

```text
https://synapse.dmentedigital.co/mcp
```

Hermes lo registra como servidor MCP HTTP:

```yaml
mcp_servers:
  synapse:
    url: "https://synapse.dmentedigital.co/mcp"
    headers:
      Authorization: "Bearer ${SYNAPSE_MCP_TOKEN}"
```

### Qué herramientas debería exponer

MVP de herramientas MCP:

```text
synapse_get_profile
synapse_list_agents
synapse_list_requests
synapse_get_request
synapse_create_request
synapse_update_request_status
synapse_list_messages
synapse_add_message
synapse_list_commitments
synapse_create_commitment
synapse_audit_event
```

### Ventajas

- Es la vía más limpia para que Lucía use Synapse como herramienta real.
- Encaja con Hermes: los MCP aparecen como herramientas `mcp_synapse_*`.
- Permite permisos por herramienta.
- Puede empezar read-only y luego pasar a escritura.
- Evita que Hermes toque directamente la base SQLite.

### Riesgos

- Hay que implementar protocolo MCP correctamente.
- Requiere token y control de permisos.
- No debe exponer datos personales/familiares sin autenticación fuerte.

### Recomendación

**Esta debe ser la ruta principal para producción.**

---

## Opción 2 — Synapse llama a Hermes por webhook

### Idea

Cuando Diego escribe en Synapse o una solicitud necesita criterio de Lucía, Synapse envía un evento a Hermes:

```text
Synapse → POST /webhooks/synapse-event → Hermes/Lucía
```

Payload sugerido:

```json
{
  "event": "synapse.request.created",
  "source": "dmente-synapse",
  "requestId": "req_123",
  "agentId": "marketing",
  "project": "Can & Friends",
  "text": "Revisar campaña y alertas",
  "requiresExternalAction": false,
  "createdAt": "2026-09-24T10:00:00-05:00"
}
```

### Ventajas

- Muy bueno para alertas y solicitudes desde la interfaz.
- Hermes ya soporta webhooks con HMAC.
- Puede enviar respuesta a Telegram mientras Synapse evoluciona.
- Permite activar a Lucía desde la oficina visual.

### Limitación importante

El webhook nativo de Hermes normalmente responde `202 Accepted`; no devuelve la respuesta final en la misma llamada. Para que Synapse muestre la respuesta de Lucía dentro de la UI se necesita una de estas piezas:

1. callback HTTP Hermes → Synapse;
2. bridge intermedio;
3. polling desde Synapse a una tabla/endpoint de respuestas;
4. usar Telegram como salida temporal.

### Recomendación

**Usarla como complemento de eventos, no como única integración.**

---

## Opción 3 — Synapse llama al API server de Hermes

### Idea

Hermes puede exponerse como backend HTTP compatible con OpenAI. Synapse podría llamar a Hermes como si fuera un proveedor de modelo/agente.

```text
Synapse backend → Hermes API server → Lucía con herramientas
```

### Ventajas

- Synapse podría recibir una respuesta generada directamente.
- Encaja con interfaces tipo chat.
- Permite usar a Lucía como motor detrás de LuciaBot.

### Riesgos

- Es más sensible: Hermes tiene herramientas poderosas.
- No debe exponerse públicamente sin autenticación fuerte.
- Puede generar consumo alto si se llama desde UI sin límites.
- Necesita control de sesiones, rate limits, permisos y auditoría.

### Recomendación

**No usar todavía en producción pública.** Puede probarse solo en red interna o con token fuerte para un laboratorio controlado.

---

## Opción 4 — Herramienta/plugin Hermes que llame la API REST de Synapse

### Idea

Crear una herramienta propia de Hermes o script local que consuma endpoints REST existentes de Synapse:

```text
Lucía → tool synapse_api → https://synapse.dmentedigital.co/api/...
```

### Ventajas

- Es la prueba más rápida.
- No exige implementar MCP completo desde el primer día.
- Permite a Lucía leer agentes/solicitudes y crear mensajes si se agregan endpoints.
- Puede funcionar con un token simple inicialmente.

### Riesgos

- Menos estándar que MCP.
- Si crece demasiado, se vuelve deuda técnica.
- Requiere definir bien permisos y endpoints.

### Recomendación

**Usarla como MVP rápido**, pero con la intención de migrar a MCP.

---

## Opción 5 — Compartir SQLite directamente

### Idea

Montar la base `data/synapse.sqlite` para que Hermes la lea o escriba directamente.

### Ventajas

- Muy rápido localmente.

### Riesgos

- Acopla Hermes a la estructura interna de Synapse.
- Riesgo de corrupción o escrituras inconsistentes.
- Malo para producción/Coolify.
- Rompe límites de permisos.

### Recomendación

**No recomendado.** Solo lectura local temporal, si acaso, para diagnóstico.

---

## Arquitectura recomendada por fases

### Fase 0 — Verificación actual

Ya verificado:

- `/api/health` responde.
- `/api/agents` responde.
- Hay dominio público operativo.

### Fase 1 — Tool REST mínima para Lucía

Agregar endpoints seguros en Synapse:

```text
GET /api/health
GET /api/agents
GET /api/requests
POST /api/requests
PATCH /api/requests/:id
GET /api/messages?agentId=...
POST /api/messages
GET /api/commitments
POST /api/commitments
```

Y crear una herramienta Hermes o script `synapse_api` con token.

Objetivo: que Lucía pueda consultar y registrar información en Synapse sin tocar SQLite.

### Fase 2 — Webhook Synapse → Hermes

Agregar en Synapse:

```text
POST Hermes webhook cuando:
- se crea solicitud;
- se marca algo como requiere aprobación;
- aparece compromiso sensible;
- un agente necesita escalamiento a Lucía.
```

Usar HMAC y `X-Request-ID`.

### Fase 3 — Callback Hermes → Synapse

Agregar endpoint en Synapse:

```text
POST /api/hermes/callback
```

Para guardar en Synapse la respuesta final generada por Lucía.

### Fase 4 — MCP oficial de Synapse

Implementar:

```text
/mcp
```

Con herramientas tipadas y permisos.

### Fase 5 — Motor de LuciaBot

Synapse puede enrutar así:

```text
LuciaBot UI
→ DecisionService local/JEV
→ si requiere razonamiento o herramienta: Hermes
→ respuesta vuelve a Synapse
→ aprobación humana antes de acción externa
```

---

## Seguridad obligatoria

1. Nada de tokens en GitHub, Telegram, Markdown público ni logs.
2. Secretos en Coolify como variables:

```env
SYNAPSE_HERMES_WEBHOOK_SECRET=<redacted>
SYNAPSE_MCP_TOKEN=<redacted>
HERMES_TO_SYNAPSE_TOKEN=<redacted>
```

3. Acciones externas siempre con aprobación:
   - WhatsApp;
   - correo;
   - Calendar;
   - Meta Ads;
   - Coolify;
   - GitHub;
   - datos personales/familiares/médicos.

4. Iniciar read-only siempre que sea posible.
5. Registrar auditoría:

```text
actor, source, action, entity, before, after, approvalId, timestamp
```

---

## Decisión recomendada

Para avanzar sin esperar una arquitectura perfecta:

### Camino recomendado

1. **MVP inmediato:** herramienta REST privada para que Lucía lea/escriba solicitudes básicas en Synapse.
2. **Luego:** webhook Synapse → Hermes para alertas/eventos.
3. **Después:** callback Hermes → Synapse para mostrar respuestas en la UI.
4. **Producción limpia:** convertir Synapse en MCP server HTTP.

### No recomendado ahora

- Conectar Synapse directamente a WhatsApp/correo/Calendar sin approval gates.
- Exponer el API server completo de Hermes públicamente.
- Compartir SQLite como integración principal.

---

## Conclusión

La mejor opción estratégica es que **Synapse sea el tablero operativo y Hermes/Lucía sea el motor de razonamiento/ejecución**.

Synapse debe exponer herramientas controladas. Hermes debe consumirlas con permisos. Cuando Synapse necesite a Lucía, debe disparar un webhook seguro. Cuando Lucía responda, debe devolver la respuesta a Synapse por callback o herramienta.

La primera versión útil no necesita MCP completo: basta una REST tool segura. Pero el destino correcto es MCP HTTP propio de Synapse.

## Implementación aplicada en Synapse

Se implementó la primera versión del camino MCP recomendado:

- endpoint: `POST /mcp`;
- autenticación: `Authorization: Bearer <SYNAPSE_MCP_TOKEN>`;
- negociación inicial JSON-RPC/MCP y listado de herramientas;
- lectura de perfil, agentes, solicitudes, mensajes y compromisos;
- creación controlada de solicitudes, mensajes y compromisos;
- auditoría de escrituras con fuente `hermes-mcp`;
- las solicitudes creadas desde MCP quedan con `requiresApproval: true`;
- no se ejecutan acciones externas desde estas herramientas.

Configuración pendiente en Coolify:

```env
SYNAPSE_MCP_TOKEN=<token_largo_aleatorio>
```

Plantilla de configuración pendiente en Hermes:

```yaml
mcp_servers:
  synapse:
    url: "https://synapse.dmentedigital.co/mcp"
    headers:
      Authorization: "Bearer ${SYNAPSE_MCP_TOKEN}"
```

Esta plantilla está basada en el documento del proyecto. No se ha verificado todavía el formato exacto que acepta la instalación concreta de Hermes de Diego.
