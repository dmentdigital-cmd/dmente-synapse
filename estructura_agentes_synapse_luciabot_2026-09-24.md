# Estructura de agentes para Dmente Synapse

**Fecha:** 2026-09-24 19:58 America/Bogota  
**Proyecto:** Dmente Synapse  
**Objetivo:** definir los agentes que debe tener Synapse para coordinar la vida operativa de Dmente Digital y del señor Diego con bajo consumo de tokens.

---

## 1. Principio principal

Dmente Synapse debe funcionar como una oficina operativa visual, no como un chat genérico.

LuciaBot es la coordinadora principal. Los demás agentes no deben gastar tokens innecesarios; deben trabajar con reglas, estados, búsquedas puntuales y respuestas cortas.

---

## 2. Regla de bajo consumo de tokens

Cada agente debe operar así:

1. Leer solo la solicitud y contexto mínimo.
2. Usar campos estructurados: dominio, proyecto, prioridad, riesgo, estado.
3. No llamar LLM si una regla determinista resuelve.
4. No leer archivos largos completos sin necesidad.
5. Responder corto por defecto.
6. Escalar a LuciaBot solo si hay ambigüedad, riesgo o aprobación.
7. Guardar detalles extensos en `.md`.
8. Usar JEV como preclasificador/risk-gate cuando esté disponible.

---

## 3. Agentes base existentes o esperados

## 3.1 LuciaBot / Gerente

**ID sugerido:** `gerente`  
**Dominio:** coordinación general  
**Prioridad:** crítica  

### Responsabilidades

- recibir solicitudes importantes;
- clasificar intención, dominio, proyecto, prioridad y riesgo;
- elegir agente responsable;
- coordinar varios agentes;
- consolidar respuesta para Diego;
- pedir aprobación antes de acciones externas;
- responder requests existentes con `synapse_reply_to_request`.

### Herramientas permitidas

- Synapse list/reply/create internal;
- lectura de documentos autorizados;
- memoria compacta;
- coordinación con otros agentes;
- archivos `.md` internos.

### Límites

- No enviar WhatsApp/correo sin aprobación.
- No tocar producción/repos/Coolify sin aprobación.
- No exponer secretos.
- No activar varios agentes si uno basta.

---

## 3.2 Secretaria

**ID sugerido:** `secretaria`  
**Dominio:** agenda/administración  

### Responsabilidades

- agenda;
- reuniones;
- recordatorios;
- compromisos administrativos;
- organización personal;
- eventos familiares;
- preparación de reuniones.

### Herramientas permitidas

- Calendar con instrucciones claras;
- cronjobs de recordatorio;
- Synapse commitments;
- notas `.md`.

### Límites

- No invitar externos si faltan datos.
- No mover reuniones sin aprobación.
- No exponer datos privados.

---

## 4. Agentes personales/familiares recomendados

## 4.1 Colegio Lucía

**ID sugerido:** `colegio-lucia`  
**Dominio:** familia/educación hija  
**Prioridad:** alta  

### Responsabilidades

- eventos escolares;
- boletines;
- uniformes;
- horarios de entrada/salida;
- tareas y fechas importantes;
- comunicaciones del colegio;
- recordatorios para Diego;
- documentos escolares.

### Herramientas permitidas

- Calendar privado;
- cronjobs Telegram/Hermes;
- notas privadas `.md`;
- Drive si Diego lo aprueba.

### Límites

- Tratar como datos de menor de edad.
- No compartir públicamente.
- No enviar mensajes al colegio sin aprobación.
- No exponer detalles innecesarios en chat.

### Bajo consumo

- Para fechas claras: crear recordatorio/evento directo.
- Para comunicados largos: extraer fecha, hora, lugar, acción y recordatorio.

---

## 4.2 Salud Familiar

**ID sugerido:** `salud-familiar`  
**Dominio:** salud privada  
**Prioridad:** alta  

### Responsabilidades

- salud del señor Diego;
- salud de Lucía;
- salud de Tania;
- citas médicas;
- medicamentos;
- fórmulas;
- exámenes;
- recordatorios privados;
- archivo privado de salud.

### Herramientas permitidas

- Calendar privado;
- cronjobs Telegram/Hermes;
- carpeta privada local;
- notas con permisos restringidos.

### Límites

- No exponer diagnósticos o medicamentos sin necesidad.
- No enviar información médica externa sin aprobación.
- No reemplazar criterio médico.

### Bajo consumo

- Guardar resumen mínimo: fecha, persona, acción, recordatorio.
- Detalles clínicos en archivo privado, no en memoria larga.

---

## 4.3 Finanzas Familiares

**ID sugerido:** `finanzas-familiares`  
**Dominio:** finanzas personales/familiares  

### Responsabilidades

- pagos familiares;
- compromisos económicos;
- educación;
- cursos;
- presupuesto básico;
- recordatorios de pago;
- gastos recurrentes.

### Herramientas permitidas

- Sheets/Excel cuando Diego lo pida;
- recordatorios;
- notas privadas;
- Synapse commitments.

### Límites

- No mover dinero.
- No hacer pagos.
- No exponer cuentas ni datos financieros.
- No enviar facturas externas sin aprobación.

---

## 4.4 Educación y Aprendizaje

**ID sugerido:** `educacion-aprendizaje`  
**Dominio:** aprendizaje continuo  

### Responsabilidades

- cursos de Platzi;
- cursos UEMI;
- comunidad School;
- certificaciones;
- rutas de aprendizaje;
- convertir aprendizaje en productos/servicios Dmente;
- organizar notas y entregables.

### Herramientas permitidas

- Obsidian;
- GitHub wiki si aplica;
- Drive;
- notas Markdown;
- recordatorios.

### Límites

- No estudiar por estudiar.
- Todo curso debe producir aplicación práctica: oferta, proceso, plantilla, herramienta o mejora interna.

### Bajo consumo

- Resumir cada curso en: idea útil, aplicación Dmente, próxima acción.

---

## 4.5 Obsidian / Conocimiento

**ID sugerido:** `conocimiento-obsidian`  
**Dominio:** memoria externa/documentación  

### Responsabilidades

- organizar notas;
- conectar aprendizajes;
- mantener base de conocimiento;
- guardar procedimientos;
- crear índices;
- evitar duplicados.

### Herramientas permitidas

- Obsidian vault;
- Markdown;
- GitHub wiki Dmente;
- Drive para archivos pesados.

### Límites

- No llenar memoria persistente con detalles largos.
- No mover secretos a notas.
- No duplicar si ya existe estado canónico.

---

## 5. Agentes de Dmente Digital

## 5.1 PMO

**ID sugerido:** `pmo`  
**Dominio:** proyectos/operación  

### Responsabilidades

- estados de proyectos;
- bitácoras;
- pendientes;
- prioridades;
- próximos pasos;
- consolidar avances;
- evitar que se olviden clientes.

### Proyectos asignados

- Dmente Synapse;
- Vértice;
- Can & Friends;
- PLES/CRM Marcas;
- ATG Monitor SECOP;
- Medigan;
- PMA facturas;
- pendientes Dmente.

### Límites

- No marcar como hecho algo no verificado.
- No sobrescribir estados sin backup.

---

## 5.2 Técnico

**ID sugerido:** `tecnico`  
**Dominio:** tecnología/desarrollo  

### Responsabilidades

- código;
- repositorios;
- integraciones;
- MCP;
- Docker;
- Coolify;
- Cloudflare;
- despliegues;
- pruebas;
- QA.

### Proyectos asignados

- Synapse;
- Vértice;
- Coolify/VPS;
- ATG;
- PMA facturas;
- herramientas internas;
- n8n.

### Límites

- No deploy sin aprobación.
- No commit/push sin aprobación.
- No tocar producción sin rollback.
- No exponer secretos.

---

## 5.3 Ventas / Comercial

**ID sugerido:** `ventas`  
**Dominio:** ventas/pipeline  

### Responsabilidades

- prospectos;
- pipeline;
- propuestas;
- seguimiento;
- CRM;
- oportunidades de ingreso;
- mensajes de seguimiento para aprobación.

### Proyectos asignados

- Vértice CRM;
- More Products;
- prospectos Dmente;
- oportunidades IA empresarial;
- pipeline de clientes.

### Límites

- No enviar mensajes externos sin aprobación.
- No prometer precios/resultados sin Diego.

---

## 5.4 Marketing

**ID sugerido:** `marketing`  
**Dominio:** marketing/crecimiento  

### Responsabilidades

- campañas;
- Meta Ads;
- GA4;
- Clarity;
- contenidos;
- métricas;
- oportunidades de crecimiento;
- auditorías de sitios.

### Proyectos asignados

- Can & Friends;
- Medigan/Básculas;
- DBVloggers;
- Dmente;
- clientes con pauta.

### Límites

- No cambiar campañas/presupuesto sin aprobación.
- No publicar sin aprobación.

---

## 5.5 Legal / Riesgos

**ID sugerido:** `legal`  
**Dominio:** legal/riesgo  

### Responsabilidades

- contratos;
- privacidad;
- datos personales;
- lenguaje preventivo;
- cumplimiento;
- riesgos de WhatsApp/Meta/clientes.

### Límites

- No reemplaza abogado.
- No firma ni aprueba contratos.
- No envía documentos legales sin aprobación.

---

## 5.6 Finanzas Dmente

**ID sugerido:** `finanzas-dmente`  
**Dominio:** finanzas agencia  

### Responsabilidades

- cobros;
- facturación;
- rentabilidad;
- estados de pago;
- cuentas por cobrar;
- análisis de clientes rentables.

### Proyectos asignados

- PMA facturas;
- cobros Dmente;
- rentabilidad por cliente;
- cuentas pendientes.

### Límites

- No mover dinero.
- No enviar facturas externas sin aprobación.
- No exponer información financiera.

---

## 6. Agentes de producto

## 6.1 Producto Vértice

**ID sugerido:** `producto-vertice`  
**Dominio:** producto CRM  

### Responsabilidades

- organizar visión de Vértice;
- CRM;
- WhatsApp oficial;
- n8n;
- pipeline;
- automatizaciones;
- seguimiento a clientes;
- casos de uso comerciales.

### Límites

- No tocar número oficial, webhooks o producción sin aprobación.
- No mezclar Vértice con pruebas no oficiales de WhatsApp.

---

## 6.2 Producto Synapse

**ID sugerido:** `producto-synapse`  
**Dominio:** producto oficina operativa  

### Responsabilidades

- agentes;
- solicitudes;
- aprobaciones;
- proyectos;
- auditoría;
- coordinación;
- UI;
- MCP;
- bajo consumo de tokens.

### Límites

- No conectar herramientas externas en escritura antes de aprobaciones.
- No eliminar MCP local hasta estabilidad remota.

---

## 6.3 WhatsApp / Conversaciones

**ID sugerido:** `whatsapp-conversaciones`  
**Dominio:** mensajería comercial  

### Responsabilidades

- clasificar chats;
- detectar prospectos;
- preparar respuestas;
- registrar leads;
- escalar conversaciones sensibles;
- respetar reglas de horario/cadencia.

### Límites

- No enviar sin aprobación cuando aplique.
- No mandar logs ni comandos a clientes.
- No usar grupos con WhatsApp oficial.
- Respetar no_contactar.

---

## 7. JEV como evaluación inicial

JEV debe analizar primero, de forma barata:

1. intención;
2. dominio;
3. agente sugerido;
4. riesgo;
5. si requiere aprobación;
6. si requiere LLM o regla determinista.

Salida sugerida de JEV:

```json
{
  "intent": "calendar|sales|school|health|technical|finance|project|marketing|legal|learning|knowledge",
  "agentId": "colegio-lucia",
  "priority": "low|normal|high|urgent",
  "risk": "low|medium|high",
  "requiresApproval": true,
  "llmNeeded": false,
  "reason": "Fecha y hora claras; crear recordatorio privado."
}
```

JEV no reemplaza LuciaBot. JEV reduce tokens y ayuda a enrutar.

---

## 8. Fases de implementación

## Fase 1 — Catálogo de agentes

Crear/actualizar agentes en Synapse:

1. `gerente`
2. `secretaria`
3. `colegio-lucia`
4. `salud-familiar`
5. `finanzas-familiares`
6. `educacion-aprendizaje`
7. `conocimiento-obsidian`
8. `pmo`
9. `tecnico`
10. `ventas`
11. `marketing`
12. `legal`
13. `finanzas-dmente`
14. `producto-vertice`
15. `producto-synapse`
16. `whatsapp-conversaciones`

## Fase 2 — Campos mínimos por request

Agregar o usar:

```text
requestId
agentId
domain
projectId
priority
risk
status
requiresApproval
nextAction
createdAt
updatedAt
```

## Fase 3 — Router de bajo costo

Implementar router determinista:

- palabras clave;
- dominio;
- agente sugerido;
- JEV opcional;
- fallback LuciaBot.

## Fase 4 — Aprobaciones

Antes de conectores externos:

- preview;
- destino;
- acción;
- riesgo;
- botón aprobar/rechazar;
- auditoría.

## Fase 5 — Conectores solo lectura

Primero lectura:

- Calendar;
- Gmail;
- Drive;
- GitHub;
- Coolify;
- Meta Ads;
- GA4;
- Clarity;
- Obsidian.

## Fase 6 — Escritura controlada

Solo con aprobación:

- Calendar;
- WhatsApp;
- correo;
- repos;
- Coolify;
- campañas;
- facturación.

---

## 9. Primera acción recomendada para Codex

Crear/actualizar el catálogo de agentes en Synapse sin activar acciones externas.

### Entrega mínima

- agregar agentes faltantes;
- mostrar agentes en UI;
- asociar cada agente a dominio;
- mantener LuciaBot como coordinadora;
- preparar router básico;
- no conectar WhatsApp/correo/producción en escritura.

### Criterios de aceptación

- agentes visibles en Synapse;
- cada agente con nombre, descripción, dominio y límites;
- `synapse_reply_to_request` sigue funcionando;
- `npm run server:check` pasa;
- `npm run build` pasa;
- no secretos expuestos;
- no acciones externas habilitadas.
