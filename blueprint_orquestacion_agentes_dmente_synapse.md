# Blueprint — Orquestación de agentes en Dmente Synapse

**Fecha:** 2026-09-23  
**Proyecto:** Dmente Synapse  
**Estado:** propuesta estructural inicial  
**Objetivo:** definir cómo LuciaBot puede orquestar agentes especializados para operar Dmente Digital y apoyar la organización personal y familiar de Diego.

---

## 1. Idea central

Dmente Synapse debe funcionar como una **oficina de agentes IA coordinada por LuciaBot**.

LuciaBot no reemplaza a todos los agentes. LuciaBot actúa como:

- directora de tráfico;
- coordinadora de contexto;
- supervisora de seguridad;
- puente entre Diego y los agentes;
- filtro antes de cualquier acción externa.

Cada agente tiene un área clara, herramientas permitidas y tipo de decisiones que puede preparar.

La lógica clave es:

```text
Diego pide algo
→ LuciaBot entiende intención, dominio y contexto
→ LuciaBot elige agente o varios agentes
→ agentes consultan herramientas/contexto permitido
→ agentes devuelven propuesta, hallazgo o borrador
→ LuciaBot consolida
→ Diego aprueba acciones externas
→ LuciaBot ejecuta o programa
```

---

## 2. Regla de control humano

Ningún agente debe ejecutar acciones externas sensibles sin aprobación explícita de Diego.

Requieren aprobación:

- enviar WhatsApp a clientes/prospectos;
- enviar correos externos;
- activar, pausar o editar campañas Meta Ads;
- modificar producción/Coolify;
- tocar repositorios de clientes;
- cambiar webhooks;
- publicar contenido;
- crear gastos o consumir presupuesto publicitario;
- usar credenciales o secretos nuevos.

Los agentes pueden preparar análisis, borradores, listas, reportes y recomendaciones.

---

## 3. LuciaBot como orquestadora principal

### Responsabilidades

LuciaBot mantiene el estado general de la operación:

- entiende qué proyecto menciona Diego;
- busca el estado maestro correspondiente;
- clasifica la tarea por área;
- llama al agente adecuado;
- consolida respuestas;
- evita duplicar archivos o estados;
- mantiene bitácoras;
- pide aprobación cuando hay efecto externo;
- resume para Diego en lenguaje ejecutivo.

### Entradas

- mensajes de Diego;
- documentos recibidos;
- capturas;
- archivos de proyecto;
- datos de herramientas;
- estados maestros en `/home/diego/proyectos/`.

### Salidas

- respuesta ejecutiva a Diego;
- documentos internos `.md`;
- borradores de WhatsApp/correo;
- planes de acción;
- alertas;
- tareas programadas;
- solicitudes de aprobación.

---

## 4. Agente de Marketing

### Propósito

Gestionar campañas, métricas, audiencias, anuncios, contenidos y atribución.

### Proyectos típicos

- Can & Friends;
- Vértice;
- More Products;
- Medigan/Básculas;
- campañas de Dmente;
- DBVloggers;
- clientes con Meta Ads.

### Herramientas/conectores ideales

- MCP de Meta Ads;
- MCP de Meta Developers;
- MCP de WhatsApp Business Tools;
- Google Analytics 4;
- Microsoft Clarity;
- Google Search Console;
- Google Sheets;
- Drive;
- repos de landing pages;
- reportes internos `.md`.

### Tareas

- revisar KPIs de campañas;
- detectar discrepancias Meta Ads vs GA4;
- revisar estado de campañas, ad sets y anuncios;
- preparar reportes de avance;
- proponer ajustes de copy, CTA, audiencia o presupuesto;
- revisar errores de Meta Ads;
- analizar comentarios o señales de clientes;
- preparar mensajes de seguimiento para clientes;
- alimentar dashboards o archivos KPI.

### Límites

No puede activar, pausar, editar o publicar campañas sin aprobación de Diego.

### Ejemplo de flujo

```text
Diego: revisa Can & Friends
LuciaBot → Agente Marketing
Marketing consulta estado, Meta Ads, GA4, Clarity
Marketing devuelve hallazgos
LuciaBot consolida: qué cambió, qué preocupa, qué recomienda
Diego aprueba o decide
LuciaBot ejecuta/documenta
```

---

## 5. Agente de WhatsApp / Conversaciones

### Propósito

Atender, clasificar y preparar respuestas para conversaciones de WhatsApp.

### Conectores ideales

- WhatsApp Cloud API oficial;
- Vértice CloudAPI/Coexistence;
- n8n;
- CRM Vértice;
- Google Sheets;
- historial de conversaciones autorizado.

### Tareas

- clasificar mensajes entrantes;
- detectar prospectos;
- responder con tono profesional cuando sea seguro;
- pedir datos faltantes;
- pasar casos delicados a humano;
- preparar borradores de respuesta;
- registrar leads;
- vincular conversaciones con campañas;
- detectar urgencias.

### Límites

- No enviar mensajes externos sin reglas de WhatsApp y aprobación cuando aplique.
- No revelar información interna.
- No responder como Diego.
- No enviar comandos, logs ni mensajes técnicos a clientes.

### Tipos de clasificación

- prospecto nuevo;
- cliente activo;
- soporte;
- proveedor;
- spam;
- mensaje sensible;
- oportunidad comercial;
- requiere Diego;
- requiere Tania/Rackell;
- requiere agendar reunión.

---

## 6. Agente Administrativo

### Propósito

Coordinar agenda, reuniones, llamadas, recordatorios y seguimiento operativo.

### Herramientas/conectores ideales

- Google Calendar de Dmente;
- calendario personal de Diego cuando aplique;
- Gmail/Outlook;
- Google Meet/Zoom;
- Drive;
- tareas programadas de Hermes;
- notas de proyectos.

### Tareas

- crear eventos de calendario;
- cruzar disponibilidad;
- preparar agenda de reunión;
- generar minutas;
- recordar próximos pasos;
- programar seguimientos;
- mantener pendientes por cliente;
- preparar checklist antes de reuniones;
- avisar a Diego de reuniones críticas.

### Límites

- No invitar externos sin confirmación cuando falten datos.
- No mover reuniones sensibles sin aprobación.
- No crear eventos ambiguos sin confirmar hora/personas.

### Ejemplo

```text
Diego: agenda revisión con Luisa el viernes
LuciaBot → Administrativo
Administrativo revisa calendario
Prepara evento + borrador de invitación
LuciaBot pide confirmación si faltan correo/hora
```

---

## 7. Agente de Ventas / CRM

### Propósito

Gestionar oportunidades comerciales, seguimiento de prospectos, propuestas y pipeline.

### Herramientas/conectores ideales

- CRM Vértice;
- Google Sheets;
- Gmail;
- WhatsApp autorizado;
- Drive;
- documentos de propuesta;
- estados de clientes.

### Tareas

- registrar prospectos;
- crear oportunidad;
- clasificar etapa comercial;
- preparar seguimiento;
- generar propuesta base;
- identificar próximo paso;
- alertar oportunidades frías;
- resumir llamadas comerciales;
- alimentar forecast sencillo.

### Etapas sugeridas

1. Nuevo contacto.
2. Calificado.
3. Reunión agendada.
4. Diagnóstico realizado.
5. Propuesta enviada.
6. Negociación.
7. Ganado.
8. Perdido.
9. En pausa.

### Límites

No enviar propuestas, precios finales o compromisos comerciales sin revisión de Diego.

---

## 8. Agente Técnico / Desarrollo

### Propósito

Apoyar desarrollo de apps, integraciones, despliegues, bugs y QA.

### Herramientas/conectores ideales

- GitHub;
- terminal;
- Coolify;
- Docker;
- Cloudflare;
- repos locales;
- Ampere Core;
- Vercel cuando aplique;
- logs de producción.

### Tareas

- inspeccionar repos;
- crear planes técnicos;
- correr builds y pruebas;
- revisar errores;
- preparar PRs;
- verificar despliegues;
- documentar cambios;
- coordinar subagentes Codex/Claude/OpenCode si conviene.

### Límites

No tocar producción, webhooks, pagos, campañas ni clientes sin aprobación.

### Uso de Ampere Core

Para apps nuevas o refactors grandes:

```text
/onboarding → /check → /plan → /build → /audit → /ship
```

Antes de publicar:

```bash
ampere detach
```

---

## 9. Agente Legal / Riesgo

### Propósito

Analizar riesgos de contratos, datos personales, cumplimiento, promesas comerciales y mensajes sensibles.

### Tareas

- revisar contratos;
- detectar promesas riesgosas;
- revisar términos de campañas;
- sugerir lenguaje seguro;
- revisar protección de datos;
- advertir riesgos de manejo de secretos;
- validar si una propuesta suena a asesoría regulada.

### Límites

No sustituye asesoría legal formal. Entrega análisis preventivo y lenguaje prudente.

---

## 10. Agente de Finanzas / Facturación

### Propósito

Apoyar cuentas de cobro, facturas, recibos, control de pagos y rentabilidad básica.

### Herramientas/conectores ideales

- Google Sheets;
- Drive;
- Gmail;
- herramientas de facturas/recibos;
- archivos Excel;
- estados de clientes.

### Tareas

- registrar pagos;
- preparar cuentas de cobro;
- extraer datos de facturas;
- actualizar estados de cobro;
- calcular rentabilidad básica;
- recordar pagos pendientes;
- preparar reportes mensuales.

### Límites

No mover dinero, no ingresar datos bancarios sensibles, no pagar cuentas, no enviar facturas sin aprobación.

---

## 11. Agente de Proyectos / PMO

### Propósito

Mantener orden de proyectos, pendientes, bitácoras, riesgos y próximos pasos.

### Herramientas/conectores ideales

- archivos `.md` en `/home/diego/proyectos/`;
- Drive;
- GitHub Issues;
- Google Calendar;
- cron jobs de seguimiento;
- memoria externa de pendientes.

### Tareas

- mantener estados maestros;
- fusionar documentos sin perder información;
- crear backups antes de cambios;
- detectar duplicados;
- ordenar pendientes por urgencia;
- preparar resumen semanal por cliente;
- asegurar que cada proyecto tenga próxima acción.

---

## 12. Mapa de agentes inicial para Synapse

| Agente visual | Rol operativo real | Prioridad |
|---|---|---:|
| Secretaria | Administrativo + agenda + comunicaciones seguras | Alta |
| Marketing | Campañas, Meta, GA4, Clarity, contenidos | Alta |
| Ventas | CRM, oportunidades, propuestas, seguimiento | Alta |
| Legal | Riesgo, contratos, cumplimiento, lenguaje seguro | Media |
| LuciaBot | Gerente, orquestación y prioridades globales | Alta |

Agentes futuros recomendados:

| Agente futuro | Rol |
|---|---|
| Técnico | Desarrollo, repos, Coolify, QA, integraciones |
| Finanzas | Cobros, facturas, pagos, rentabilidad |
| PMO | Estados, bitácoras, pendientes, control de proyectos |
| Research | Investigación de mercado, benchmarks, oportunidades |

---

## 13. Arquitectura lógica propuesta

```text
Frontend Synapse
  ├─ Oficina visual de agentes
  ├─ Chat por agente
  ├─ Panel de solicitudes
  ├─ Panel de aprobaciones
  └─ Panel de proyectos

Backend Synapse
  ├─ API Node.js
  ├─ SQLite
  ├─ Cola de tareas
  ├─ DecisionService
  │  ├─ Reglas deterministas locales
  │  ├─ Proveedor JEV opcional
  │  └─ Fallback LuciaBot / revisión manual
  ├─ Motor de permisos
  ├─ Registro de auditoría
  └─ Conectores MCP/API

Orquestador LuciaBot
  ├─ Clasificador de intención
  ├─ Selector de agente
  ├─ Cargador de contexto del proyecto
  ├─ Consolidador de respuestas
  ├─ Gestor de aprobaciones
  └─ Ejecutor seguro

Conectores
  ├─ Meta MCP
  ├─ WhatsApp Business / Vértice
  ├─ Google Workspace
  ├─ Gmail / Outlook
  ├─ Calendar
  ├─ Drive
  ├─ GitHub
  ├─ Coolify
  ├─ n8n
  └─ Composio
```

---

## 14. Modelo mínimo de datos

### Proyecto

```ts
type Project = {
  id: string
  name: string
  client?: string
  status: 'active' | 'paused' | 'blocked' | 'done'
  canonicalStatePath: string
  owner: string
  nextAction?: string
  updatedAt: string
}
```

### Agente

```ts
type Agent = {
  id: string
  name: string
  role: string
  allowedTools: string[]
  blockedActions: string[]
  defaultProjects?: string[]
}
```

### Solicitud

```ts
type Request = {
  id: string
  projectId?: string
  agentId: string
  title: string
  status: 'pending' | 'in_progress' | 'waiting_approval' | 'done' | 'cancelled'
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}
```

### Aprobación

```ts
type Approval = {
  id: string
  requestId: string
  actionType: 'send_message' | 'send_email' | 'modify_campaign' | 'deploy' | 'edit_repo' | 'schedule' | 'other'
  destination?: string
  preview: string
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  approvedBy?: 'Diego'
  approvedAt?: string
}
```

### Evento de auditoría

```ts
type AuditEvent = {
  id: string
  projectId?: string
  agentId?: string
  action: string
  summary: string
  source: string
  createdAt: string
}
```

### Evento de decisión

```ts
type DecisionEvent = {
  id: string
  requestId?: string
  provider: 'local' | 'jev' | 'llm' | 'manual'
  decisionType: 'route' | 'risk_gate' | 'lead_score' | 'context_filter'
  inputSummary: string
  output: unknown
  confidence?: number
  latencyMs?: number
  costUsd?: number
  accepted: boolean
  overriddenBy?: 'LuciaBot' | 'Diego'
  createdAt: string
}
```

---

## 15. Flujo operativo por solicitud

```text
1. Diego escribe una instrucción.
2. LuciaBot detecta dominio, proyecto o área personal, intención y riesgo.
3. LuciaBot carga el estado autorizado correspondiente.
4. LuciaBot decide agente responsable.
5. El agente produce análisis o borrador.
6. LuciaBot revisa si hay efecto externo.
7. Si hay efecto externo: muestra preview y pide aprobación.
8. Si Diego aprueba: ejecuta.
9. LuciaBot documenta el resultado en el estado correspondiente.
10. Si aplica: crea recordatorio o próxima medición.
```

---

## 16. Ejemplos por área

### Marketing — Can & Friends

```text
Entrada: “revisa Can & Friends”
LuciaBot carga estado_can_friends.md y KPI.
Marketing revisa Meta Ads, GA4 y Clarity.
Devuelve: cambios, alertas, discrepancias y recomendación.
LuciaBot resume y pide aprobación antes de tocar campaña.
```

### Administrativo — llamada con cliente

```text
Entrada: “agenda reunión con Luisa el viernes”
Administrativo revisa calendarios.
Si falta hora o correo, pregunta.
Si está claro, crea evento y Meet.
Documenta en estado del proyecto.
```

### Ventas — More Products

```text
Entrada: “haz seguimiento a Fabián”
Ventas carga estado_more_products.md.
Prepara correo o WhatsApp seguro.
LuciaBot muestra preview.
Diego aprueba.
LuciaBot envía y documenta.
```

### Técnico — Vértice

```text
Entrada: “verifica Vértice”
Técnico revisa repo, build, Coolify/logs si está aprobado.
No despliega sin aprobación.
Devuelve evidencia real.
LuciaBot documenta.
```

---

## 17. Prioridad de implementación recomendada

### Fase 1 — Orden interno

- Persistencia SQLite.
- Modelo de proyectos.
- Modelo de agentes.
- Historial de solicitudes.
- Aprobaciones manuales.
- Lectura de estados `.md` locales.
- Interfaz `DecisionProvider` agnóstica.
- Proveedor local determinista para enrutamiento y riesgo.

### Fase 2 — Operación real controlada

- Conectar Calendar.
- Conectar Gmail/Drive.
- Conectar CRM/Vértice.
- Conectar Meta en modo lectura.
- Panel de previews/aprobaciones.
- Prueba controlada de JEV en modo sugerencia, si se dispone de una API key válida.

### Fase 3 — Agentes ejecutores

- Marketing con Meta/GA4/Clarity.
- Administrativo con Calendar/Gmail.
- Ventas con CRM/WhatsApp autorizado.
- Técnico con GitHub/Coolify en modo seguro.

### Fase 4 — Automatización parcial

- Cron jobs de monitoreo.
- Alertas por cambios relevantes.
- Reportes semanales.
- Seguimientos sugeridos.

### Fase 5 — Automatización avanzada

- Ejecución condicionada por aprobaciones.
- Workflows multiagente.
- Memoria por cliente/proyecto.
- Dashboard ejecutivo.

---

## 18. Reglas de seguridad

- Chat no es gestor de secretos.
- Secretos solo en `.env`, Coolify secrets, OAuth o gestor seguro.
- WhatsApp/correo externo siempre con preview y aprobación.
- Producción siempre con aprobación.
- Campañas siempre con aprobación.
- Repos de clientes siempre con diff/revisión.
- No exponer datos internos de clientes a otros clientes.
- No inventar métricas ni resultados.
- Documentar cada acción relevante.
- Las claves de proveedores de decisión permanecen únicamente en el backend.
- Enviar a servicios de decisión externos solo el contexto mínimo necesario.
- Una decisión de JEV nunca sustituye una regla determinista de aprobación obligatoria.

---

## 19. Criterio de éxito

Synapse será útil cuando Diego pueda escribir algo como:

```text
LuciaBot, revisa los proyectos activos y mis compromisos personales y dime qué necesita atención hoy.
```

Y el sistema pueda responder con:

- campañas con alertas;
- reuniones pendientes;
- seguimientos comerciales;
- clientes bloqueados;
- tareas técnicas;
- riesgos legales;
- próximos pasos sugeridos;
- acciones que requieren aprobación.

---

## 20. Decisión conceptual

Dmente Synapse debe construirse como una **capa de operación interna de Dmente Digital**, no como un simple chatbot.

La pantalla de agentes debe representar áreas reales de la empresa, y cada agente debe tener:

- rol claro;
- herramientas permitidas;
- límites explícitos;
- relación con proyectos;
- capacidad de generar solicitudes;
- obligación de pasar por LuciaBot para acciones externas.

---

## 21. Capa de decisiones tipadas y JEV

### Propósito

Synapse tendrá una capa de decisiones pequeñas y estructuradas para:

- enrutar solicitudes hacia el agente adecuado;
- puntuar urgencia;
- evaluar riesgo antes de una acción;
- calificar prospectos;
- filtrar contexto operativo.

Esta capa no redacta respuestas, no conversa con Diego y no sustituye a LuciaBot. LuciaBot conserva la responsabilidad de consolidar contexto, razonar, explicar y controlar acciones externas.

### Contrato agnóstico

```ts
interface DecisionProvider {
  routeRequest(input: RouteInput): Promise<RouteDecision>
  riskGate(input: RiskInput): Promise<RiskDecision>
  qualifyLead(input: LeadInput): Promise<LeadDecision>
  filterContext(input: ContextFilterInput): Promise<ContextFilterDecision>
}
```

Implementaciones previstas:

```text
LocalDecisionProvider   → reglas deterministas iniciales y fallback
JevDecisionProvider     → proveedor externo opcional
ManualDecisionProvider  → intervención de LuciaBot o Diego
```

### Posición en el flujo

```text
Mensaje de Diego
  ↓
DecisionService.routeRequest()
  ↓
LuciaBot valida o corrige la ruta
  ↓
Agente especializado prepara resultado
  ↓
Reglas deterministas de seguridad
  ↓
DecisionService.riskGate() como señal adicional
  ↓
LuciaBot crea aprobación cuando corresponda
  ↓
Diego aprueba o rechaza
```

### Regla de precedencia

```text
Regla determinista de seguridad
  > decisión humana
  > criterio de LuciaBot
  > recomendación del proveedor JEV
```

JEV no puede autorizar por sí mismo:

- mensajes externos;
- campañas;
- despliegues;
- cambios en repositorios de clientes;
- operaciones financieras;
- uso de secretos;
- acciones que el blueprint marque como sujetas a aprobación.

### Configuración del backend

```env
DECISION_PROVIDER=local
JEV_API_KEY=
JEV_BASE_URL=https://jevtypesafeai.com/api/v1
```

El frontend no recibe ni utiliza `JEV_API_KEY`.

### Estrategia de adopción

1. Implementar `LocalDecisionProvider` y pruebas de contrato.
2. Registrar todas las decisiones en `decision_events`.
3. Añadir `JevDecisionProvider` detrás de una bandera de configuración.
4. Ejecutar JEV en modo sombra: su decisión se registra, pero no controla el flujo.
5. Comparar sus resultados con la decisión final de LuciaBot o Diego.
6. Permitir enrutamiento automático únicamente después de medir su comportamiento con casos reales autorizados.
7. Mantener fallback local, timeout corto y circuit breaker.

### Estado de verificación

La integración real con JEV está pendiente. Antes de depender de ella se debe verificar con una API key válida:

- endpoint y esquema reales;
- autenticación;
- latencia;
- costos;
- límites de uso;
- tratamiento de datos;
- estabilidad del servicio;
- comportamiento ante errores y timeouts.

Documento de investigación relacionado:

`investigacion_jev_typesafe_ai_synapse_2026-09-23.md`

---

## 22. Alcance personal y familiar

Dmente Synapse también funcionará como sistema de organización personal y familiar de Diego. Este dominio estará separado de los datos de clientes y de la operación de la agencia.

Áreas iniciales:

- citas médicas y controles de salud;
- eventos del colegio de Lucía, hija de Diego;
- cumpleaños de compañeras y compañeros de Lucía;
- actividades con Lucía: parque, cine, viajes, lectura, ejercicio e iglesia;
- planes y compromisos con la esposa de Diego;
- lectura y proyectos personales;
- ejercicio y hábitos;
- actividades de iglesia;
- apoyo al pastor Periñán con presentaciones;
- prédicas, reuniones y actividades de servicio;
- viajes, fechas familiares y recordatorios importantes.

Lucía es una persona real y es la hija de Diego. Para evitar ambigüedad, la agente orquestadora se llama **LuciaBot** en toda la aplicación y documentación.

### Dominios separados

```ts
type SynapseDomain =
  | 'agency'
  | 'personal'
  | 'family'
  | 'health'
  | 'education'
  | 'church'
  | 'learning'
  | 'wellbeing'
```

Cada solicitud, evento, recordatorio y nota debe indicar su dominio. El sistema no mezclará información personal o familiar con el contexto de clientes salvo instrucción explícita de Diego.

### Agentes personales recomendados

| Agente | Responsabilidad |
|---|---|
| Familia | Colegio, cumpleaños, salidas, viajes y tiempo familiar |
| Bienestar | Citas médicas, ejercicio, lectura y hábitos |
| Iglesia | Agenda de iglesia, prédicas, servicio y apoyo al pastor Periñán |
| Secretaria | Calendarios, recordatorios, eventos y conflictos de agenda |
| LuciaBot | Priorización global entre agencia, familia y vida personal |

Estos agentes pueden ser roles lógicos inicialmente. No requieren un personaje visual independiente para comenzar a operar.

## 23. Fuentes de monitoreo personal

Fuentes solicitadas:

- Google Calendar;
- WhatsApp autorizado;
- notas;
- correo electrónico;
- recordatorios y eventos creados en Synapse.

Flujo previsto:

```text
Calendar / WhatsApp / correo / notas
  ↓
ingesta autorizada
  ↓
clasificación por dominio y persona
  ↓
deduplicación y detección de fechas
  ↓
LuciaBot consolida
  ↓
recordatorio, pregunta o propuesta de evento
  ↓
Diego confirma cuando la acción tenga efecto externo
```

### Reglas de privacidad familiar

- Los datos de Lucía se clasifican como datos personales de una menor.
- Solo se conserva información necesaria para organización familiar.
- No se comparte información familiar con agentes de clientes.
- WhatsApp y correo se conectan inicialmente en modo lectura y con alcance autorizado.
- Enviar mensajes, aceptar invitaciones o modificar eventos de terceros requiere aprobación.
- Los recordatorios internos pueden automatizarse mediante reglas aprobadas por Diego.
- Toda fuente debe registrar cuenta, alcance, última sincronización y error más reciente.

### Entidades mínimas adicionales

```ts
type PersonProfile = {
  id: string
  name: string
  relationship: 'self' | 'daughter' | 'spouse' | 'family' | 'community'
  sensitive: boolean
}

type Commitment = {
  id: string
  domain: SynapseDomain
  title: string
  people: string[]
  source: 'calendar' | 'whatsapp' | 'email' | 'note' | 'manual'
  startsAt?: string
  dueAt?: string
  status: 'captured' | 'planned' | 'confirmed' | 'done' | 'cancelled'
  reminderRuleId?: string
}

type ReminderRule = {
  id: string
  domain: SynapseDomain
  leadTimesMinutes: number[]
  channel: 'synapse' | 'calendar' | 'email'
  enabled: boolean
}
```

Documento de referencia conceptual:

`transcripci_n_y_notas_detalladas.md`
