# Estado del proyecto: Dmente Synapse

**Versión documentada:** 0.1.0  
**Fecha de actualización:** 2026-09-24  
**Zona horaria:** America/Bogota  
**Estado general:** prototipo frontend + backend local vertical slice, compilable y preparado para despliegue en VPS

## 1. Resumen

Dmente Synapse es una aplicación web local que representa una oficina de agentes de inteligencia artificial de Dmente Digital. La interfaz permite seleccionar agentes, abrir conversaciones, enviar mensajes y consultar solicitudes. El primer backend local ya registra mensajes, solicitudes y compromisos en SQLite y aplica un enrutamiento determinista inicial para LuciaBot.

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
| `src/types.ts` | Tipos compartidos de la interfaz. |
| `src/components/` | Barra superior, oficina, solicitudes y chat. |
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

| Agente | Función visible | Activo principal | Estado inicial |
|---|---|---|---|
| Secretaria | Coordina la operación | `secretaria-normal.png` | Solicitud pendiente |
| Legal | Analiza riesgos y contratos | `legal-futurista-normal.png` | Analizando |
| Marketing | Diseña crecimiento y campañas | `marketing-normal.png` | Optimizando |
| Ventas | Gestiona oportunidades | `ventas-normal.png` | Solicitud pendiente |
| LuciaBot | Gerente y orquestadora | `gerente-normal.png` | Supervisando |

Los cinco personajes se muestran en estaciones independientes y pueden seleccionarse para cambiar el chat activo.

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

- Navegación visual entre Oficina y Solicitudes.
- Selección de cinco agentes desde la oficina.
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
- Adaptación básica para pantallas pequeñas.
- Respeto de `prefers-reduced-motion`.

## 8. Funcionalidades no implementadas

Las siguientes funciones aparecen en la visión o en los documentos iniciales, pero no existen todavía en el código actual:

- backend multiagente con ejecución real de modelos;
- persistencia de conversaciones completas asociadas a usuarios y sesiones;
- autenticación;
- ejecución real de agentes mediante Codex CLI;
- integración con Gmail, Google Drive o Composio;
- tareas programadas o cron jobs;
- aprobaciones con efectos externos reales;
- creación funcional de agentes desde el botón `Añadir agente`;
- configuración funcional;
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

- La base de sesiones está implementada, pero no está activa hasta configurar `SYNAPSE_OWNER_PASSWORD` y `SYNAPSE_SESSION_SECRET`.
- La VPS está identificada como Ubuntu 24.04 LTS con acceso SSH root. El despliegue todavía no se ha ejecutado porque el proyecto no tiene un remote Git configurado y faltan dominio y configuración SSL.
- El despliegue mediante Coolify está preparado, pero falta conectar el repositorio, configurar variables secretas, asignar el puerto 3010 y montar `/app/data` como almacenamiento persistente.
- Existe un perfil local de desarrollo `diego-local` con permisos por dominio; no debe confundirse con autenticación ni autorización de producción.
- No se deben conectar cuentas personales ni enviar mensajes externos antes de implementar permisos y aprobaciones.
- El enrutador actual es local y determinista; no representa inteligencia autónoma ni sustituye una evaluación de modelo.
- La base SQLite local no es todavía una arquitectura de producción ni un mecanismo de respaldo.
- JEV permanece opcional y no debe bloquear la primera versión útil.
- La interfaz todavía conserva datos simulados y datos del backend en superficies distintas.

## 20. Criterio del estado actual

El proyecto puede considerarse un **prototipo web local con backend vertical slice**. Permite validar la dirección visual, la distribución de agentes, la persistencia local básica y el enrutamiento determinista inicial. No debe presentarse todavía como un sistema multiagente autónomo ni como una integración operativa con servicios externos.
