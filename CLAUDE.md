# [NOMBRE-PROYECTO] — Marco de trabajo

<!-- Ver NOTICE.md — acceso compartido en confianza, no distribuir fuera de los colaboradores del repo. -->

Este proyecto usa un flujo de trabajo de 4 pasos para construir software con ayuda de
un agente de IA: **planificar → construir → auditar → entregar**. El objetivo es que la
IA nunca construya sin plano, nunca repita un error dos veces, y nunca decida sola algo
que le corresponde decidir al humano.

```
/plan   → produce y aprueba BLUEPRINT-[nombre-proyecto].md
/build  → construye fase por fase a partir del Blueprint aprobado
/audit  → audita el proyecto completo, puntaje 0-100, hallazgos críticos bloquean
/ship   → tests + revisión + commit + entrega, con confirmación humana
```

Y uno auxiliar, fuera del ciclo: `/resume` reconstruye el contexto de un proyecto que
venía a medias y recomienda cuál de los cuatro pasos sigue. Es de solo lectura — no
construye, no corrige, no modifica nada.

Índice completo de comandos (terminal y slash): [COMMAND_INDEX.md](COMMAND_INDEX.md).

Instrucciones detalladas de cada paso: `.claude/commands/plan.md`, `build.md`,
`audit.md`, `ship.md`. Plantillas de los documentos que se producen:
`.claude/templates/`.

## Perfil de stack de este proyecto

Ver `STACK-PROFILE-[nombre-proyecto].md`. Ninguna decisión técnica (lenguaje, framework,
base de datos, deploy) se toma sin consultar ese archivo primero. Si no existe todavía,
`/plan` lo crea la primera vez.

## Reglas de oro

1. **Plano primero.** No se escribe código de la aplicación sin un Blueprint aprobado
   explícitamente por el humano.
2. **Un solo stack por proyecto.** Una vez decidido en el perfil de stack, no se cambia
   a mitad de camino sin que el humano lo pida.
3. **El humano es quien aprueba, no la IA.** Cada fase de construcción, cada entrega, y
   cada decisión irreversible requieren un "sí" explícito en la conversación.
4. **Mapear antes de planificar el detalle.** Las subtareas de una fase se generan
   mirando el estado real del código en ese momento, nunca de antemano.
5. **Cada error real se documenta para no repetirse** — ver la sección de abajo.
6. **La seguridad bloquea.** Un hallazgo crítico detiene la entrega sin importar
   cualquier otro puntaje o plazo.
7. **Nada de alcance inventado.** Si no está en el Blueprint, no se construye sin
   preguntar primero.
8. **Todo se puede pausar y retomar.** El Blueprint y el perfil de stack aprobados son
   el contrato inmutable (qué se construye); el progreso real de `/build` —qué fase va,
   aprendizajes de construcción— vive en `BUILD-STATE-[proyecto].json`, nunca dentro
   del Blueprint. Todo junto con esta memoria de errores queda en archivos versionados,
   no en la cabeza de nadie.
9. **Reversibilidad.** Ninguna automatización de este arnés debe sobrescribir trabajo
   existente sin avisar; lo que el humano ya construyó se respeta.
10. **Secretos fuera del chat.** Nunca pegar ni escribir claves de API, contraseñas o
    tokens reales dentro de la conversación con el agente — ni el humano al agente, ni
    el agente al mostrar código. Usar siempre referencias a variables de entorno
    (`process.env.LO_QUE_SEA` o el equivalente del stack). Si ya se pegó uno por error,
    tratarlo como comprometido y revocarlo/regenerarlo de inmediato, no solo borrarlo
    del historial de la conversación.
11. **Ningún paquete sin verificar.** Antes de instalar una dependencia sugerida por el
    agente (propia o de una IA en general), confirmar que el paquete existe de verdad
    en el registro correspondiente (npm, PyPI, crates.io...), tiene descargas/uso real,
    y sigue mantenido — nunca instalar a ciegas un nombre que "suena" a que debería
    existir.
12. **Pensar antes de codificar.** Antes de implementar cualquier cosa, aplicar estos
    4 principios, en este orden:
    - **Exponer suposiciones.** Decir en voz alta qué se está asumiendo antes de
      escribir código — si una suposición es incorrecta, es más barato descubrirlo
      antes de construir sobre ella.
    - **Simplicidad primero.** La solución más simple que resuelve el problema real,
      no la más general o la más "elegante". Complejidad solo cuando el problema
      concreto ya la exige, nunca por anticipar necesidades hipotéticas.
    - **Cambios quirúrgicos.** Tocar solo lo que el cambio requiere. No reformatear,
      no "aprovechar para limpiar" código que no es parte del pedido.
    - **Criterios de éxito verificables antes de implementar.** Antes de escribir
      código, decir cómo se va a comprobar que funcionó (qué test correr, qué
      comportamiento observar) — no después, como ocurrencia tardía.

---

## Memoria de errores (auto-endurecimiento)

> **No borrar ni reescribir esta sección al actualizar el proyecto.** Cada vez que un
> error real ocurra y se resuelva, se agrega una línea aquí — nunca se elimina una
> entrada existente, salvo que el humano lo pida explícitamente. Esta es la razón por
> la que el sistema deja de cometer el mismo error dos veces: el agente lee este
> archivo al empezar cada sesión.

Formato de cada entrada: `- **[fecha]:** Error: [qué pasó]. Fix: [qué se hizo]. Prevención: [qué regla o check evita que vuelva a pasar].`

<!-- Todo lo que sigue hasta el marcador END es continuidad operativa creada por este
     proyecto — memoria de errores y progreso propio — nunca contenido reemplazable del
     arnés. Si este archivo se actualiza o se reinstala el arnés, nada entre los
     marcadores se toca ni se sobrescribe. El encabezado y las instrucciones de arriba
     SÍ pueden refrescarse con una versión nueva del arnés (hallazgo real, 5ta y 6ta
     auditoría: antes el marcador START traía texto explicativo en la misma línea, y
     merge-preserve-zone.js matcheaba por prefijo — un marcador exacto y anclado a su
     propia línea es más seguro de parsear). -->
<!-- ARNES:PRESERVE:START -->

<!-- Las entradas nuevas se agregan debajo de esta línea, nunca arriba -->

- **2026-07-12:** Error: `test-runner.js` buscaba un script llamado exactamente
  `"test:related"` en `package.json`; casi ningún proyecto Node real usa ese nombre
  (la convención estándar es simplemente `"test"`), así que el hook quedaba inactivo
  en la práctica totalidad de proyectos, incluida la primera fase real de
  construcción del acortador de URLs (54 invocaciones de otros hooks en ese lapso,
  cero corridas de test automáticas). Fix: el hook ahora usa `"test:related"` si
  existe, y si no, cae de vuelta a `"test"`. Prevención: al agregar un hook que
  depende de un nombre de script convencional, verificar contra un proyecto Node real
  y estándar (no solo contra lo que "suena razonable") antes de darlo por bueno.
- **2026-07-12:** Error: `/plan` nunca preguntaba el alcance de red de un servidor
  propio (solo esta máquina / red local / público) — un proyecto de modo "solo yo,
  uso personal" terminó con el servidor escuchando en `0.0.0.0` (todas las
  interfaces), detectado recién en `/audit` como hallazgo alto. "Uso personal"
  describe quién lo usa, no desde dónde es accesible — son decisiones
  independientes que `/plan` confundía. Fix: `STACK-PROFILE-template.md` y
  `plan.md` ahora preguntan el alcance de red explícitamente para cualquier
  proyecto con servidor propio. Prevención: al definir el alcance de una pregunta
  de `/plan`, verificar que cubre la decisión técnica real, no una aproximación
  que "suena parecida".
- **2026-07-19:** Error: la primera instalación viva de Beta dejó la copia central
  "sucia" (`M tools/ampere-cli/bin/ampere.js`, EOL mixto) tras el setup documentado
  `npm install` + `npm link`. FABLE-A01 fijó `tools/** text eol=lf`, pero cambiar
  `.gitattributes` no reescribe working trees ya checked-out: una copia central
  anterior a beta.3 en Windows (autocrlf=true) conservó CRLF, y `npm link` (fixBin
  de npm) reescribió el fin de línea del shebang, haciendo visible un "modificado
  fantasma" (contenido idéntico al índice tras filtros) capaz de bloquear el
  `git pull --ff-only` de `ampere update`. Fix: `ampere update` ahora restaura desde
  el índice, antes de operar, los archivos modificados solo en working tree que
  cumplen tres condiciones a la vez: `eol=lf` fijado en `.gitattributes`, working
  tree en CRLF/mixto según `git ls-files --eol`, y hash con filtros idéntico al blob
  del índice (la igualdad de hash prueba que no se pierde trabajo real; el alcance
  acotado fue pedido por Codex en revisión). Clones frescos ya salían limpios. Prevención: un fix de
  `.gitattributes` solo cubre checkouts nuevos — siempre renormalizar o auto-curar
  los working trees existentes, y probar el flujo real (npm de verdad) sobre una
  copia vieja, no solo sobre un clon fresco.
- **2026-07-21:** Error: en el piloto de paridad Claude/Codex (`/plan` → `/build` Fase
  1-2 en ambas superficies), una corrida de Claude sobre una Herramienta interna omitió
  el filtro de viabilidad Go/No-Go de `plan.md` sección 2 — el texto anterior decía
  "Excepto en modo Landing" pero no aclaraba que ningún otro modo, ni siquiera
  Herramienta interna, puede saltarlo del todo. No se repitió en la corrida de
  confirmación, pero la ambigüedad del texto lo permitía. Fix: `plan.md` y
  `planner.md` ahora dicen explícitamente que el filtro se omite ÚNICAMENTE en modo
  Landing, y que Herramienta interna pasa por una versión breve (2-3 preguntas).
  Prevención: al escribir una excepción por modo ("excepto en X"), dejar explícito qué
  otros modos NO están exceptuados, no solo cuál sí lo está.
- **2026-07-21:** Error: en el mismo piloto, Codex agregó `process.env.PORT` durante
  `/build` sin que estuviera en el Blueprint/Stack Profile ni fuera aprobado como
  subtarea explícita — trató la configurabilidad (variable de entorno para el puerto)
  como un detalle de implementación en vez de alcance nuevo que requiere aprobación.
  Fix: `build.md` y `builder.md` ahora dicen explícitamente que la configurabilidad
  también es alcance: nada de env vars, flags, overrides, rutas configurables u
  opciones de host/puerto sin que estén en el Blueprint/Stack Profile o hayan sido
  aprobadas como subtarea antes de editar. Prevención: al revisar subtareas antes de
  aprobarlas, verificar también que no introduzcan superficie de configuración nueva no
  pedida.
- **2026-08-09:** Error: la zona `ARNES:PRESERVE` de `CLAUDE.md` protegía solo la
  memoria de errores; `Progreso del proyecto` quedaba fuera y sobrevivía a `/update`
  por detección conservadora de conflicto, no por garantía explícita de fusión. Fix: el
  template mueve `Progreso del proyecto` dentro de `ARNES:PRESERVE`, y la documentación
  y regresiones ahora tratan la zona como continuidad operativa del proyecto (memoria,
  progreso e hitos). Prevención: cuando una sección de `CLAUDE.md` sea estado propio
  del proyecto y deba sobrevivir entre sesiones, debe vivir dentro de `ARNES:PRESERVE`
  o tener una zona protegida equivalente con pruebas de merge/hash.

---

## Progreso del proyecto

- **Si la última sesión se quedó en `/plan`** (el Blueprint todavía no está aprobado):
  ver el checklist de la sección 0 de `BLUEPRINT-[nombre-proyecto].md` — qué secciones
  del documento en borrador ya están ✅.
- **Si la última sesión se quedó en `/build`** (el Blueprint ya está aprobado): ver
  `BUILD-STATE-[nombre-proyecto].json` (leerlo con `.claude/scripts/build-state.js`,
  nunca a mano) — qué fase está `⬜`/`🔄`/`✅`. El Blueprint aprobado es inmutable y
  nunca refleja este progreso; solo describe el plan.

<!-- ARNES:PRESERVE:END -->
