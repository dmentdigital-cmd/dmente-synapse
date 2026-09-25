# Estado del proyecto: Dmente Synapse

**Versión documentada:** 0.1.0  
**Fecha de actualización:** 2026-09-24  
**Zona horaria:** America/Bogota  
**Estado general:** prototipo desplegado en VPS con backend operativo, autenticación y conexión MCP verificada con Hermes

## 1. Resumen

Dmente Synapse es una aplicación web local que representa una oficina de agentes de inteligencia artificial de Dmente Digital. La interfaz permite seleccionar agentes, abrir conversaciones, enviar mensajes y consultar solicitudes. El primer backend local ya registra mensajes, solicitudes y compromisos en SQLite y aplica un enrutamiento determinista inicial para LuciaBot.

### Actualización: catálogo operativo de bajo consumo

Se implementó la primera entrega definida en `estructura_agentes_synapse_luciabot_2026-09-24.md`:

- catálogo de 16 agentes con dominio, función, capacidades, límites y proyectos;
- panel navegable de Agentes, separado de la oficina visual;
- LuciaBot permanece como coordinadora y fallback;
- router determinista que evita usar un LLM cuando una regla es suficiente;
- campos de solicitud `projectId`, `priority` y `nextAction`, además de dominio, riesgo, estado y aprobación;
- acciones externas bloqueadas: el sistema registra, clasifica y prepara respuestas, pero no envía correo, WhatsApp, eventos, campañas ni cambios de producción;
- MCP remoto de Hermes y `synapse_reply_to_request` se conservan sin cambios incompatibles.

La ejecución autónoma de varios modelos, JEV real, conectores externos y aprobación visual de acciones continúan pendientes. Los nuevos agentes usan temporalmente el logo de Dmente como avatar y no aparecen como personajes en el escenario hasta contar con imágenes propias.

La dirección visual se basa en el kit de marca de Dmente Digital y utiliza una oficina futurista ambientada en una nave espacial.

Todavía no existen conexiones reales con Calendar, WhatsApp, correo, notas, JEV ni otros servicios externos.

## 2. Fuente de identidad visual

El documento de referencia es:

`C:\Users\diego\Documents\DIEGOSAN\PROYECTO D MENTE DIGITAL\KIT DE MARCA DMENTE DIGITAL\BRAND_KIT_DMENTE_DIGITAL.md`

Decisiones aplicadas:

- Marca visible de la aplicación: **Dmente Synapse**.
- Empresa y marca matriz: **Dmente Digital**.
- Tipografía: **Plus Jakarta Sans**.
- Fondo principal: Deep Space Navy, `#061421` y `#020617`.
- Acento teal: `#2BEBD2`.
- Indigo: `#818CF8`.
- Emerald: `#34D399`.
- Sky Blue: `#60A5FA`.
- Magenta: `#EC4899`.
- Texto principal: Ghost White, `#F8FAFC`.
- Estética: Dark Tech, glassmorphism, iluminación holográfica y ambiente espacial.

Logo utilizado:

`public/assets/logo-dmente.png`

El logo aparece actualmente en:

- la barra superior;
- el emblema central de la oficina;
- las etiquetas de las estaciones de los agentes.

## 3. Tecnología actual

| Componente | Tecnología | Versión instalada |
|---|---|---:|
| Interfaz | React | 19.3.0 |
| Renderizado | React DOM | 19.3.0 |
| Lenguaje | TypeScript | 7.0.2 |
| Desarrollo y compilación | Vite | 8.3.0 |
| Integración React/Vite | `@vitejs/plugin-react` | 6.1.1 |
| Iconos | Lucide React | 1.47.0 |

No hay framework CSS. Los estilos se encuentran en `src/styles.css`.

## 4. Archivos principales

| Archivo | Función |
|---|---|
| `src/main.tsx` | Estado de la interfaz, agentes, mensajes, solicitudes y navegación. |
| `src/agents.ts` | Catálogo visual de agentes y mensajes iniciales. |
| `src/agentProfiles.ts` | Dominios, capacidades, límites y proyectos de los 16 agentes. |
| `src/types.ts` | Tipos compartidos de la interfaz. |
| `src/components/` | Barra superior, oficina, solicitudes y chat. |
| `src/components/AgentsPanel.tsx` | Catálogo operativo navegable de agentes. |
| `src/components/LoginScreen.tsx` | Pantalla de inicio de sesión cuando la autenticación está configurada. |
| `src/styles.css` | Sistema visual, oficina, posiciones, paneles, responsive y animaciones. |
| `index.html` | Entrada HTML de la aplicación. |
| `vite.config.ts` | Configuración de Vite y React. |
| `server/index.ts` | API HTTP local para agentes, mensajes, solicitudes y compromisos. |
| `server/db.ts` | Persistencia SQLite local mediante `node:sqlite`. |
| `server/auth.ts` | Sesiones locales mediante cookie HttpOnly y credenciales configurables. |
| `deploy/hostinget/` | Archivos y guía para desplegar en una VPS Linux de Hostinget mediante Coolify o Nginx/PM2. |
| `Dockerfile` | Imagen de producción que sirve React y la API Node.js en un solo servicio. |
| `.dockerignore` | Archivos excluidos del contexto de construcción Docker. |
| `server/orchestrator.ts` | Enrutamiento determinista inicial de LuciaBot. |
| `server/mcp.ts` | Endpoint MCP remoto y herramientas de Synapse para Hermes. |
| `server/types.ts` | Tipos de dominio del backend. |
| `tsconfig.server.json` | Configuración TypeScript del backend. |
| `package.json` | Dependencias y comandos del proyecto. |
| `public/assets/` | Imágenes servidas por la aplicación. |
| `PROMPT-PULPO-STARTER.md` | Especificación inicial heredada del kit Pulpo Starter. |
| `LEEME.md` | Documentación del kit gráfico original. |
| `assets.json` | Inventario del kit gráfico original. |
| `blueprint_orquestacion_agentes_dmente_synapse.md` | Arquitectura funcional y reglas de orquestación. |
| `investigacion_jev_typesafe_ai_synapse_2026-09-23.md` | Evaluación de JEV como proveedor opcional de decisiones tipadas. |
| `transcripci_n_y_notas_detalladas.md` | Referencia conceptual sobre arneses, agentes por roles, cron y conectores. |

## 5. Agentes actuales

| ID | Agente | Dominio |
|---|---|---|
| `gerente` | LuciaBot | Coordinación general |
| `secretaria` | Secretaria | Agenda y administración |
| `colegio-lucia` | Colegio Lucía | Familia y educación |
| `salud-familiar` | Salud Familiar | Salud privada |
| `finanzas-familiares` | Finanzas Familiares | Finanzas familiares |
| `educacion-aprendizaje` | Educación | Aprendizaje aplicado |
| `conocimiento-obsidian` | Conocimiento | Memoria y documentación |
| `pmo` | PMO | Proyectos y prioridades |
| `tecnico` | Técnico | Tecnología y desarrollo |
| `ventas` | Ventas | Pipeline comercial |
| `marketing` | Marketing | Crecimiento y campañas |
| `legal` | Legal | Riesgos y cumplimiento |
| `finanzas-dmente` | Finanzas Dmente | Finanzas de agencia |
| `producto-vertice` | Producto Vértice | Producto CRM |
| `producto-synapse` | Producto Synapse | Oficina operativa |
| `whatsapp-conversaciones` | WhatsApp | Mensajería comercial |

Los cinco personajes que tienen activos gráficos propios continúan visibles en la oficina. Los 16 agentes están disponibles en el panel Agentes y en la API. Al seleccionar un agente del catálogo se abre su chat.

La imagen de LuciaBot fue reemplazada por un personaje futurista de gerente generado a partir de la referencia de perfil proporcionada por Diego. El activo publicado para evitar caché del navegador es `public/assets/lucia-bot-gerente-v2.png`. Conserva el fondo transparente, la paleta teal/índigo/magenta y el estilo visual de la oficina espacial. El logo de Dmente Digital no se reemplazó; continúa funcionando como identidad de la aplicación y de la oficina.

### Estado de las poses

Los personajes futuristas tienen actualmente una sola pose cada uno. Cuando existe una solicitud pendiente, la aplicación mantiene la misma imagen y añade un indicador luminoso con campana.

Todavía no se han generado poses futuristas alternativas con la mano levantada.

## 6. Oficina futurista

Activo principal:

`public/assets/oficina-futurista.png`

Características:

- interior de una nave espacial;
- ventanales panorámicos al espacio;
- iluminación teal e índigo;
- suelo técnico con rutas luminosas;
- cinco posiciones para agentes;
- emblema holográfico de Dmente Digital;
- capas HTML/CSS independientes para agentes y controles.

También existen los activos `escritorio-futurista.png` y `silla-futurista.png`, pero no están colocados en la composición actual. La interfaz usa plataformas holográficas para evitar saturar visualmente la oficina con cinco escritorios.

## 7. Funcionalidades implementadas

- Navegación visual entre Oficina, Agentes, Solicitudes y Configuración.
- Selección de cinco personajes desde la oficina y acceso a los 16 perfiles desde el catálogo.
- Perfiles estructurados con dominio, capacidades, límites y proyectos.
- Enrutamiento determinista de bajo consumo con fallback a LuciaBot solo cuando no hay una regla suficiente.
- Solicitudes con proyecto, prioridad, riesgo, estado, aprobación y próxima acción.
- Chat independiente en memoria para cada agente.
- Envío local de mensajes mediante botón o tecla Enter.
- Envío del chat a la API local y respuesta del enrutador de LuciaBot cuando el backend está activo.
- Registro persistente de mensajes, solicitudes y compromisos en SQLite.
- Modelo local de perfil propietario y permisos por dominio disponible en `/api/profile`.
- Endpoints de sesión disponibles en `/api/auth/session`, `/api/auth/login` y `/api/auth/logout`.
- Carga de solicitudes y mensajes persistidos desde la API al iniciar y al cambiar de agente.
- Enrutamiento inicial hacia familia, bienestar, iglesia y agentes de la agencia.
- Mensajes iniciales de demostración por agente.
- Conteo de solicitudes pendientes.
- Creación y resolución simulada de solicitudes.
- Indicador visual para agentes con solicitudes pendientes.
- Panel de solicitudes con acceso a la conversación correspondiente.
- Chat minimizable mediante el botón `−`.
- Botón compacto para restaurar el chat minimizado.
- Botón visible de salida de sesión conectado a `/api/auth/logout`.
- Navegación funcional entre Oficina, Agentes, Solicitudes y Configuración.
- Panel de configuración que muestra el estado de la sesión y de Hermes.
- Modal funcional para el botón `Añadir agente`, con aviso explícito de que la creación persistente todavía requiere backend.
- Actualización automática del chat cada siete segundos para mostrar respuestas nuevas de Hermes/LuciaBot.
- Adaptación básica para pantallas pequeñas.
- Respeto de `prefers-reduced-motion`.

## 8. Funcionalidades no implementadas

Las siguientes funciones aparecen en la visión o en los documentos iniciales, pero no existen todavía en el código actual:

- backend multiagente con ejecución real de modelos;
- persistencia de conversaciones completas asociadas a usuarios y sesiones;
- ejecución real de agentes mediante Codex CLI;
- integración con Gmail, Google Drive o Composio;
- tareas programadas o cron jobs;
- aprobaciones con efectos externos reales;
- creación funcional de agentes desde el botón `Añadir agente`;
- configuración funcional avanzada;
- carga de archivos desde el botón de adjuntar;
- respuestas generadas por un modelo de lenguaje;
- pruebas automatizadas;
- poses futuristas alternativas de atención.
- interfaz `DecisionProvider`;
- proveedor local de decisiones;
- integración real con JEV;
- registro de decisiones y comparación con decisiones humanas.
- reglas completas para todos los dominios personal, familiar, salud, educación, iglesia y bienestar;
- monitoreo real de Calendar, WhatsApp, correo y notas;
- recordatorios persistentes y eventos personales;
- perfiles familiares y protección específica de datos de menores.

## 9. Datos y persistencia

El estado visual de React sigue viviendo en memoria. El backend persiste los datos operativos en:

`data/synapse.sqlite`

La base local conserva:

- agentes registrados;
- mensajes recibidos por la API;
- solicitudes enrutadas;
- compromisos personales y familiares;
- eventos de auditoría básicos.

El estado visual de React incluye:

- agente seleccionado;
- mensajes;
- solicitudes pendientes;
- sección activa;
- estado minimizado del chat.

Al cargar el navegador, la interfaz hidrata las solicitudes y los mensajes del agente activo desde la API. La navegación histórica completa y la sincronización en tiempo real todavía están pendientes.

## 10. Comandos

Instalar dependencias:

```powershell
npm install
```

Iniciar el entorno de desarrollo:

```powershell
npm run dev -- --host 127.0.0.1
```

Iniciar solamente el backend local:

```powershell
npm run server:dev
```

Comprobar tipos del backend:

```powershell
npm run server:check
```

Iniciar frontend y backend juntos:

```powershell
npm run dev:all
```

Dirección local predeterminada:

```text
http://127.0.0.1:5173/
```

Compilar para producción:

```powershell
npm run build
```

Previsualizar la compilación:

```powershell
npm run preview
```

## 11. Verificación

Últimas comprobaciones ejecutadas:

```powershell
npm run build
```

Resultado: compilación completada correctamente con TypeScript y Vite.

También se ejecutaron `npm run server:check` y pruebas HTTP contra `/api/health`, `/api/agents`, `/api/messages`, `/api/commitments` y `/api/requests`. La API respondió y creó registros locales.

Salida generada en:

`dist/`

No se ejecutaron pruebas automatizadas porque todavía no existe una suite de pruebas.

## 12. Activos heredados

La carpeta conserva imágenes y documentos del kit Pulpo Starter. Estos archivos sirven como referencia histórica, pero no todos participan en la interfaz actual.

Entre ellos se encuentran:

- personajes originales de Pulpo;
- oficina clásica;
- muebles y plantas clásicos;
- prompts de generación de imágenes;
- ZIP original del kit;
- plantilla AGENTS.

No se han eliminado para evitar pérdida de material fuente.

## 12A. Despliegue y MCP de Coolify

El repositorio de producción está publicado en:

`https://github.com/dmentdigital-cmd/dmente-synapse`

Estado Git verificado:

- rama publicada: `main`;
- último commit funcional publicado: `7970e0e feat: add low-cost Synapse agent catalog`;
- cambios de la nueva imagen, el MCP y el estado publicados en `main`;
- no se incluyeron `node_modules`, `dist`, `data/`, archivos `.env` ni `.claude/` en el repositorio.

El proyecto incluye `Dockerfile`, puerto `3010`, health check `/api/health` y configuración para persistir SQLite en `/app/data`.

Coolify dispone de un MCP integrado en la propia instancia. La documentación oficial está disponible en:

- [Configuración del MCP de Coolify](https://coolify.io/docs/mcp/setup)
- [Funcionamiento del MCP de Coolify](https://coolify.io/docs/mcp/how-mcp-works)

El endpoint esperado, una vez habilitado en Coolify, es:

```text
https://TU-DOMINIO-DE-COOLIFY/mcp
```

Estado de la integración MCP:

- MCP propio de Synapse: endpoint `/mcp` implementado con JSON-RPC, autenticación Bearer y nueve herramientas;
- token `SYNAPSE_MCP_TOKEN`: configurado en Coolify y Hermes, sin registrarlo en este documento;
- registro del endpoint remoto en Hermes: configurado como `synapse_remote` con `enabled: true`;
- prueba directa del endpoint: `HTTP 200` para `initialize`;
- descubrimiento de herramientas: confirmado mediante `tools/list`;
- invocación real desde Hermes: confirmada con `synapse_get_profile`, que devolvió el perfil `diego-local`;
- respuesta Hermes → Synapse implementada en `POST /api/hermes/reply`;
- herramienta `synapse_reply_to_request` implementada y publicada en `tools/list`;
- el endpoint valida el Bearer token, la solicitud existente y el agente, guarda `direction: agent` y registra `hermes_reply_created`;
- el frontend consulta mensajes cada siete segundos para mostrar respuestas nuevas sin recarga manual;
- MCP integrado de Coolify en esta sesión de Codex: no disponible;
- no se han enviado credenciales ni tokens al repositorio o a esta conversación.

Variables que deben mantenerse como secretos en Coolify, no en GitHub:

```env
SYNAPSE_OWNER_USERNAME=diego
SYNAPSE_OWNER_PASSWORD=<contraseña_real>
SYNAPSE_SESSION_SECRET=<clave_aleatoria_larga>
SYNAPSE_DATA_DIR=/app/data
SYNAPSE_MCP_TOKEN=<token_largo_para_Hermes>
```

La conexión del MCP requiere habilitarlo en Coolify y registrarlo como servidor MCP en el cliente compatible. No se debe asumir que esta sesión tiene acceso hasta que el conector aparezca entre las herramientas disponibles.

### LuciaBot en el VPS

LuciaBot está incluida dentro de la aplicación Synapse. No se conecta como un servicio separado: la interfaz, el catálogo del agente y el enrutamiento determinista se ejecutan dentro del mismo contenedor Node.js en Coolify.

Estado actual verificado desde la interfaz desplegada y la integración MCP:

- LuciaBot aparece como gerente y orquestadora;
- el inicio de sesión funciona con las variables configuradas en Coolify;
- el dominio operativo es `https://synapse.dmentedigital.co`;
- la nueva imagen futurista de LuciaBot está publicada en Git como `lucia-bot-gerente-v2.png`, con fondo transparente y nombre versionado para evitar caché;
- el sitio público `https://synapse.dmentedigital.co` muestra la nueva imagen en una ventana de incógnito, sin depender de una sesión previa;
- Hermes está conectado mediante MCP remoto y ya invocó `synapse_get_profile` con respuesta correcta;
- todavía no existe conexión real con Calendar, correo o WhatsApp;
- Hermes conserva además un MCP local antiguo, que no se ha eliminado.

Para conectar una LuciaBot operativa con Hermes se debe registrar `https://synapse.dmentedigital.co/mcp` en Hermes y usar el mismo valor secreto configurado como `SYNAPSE_MCP_TOKEN` en Coolify. Las herramientas de escritura crean registros y solicitudes con aprobación; no ejecutan acciones externas automáticamente.

### Estado de Hermes en la VPS

Estado verificado el 2026-09-24:

- Hermes está instalado en `/home/diego/.hermes/hermes-agent`;
- el gateway de Hermes está administrado por `/home/diego/.config/systemd/user/hermes-gateway.service`;
- `hermes-gateway.service` aparece como `active (running)`;
- el archivo principal de configuración es `/home/diego/.hermes/config.yaml`;
- el secreto `SYNAPSE_MCP_TOKEN` fue añadido al entorno de Hermes sin registrarlo en este documento;
- se añadió y habilitó una entrada `synapse_remote` apuntando a `https://synapse.dmentedigital.co/mcp`;
- la configuración del MCP local antiguo todavía inicia `/home/diego/proyectos/repos/dmente-synapse/mcp/synapse-mcp-server.js`;
- la conexión Hermes → Synapse fue validada mediante `initialize`, `tools/list` y una invocación real de `synapse_get_profile`;
- la nueva respuesta interna fue probada localmente por HTTP y quedó asociada a un `requestId` existente;
- el servicio `hermes-gateway` continúa en estado `active (running)` después del reinicio.

No se debe eliminar el MCP local antiguo hasta decidir si otros flujos todavía lo utilizan. La integración remota ya está operativa.

## 13. Inconsistencias conocidas

- Algunos nombres de documentos todavía contienen `PULPO-STARTER` aunque la marca visible ya es Dmente Synapse.
- El ZIP original conserva la estructura y marca anteriores.
- `assets.json` documenta principalmente los activos originales, no el inventario futurista completo.
- Las dependencias están declaradas como `latest` en `package.json`; `package-lock.json` conserva las versiones instaladas actuales.
- Los activos futuristas de Marketing, Ventas y LuciaBot tienen lienzo vertical de 1024 × 1536, mientras Secretaria y Legal tienen 1254 × 1254. La interfaz normaliza su presentación mediante `object-fit: contain`.

## 14. Pendientes priorizados

| Prioridad | Pendiente | Motivo | Estado |
|---:|---|---|---|
| P0 | Hidratar la interfaz desde la API al cargar | Evita que el frontend muestre solo datos simulados después de recargar | Implementado |
| P0 | Separar el frontend en componentes y modelos | Reduce el riesgo de seguir ampliando `src/main.tsx` como un único archivo | Implementado |
| P0 | Definir autenticación, perfiles y permisos | Es necesario antes de manejar datos personales, familiares o médicos | Pantalla y sesiones implementadas; configuración pendiente |
| P1 | Implementar `DecisionService` como contrato | Permite cambiar el enrutador local por un modelo o JEV sin acoplar la interfaz | Pendiente |
| P1 | Conectar un motor de agentes real | El backend actual clasifica solicitudes, pero no ejecuta agentes autónomos | Pendiente |
| P1 | Diseñar el flujo de aprobación | Las acciones externas deben requerir autorización explícita y quedar auditadas | Pendiente |
| P1 | Añadir pruebas automatizadas | Actualmente la verificación es compilación y pruebas HTTP manuales | Pendiente |
| P2 | Integrar Calendar, correo, WhatsApp autorizado y notas | Habilita el monitoreo personal solicitado | Pendiente |
| P1 | Desplegar en VPS de Hostinget | Permite probar Synapse fuera del equipo local | Archivos preparados; acceso pendiente |
| P2 | Añadir recordatorios, eventos recurrentes y zonas horarias | Convierte compromisos registrados en seguimiento operativo | Pendiente |
| P2 | Crear perfiles familiares y protección de datos de menores | Requerido para manejar información de Lucía con controles adecuados | Pendiente |
| P2 | Añadir JEV en modo sombra | Solo después de verificar API, autenticación, costos, privacidad y límites | Pendiente |
| P3 | Crear poses de atención y manifiesto de activos | Mejora visual, pero no bloquea la operación del backend | Pendiente |
| P3 | Archivar o renombrar documentos heredados de Pulpo Starter | Reduce confusión documental sin alterar los activos fuente | Pendiente |

## 15. Pasos a seguir

### Fase 1. Consolidar el núcleo local

1. Leer agentes, solicitudes, mensajes y compromisos desde SQLite al iniciar React.
2. Reemplazar los estados simulados de solicitudes por datos de la API.
3. Crear componentes separados para oficina, chat, solicitudes y navegación.
4. Validar errores de red, estados de carga y servidor apagado.
5. Añadir pruebas para enrutamiento, persistencia y aprobación.

### Fase 2. Definir seguridad y operación

1. Definir usuario propietario, perfiles familiares y niveles de acceso.
2. Separar datos de agencia, personales, familiares, salud, iglesia y aprendizaje.
3. Definir qué acciones solo registran información y cuáles requieren aprobación.
4. Añadir auditoría con actor, fecha, acción, resultado y fuente.
5. Establecer política de retención, exportación y eliminación de datos.

### Fase 3. Convertir LuciaBot en orquestadora operativa

1. Formalizar el contrato `DecisionService`.
2. Mantener el proveedor local determinista como respaldo.
3. Conectar un proveedor de modelo de lenguaje mediante una interfaz aislada.
4. Implementar agentes especializados para agencia, familia, bienestar, iglesia y aprendizaje.
5. Añadir memoria por conversación y contexto limitado por dominio.
6. Registrar toda decisión y toda acción propuesta.

### Fase 4. Añadir conectores externos

1. Empezar por Calendar para eventos y recordatorios.
2. Añadir correo y notas con permisos mínimos.
3. Evaluar WhatsApp autorizado y sus restricciones operativas antes de implementarlo.
4. Crear sincronización incremental, deduplicación y manejo de fallos.
5. Probar cada conector en modo lectura antes de permitir acciones externas.

### Fase 5. Preparar entrega

1. Revisar privacidad y protección de datos personales y de menores.
2. Ejecutar pruebas de frontend, backend y conectores.
3. Fijar versiones de dependencias en lugar de mantener `latest`.
4. Separar Ampere Core del producto mediante `ampere detach` cuando el flujo de desarrollo esté cerrado.
5. Crear una versión demostrable para clientes de Dmente Digital sin exponer datos personales.

## 16. Decisión arquitectónica sobre JEV

JEV se incorpora al roadmap como proveedor opcional de decisiones tipadas, no como cerebro principal ni como sustituto de LuciaBot.

Usos previstos:

- enrutamiento de solicitudes;
- puntuación de urgencia;
- señal adicional de riesgo;
- calificación de prospectos;
- filtrado de contexto.

La primera implementación será local y determinista. La conexión real con JEV está pendiente de validar endpoint, autenticación, esquema, costos, privacidad, límites y comportamiento ante fallos con una API key autorizada.

Las reglas obligatorias de aprobación conservan precedencia sobre cualquier decisión de JEV.

## 17. Alcance personal y familiar aprobado

La aplicación debe coordinar tanto Dmente Digital como la vida personal y familiar de Diego. La orquestadora se llama **LuciaBot** para distinguirla de Lucía, hija de Diego.

El alcance incluye:

- citas médicas;
- eventos escolares y cumpleaños relacionados con Lucía;
- parque, cine, viajes, lectura, ejercicio e iglesia con Lucía;
- planes con la esposa de Diego;
- lectura, ejercicio y proyectos personales;
- actividades de iglesia, prédicas y apoyo al pastor Periñán;
- monitoreo de Calendar, WhatsApp autorizado, correo y notas;
- recordatorios y eventos persistentes.

Este alcance está documentado. En el backend ya existe el registro básico de compromisos y el enrutamiento inicial de solicitudes familiares, de bienestar e iglesia. El monitoreo de servicios externos aún no está implementado.

## 18. Harness de desarrollo Ampere Core

Ampere Core está instalado como arnés temporal de desarrollo.

Estado verificado:

- versión: `0.9.0-beta.8`;
- copia central: `C:\Users\diego\Documents\DIEGOSAN\PROYECTO AMPERE-CORE\ampere_core`;
- repositorio Git inicializado en Dmente Synapse;
- instalación aditiva completada;
- cuatro hooks de Git instalados;
- sin sidecars `.nuevo-*` pendientes;
- resultado de `ampere doctor`: `SANO`.

El proyecto usa ES modules mediante `"type": "module"`. Los scripts de Ampere usan CommonJS, por lo que se añadió `.claude/package.json` con `"type": "commonjs"` para aislar la compatibilidad dentro del arnés sin modificar la configuración de la aplicación.

Flujo obligatorio de desarrollo:

```text
/onboarding → /check → /plan → /build → /audit → /ship
```

Antes de publicar o entregar una versión final:

```powershell
ampere detach --dry-run
ampere detach
git status --short
```

Ampere Core es infraestructura temporal de construcción y no forma parte del producto final.

## 19. Riesgos y decisiones pendientes

- La base de sesiones está implementada y configurada mediante `SYNAPSE_OWNER_PASSWORD` y `SYNAPSE_SESSION_SECRET` en Coolify.
- La VPS está identificada como Ubuntu 24.04 LTS con acceso SSH root. La aplicación está desplegada en Coolify con el dominio `synapse.dmentedigital.co`, puerto interno `3010` y persistencia en `/app/data`.
- El despliegue inicial en Coolify terminó correctamente y el contenedor aparece como `Running`; todavía falta configurar un health check visible para la aplicación.
- El MCP integrado de Coolify no está conectado a esta sesión de Codex; la integración verificada en este estado es el MCP propio de Synapse usado por Hermes.
- Existe un perfil local de desarrollo `diego-local` con permisos por dominio; no debe confundirse con autenticación ni autorización de producción.
- No se deben conectar cuentas personales ni enviar mensajes externos antes de implementar permisos y aprobaciones.
- El enrutador actual es local y determinista; no representa inteligencia autónoma ni sustituye una evaluación de modelo.
- La base SQLite local no es todavía una arquitectura de producción ni un mecanismo de respaldo.
- JEV permanece opcional y no debe bloquear la primera versión útil.
- La interfaz todavía conserva datos simulados y datos del backend en superficies distintas.

## 20. Criterio del estado actual

El proyecto puede considerarse un **prototipo web desplegado con backend vertical slice y una integración MCP operativa con Hermes**. La interfaz pública, el inicio de sesión, la persistencia básica y la conexión Hermes → Synapse están verificadas. No debe presentarse todavía como un sistema multiagente autónomo ni como una integración operativa con Calendar, correo o WhatsApp.
