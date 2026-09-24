# Investigación — Uso de JEV TypeSafe AI en Dmente Synapse

**Fecha:** 2026-09-23  
**URL investigada:** https://jevtypesafeai.com/  
**Objetivo:** evaluar si JEV puede servir como capa de decisión rápida y tipada dentro de Dmente Synapse.

---

## 1. Veredicto ejecutivo

**Sí puede servir**, pero no como reemplazo de Lucía ni de los agentes LLM principales.

JEV encaja mejor como una **capa de decisión rápida, barata y tipada** dentro del orquestador de Synapse.

Uso recomendado:

```text
Lucía / agente LLM = razona, redacta, explica, ejecuta con herramientas.
JEV = clasifica, puntúa, enruta, decide gates simples y devuelve valores estructurados.
```

No conviene usarlo para:

- conversaciones largas;
- redacción de respuestas;
- razonamiento complejo;
- explicación al usuario;
- planificación estratégica.

Sí conviene probarlo para:

- enrutamiento de solicitudes a agentes;
- clasificación de mensajes entrantes;
- lead scoring;
- priorización de tareas;
- detección de riesgo en tool calls;
- filtro de contexto;
- guardrails antes de acciones externas.

---

## 2. Qué dice JEV que es

Según la documentación pública revisada, JEV se presenta como un modelo de **System One** de TypeSafe AI.

A diferencia de un LLM conversacional, no está pensado para producir texto libre, sino para devolver decisiones tipadas:

- `choice` — elegir una opción entre varias;
- `score` — puntuar en una escala ordenada;
- `noul` — decisión sí/no con probabilidad calibrada.

Promesa comercial/técnica declarada:

- respuestas en ~70–500 ms;
- 40–200× más rápido que un LLM;
- salida tipada, sin errores de tipo;
- costo bajo por input token;
- outputs gratuitos;
- uso vía API.

---

## 3. API principal

Endpoint documentado:

```text
POST https://jevtypesafeai.com/api/v1/decide
```

Autenticación:

```text
Authorization: Bearer <JEV_API_KEY>
```

La documentación recalca que la key debe mantenerse **server-side**, en variable de entorno, nunca cliente/browser ni repositorio.

Forma conceptual de request:

```json
{
  "model": "jev-latest",
  "state": "texto o JSON con el contexto que se quiere evaluar",
  "questions": {
    "route": {
      "type": "choice",
      "instructions": "¿A qué agente debe ir esta solicitud?",
      "criteria": {
        "marketing": "campañas, Meta Ads, GA4, Clarity, contenidos",
        "ventas": "leads, propuestas, seguimiento comercial",
        "administrativo": "agenda, llamadas, reuniones, recordatorios",
        "tecnico": "repos, despliegues, errores, integraciones",
        "legal": "contratos, riesgos, cumplimiento"
      }
    },
    "urgency": {
      "type": "score",
      "instructions": "¿Qué tan urgente es esta solicitud?",
      "criteria": ["baja", "normal", "alta", "crítica"]
    },
    "requires_approval": {
      "type": "noul",
      "instructions": "¿Esta solicitud requiere aprobación humana antes de ejecutarse?"
    }
  }
}
```

Respuesta conceptual:

```json
{
  "answers": {
    "route": {
      "type": "choice",
      "choice": "marketing",
      "confidence": 0.97
    },
    "urgency": {
      "type": "score",
      "score": 2.5
    },
    "requires_approval": {
      "type": "noul",
      "noul": 0.91
    }
  },
  "usage": {
    "input_tokens": 62,
    "cost_usd": 0.000026
  }
}
```

---

## 4. Endpoints listos mencionados

La documentación pública menciona APIs preparadas para casos comunes:

- email;
- support;
- agents;
- coding agents;
- LLM;
- RAG;
- sales;
- moderation;
- content;
- social;
- ads;
- SEO.

Casos relevantes para Synapse:

| Endpoint / caso | Uso posible en Synapse |
|---|---|
| `/v1/agent/risk` | evaluar riesgo antes de ejecutar tool calls o comandos |
| `/v1/context/filter` | decidir si un bloque viejo de contexto se conserva, resume, trunca o descarta |
| `leads/qualify` | calificar leads entrantes para Ventas/Vértice |
| soporte/email triage | clasificar correos, tickets o WhatsApps |
| ads/social analysis | apoyo para agente de Marketing |
| model routing | decidir si una tarea requiere modelo barato, normal o frontier |

---

## 5. Integraciones / ecosistema

La página menciona ecosistema e integraciones:

- SDK oficial TypeScript/JS: `@typesafe-ai/sdk`;
- posible SDK Python;
- MCP server oficial/comunitario `jev-mcp`;
- integración vía Vercel AI Gateway;
- integración vía OpenRouter, pero por endpoint de decisions, no chat completions normal;
- Cloudflare AI Gateway;
- herramientas de agent risk, context compaction, model routing.

Comando mencionado para un MCP oficial/comunitario:

```bash
claude mcp add jev -e TYPESAFE_API_KEY=your_key -- npx -y github:codaaiteam/jev-mcp
```

Nota de seguridad: no poner la API key en chats ni repos. Para Dmente debería ir en:

- `.env` del backend Synapse;
- secreto de Coolify si se despliega;
- gestor seguro/OAuth si existiera.

---

## 6. Encaje recomendado dentro de Dmente Synapse

### A. Clasificador de intención

Antes de llamar un agente LLM, Synapse puede usar JEV para decidir:

```text
¿Esto va a Marketing, Ventas, Administrativo, Técnico, Legal, Finanzas o PMO?
```

Salida esperada:

```ts
type RouteDecision = {
  agent: 'marketing' | 'ventas' | 'administrativo' | 'tecnico' | 'legal' | 'finanzas' | 'pmo'
  confidence: number
  urgency: number
  requiresApproval: number
}
```

### B. Risk gate antes de acciones externas

Antes de enviar correo, WhatsApp, tocar Meta Ads, Coolify o GitHub:

```text
¿Esta acción debe bloquearse, pedirse confirmación o ejecutarse?
```

Salida:

```ts
type RiskGate = {
  decision: 'allow' | 'confirm' | 'block'
  riskScore: number
  reasons: string[]
}
```

Esto encaja muy bien con reglas de Dmente:

- WhatsApp externo siempre con preview;
- campañas solo con aprobación;
- producción solo con aprobación;
- secretos nunca en chat;
- repos/clientes con diff y aprobación.

### C. Lead scoring para Ventas

JEV puede ayudar a clasificar:

- prospecto frío;
- prospecto calificado;
- cliente activo;
- soporte;
- spam;
- requiere Diego;
- oportunidad urgente.

No redacta la respuesta, solo entrega categoría/score.

### D. Marketing / campañas

Para agente Marketing:

- detectar urgencia en anomalías de campañas;
- clasificar comentario de anuncio;
- puntuar calidad de lead/copy;
- decidir si una alerta merece interrumpir a Diego.

### E. Context filter / memoria operativa

Puede ayudar a decidir qué contexto conservar en Synapse:

```text
keep / truncate / drop
```

Útil para proyectos largos como Can & Friends, Vértice, PLES, ATG.

---

## 7. Arquitectura propuesta

No integrar JEV directamente desde el frontend.

Arquitectura segura:

```text
Frontend Synapse
  ↓
Backend Synapse Node.js
  ↓
DecisionService
  ├─ JEV /v1/decide
  ├─ reglas deterministas locales
  └─ fallback LLM / manual
```

La key vive solo en backend:

```env
JEV_API_KEY=...
JEV_BASE_URL=https://jevtypesafeai.com/api/v1
```

El frontend solo recibe decisiones ya procesadas.

---

## 8. Riesgos y cautelas

1. **Servicio externo nuevo**  
   Agrega dependencia externa a un producto que hoy está en fase temprana/ecosistema nuevo.

2. **No reemplaza razonamiento**  
   JEV devuelve decisiones tipadas, no explicación profunda ni redacción.

3. **Validar API real con key**  
   La documentación pública es clara, pero antes de comprometer arquitectura se debe hacer una prueba mínima con una key real.

4. **Privacidad**  
   No enviar datos sensibles de clientes si no es necesario. Mandar solo el contexto mínimo para decidir.

5. **Fallback requerido**  
   Si JEV falla, Synapse debe poder seguir con reglas locales o Lucía/LLM.

6. **No meter key en frontend**  
   La propia documentación dice que la key debe mantenerse server-side.

---

## 9. MVP recomendado para Dmente Synapse

### Paso 1 — Sin integración real todavía

Crear tipos y servicio abstracto:

```ts
interface DecisionProvider {
  routeRequest(input: RouteInput): Promise<RouteDecision>
  riskGate(input: RiskInput): Promise<RiskDecision>
  qualifyLead(input: LeadInput): Promise<LeadDecision>
}
```

Implementar primero versión local determinista/mock.

### Paso 2 — Prueba controlada con JEV

Cuando haya API key:

- guardar `JEV_API_KEY` solo en backend `.env` o Coolify secret;
- crear `JevDecisionProvider`;
- probar 3 casos:
  1. enrutamiento de solicitud a agente;
  2. risk gate antes de tool call;
  3. lead scoring.

### Paso 3 — Comparar con reglas locales

Durante una semana:

- guardar decisión de JEV;
- guardar decisión final de Lucía/Diego;
- medir si JEV acierta suficiente para automatizar parcialmente.

### Paso 4 — Activar como preclasificador

Solo usarlo en modo:

```text
sugerir → no ejecutar
```

Luego pasar a:

```text
auto-rutear bajo riesgo → pedir confirmación en riesgo medio/alto
```

---

## 10. Decisión recomendada

**Sí investigarlo y probarlo, pero como módulo opcional de decisión, no como cerebro principal.**

Recomendación #1:

```text
Implementar en Synapse una capa DecisionService agnóstica.
Primero mock/local.
Después conectar JEV si la prueba real de API funciona.
```

Esto evita amarrar Dmente Synapse a un proveedor nuevo y permite cambiar JEV por reglas locales, OpenRouter, Hermes o cualquier otro decisor.

---

## 11. Frase interna para el roadmap

JEV puede ser el **preclasificador/risk-gate de Synapse**:

> rápido, barato y tipado para decidir qué agente debe actuar, qué tan riesgosa es una acción y cuándo debe intervenir Diego.

Lucía sigue siendo la orquestadora ejecutiva. JEV solo decide pequeñas rutas y gates.
