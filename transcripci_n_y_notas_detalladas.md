# Cómo montar tu equipo de IA para trabajar menos (sin saber programar)
**Canal / Presentador:** Aztec Lab / Martín Vázquez  
**Tipo de sesión:** Clase en vivo / Taller de arquitectura de agentes de Inteligencia Artificial  

---

## 1. Introducción y Motivación del Proyecto ("Pulpo")
* **Objetivo principal:** Dejar de depender de simples chats aislados con inteligencias artificiales y pasar a un modelo de **equipos de agentes autónomos y organizados**.
* **El problema actual con los chatbots:** Las interfaces web comunes (como ChatGPT, Claude web) funcionan como "islas". No conocen tu contexto diario, tus carpetas locales, tus herramientas de trabajo, ni pueden ejecutar acciones en segundo plano de forma autónoma.
* **La solución (El concepto de "Pulpo"):** 
  * Un sistema orquestador central que actúa como un "cerebro" coordinador.
  * Múltiples agentes especializados con roles definidos (ej. asistente administrativo, analista de datos, gestor de contenido, soporte legal, control de rendimiento físico/gimnasio).
  * Automatización y delegación fluida: El orquestador recibe correos, eventos de calendario o instrucciones generales y decide a qué agente especializado asignarle la tarea.

---

## 2. Diferencia Fundamental: Chatbots vs. Arneses de IA (*Harnesses*)
Para entender cómo funciona este sistema a nivel técnico y práctico, Martín explica la diferencia de infraestructura:
1. **Chatbots tradicionales (Cloud):** 
   * Envías prompts de forma manual en una interfaz gráfica.
   * No tienen acceso a tu sistema de ficheros local ni a entornos de ejecución persistentes a menos que utilicen conectores limitados.
2. **Arneses de Inteligencia Artificial (*Harnesses* / Herramientas de escritorio y terminal):**
   * Son aplicaciones o interfaces de software (como *Codex*, *Claude Code*, u otras herramientas basadas en CLI) que actúan como "arneses" para los modelos de lenguaje (LLMs).
   * **Capacidad agéntica:** El arnés sostiene el modelo y le otorga herramientas locales (lectura/escritura de archivos, ejecución de comandos, gestión de memoria local).
   * **Modos de uso:**
     * *Modo Interactivo:* Abres la herramienta en la terminal o interfaz y conversas con ella cara a cara.
     * *Modo No Interactivo / Programático:* Ejecutas comandos mediante scripts (ej. `codex exec` o `claude -p "instrucción"`). Esto permite que un software externo (como tu propio script orquestador "Pulpo") invoque al agente en segundo plano de manera automática sin necesidad de intervención humana gráfica.

---

## 3. Ventajas Económicas y Operativas de los Arneses vía Terminal
* **Optimización drástica de costos (Ahorro de hasta un 70%):** 
  * Usar la API tradicional de los proveedores de LLM por cada pequeña tarea automatizada puede volverse extremadamente costoso a escala.
  * Al utilizar arneses que se conectan a través de las suscripciones mensuales (planes Pro / Team de Claude o ChatGPT), se aprovechan los **tokens altamente subsidiados**, reduciendo los costos operativos de la automatización a una fracción mínima.
* **Acceso total al contexto local:**
  * Los agentes pueden leer y escribir directamente en el disco duro del usuario (archivos de texto, Markdown, bases de datos locales, scripts de automatización).
  * Se evita el problema de las ventanas de contexto limitadas subiendo archivos a la nube; el agente consulta carpetas específicas organizadas en el equipo local.

---

## 4. Arquitectura y Estructura Práctica del Sistema
Durante la sesión se detalla cómo estructurar los directorios y la operativa:
* **Estructura de Carpetas:**
  * Se crea un directorio raíz para el proyecto principal (`pulpo`).
  * Subcarpetas independientes para cada rol o agente especializado (`/admin`, `/legal`, `/marketing`, `/gimnasio`, etc.).
  * Cada carpeta de agente contiene sus propias directivas de sistema (*System Prompts*), archivos de memoria a corto/largo plazo y registros de actividad.
* **Automatización Proactiva con Cron Jobs:**
  * Configuración de tareas programadas en el sistema operativo (Cron jobs o programadores de tareas) que se ejecutan cada cierto intervalo de tiempo (ej. cada 30 minutos).
  * Estas tareas invocan de manera no interactiva a los arneses para que revisen bandejas de entrada, calendarios o estados de proyectos y actúen por iniciativa propia.
* **Conectividad con Herramientas Externas:**
  * Uso de **Composio** (recomendado mediante su CLI para optimizar el consumo de tokens y la gestión de credenciales) para conectar los agentes con servicios del mundo real: Gmail, Google Calendar, HubSpot, Notion, entre otros.
* **Gestión Avanzada de Memoria ("Cerebros" y Dossiers):**
  * Discusión sobre cómo mantener la memoria de los agentes limpia y actualizada.
  * Uso de estructuras basadas en archivos Markdown (tipo Obsidian) combinadas con motores de extracción de entidades (como **Gbrain**). Esto permite que los agentes actualicen expedientes, perfiles de clientes o bases de conocimiento de forma viva, evitando la saturación del contexto en cada ejecución.

---

## 5. Conclusiones y Siguientes Pasos
* El taller enfatiza que **no se requiere saber programar desde cero** gracias a que las mismas inteligencias artificiales (asistidas por los arneses) pueden generar, corregir y mantener el código de los scripts de automatización.
* El siguiente paso práctico consiste en instalar el entorno de terminal, configurar el primer arnés en modo no interactivo, enlazar una herramienta externa vía Composio y probar la primera tarea automatizada en segundo plano.