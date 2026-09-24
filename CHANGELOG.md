# Changelog

Cambios notables de Ampere Core, versión por versión. Formato inspirado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/) con sufijo de pre-release (`-beta.N`) mientras
dure la Beta privada.

## [Sin publicar]

### Corregido

- `CLAUDE.md` ahora incluye `Progreso del proyecto` dentro de la zona
  `ARNES:PRESERVE`, de modo que memoria de errores, progreso e hitos operativos del
  proyecto se conserven por fusión explícita durante `/update`, no solo por detección
  genérica de conflicto.
- `/update` ahora documenta un postflight para reconciliar `.gitignore` y documentos
  raíz fuera del manifiesto cuando la versión nueva del arnés los requiere o los
  referencia desde `CLAUDE.md`.

## [0.9.0-beta.8] - 2026-08-01

### Agregado

- `ampere detach [target] [--dry-run]` (`.claude/scripts/detach-ampere-core.js`): quita
  Ampere Core de un proyecto — lo contrario de `ampere install`, pensado para el momento
  de entregar o publicar el repo. Mismo patrón "planificar, después aplicar" que
  `install`/`resolve`: `planDetach()` solo lee y `applyDetach()` es lo único que escribe
  o borra, así `--dry-run` y la corrida real comparten exactamente el mismo cálculo.
  Regla madre: **solo borra lo que puede probar que es del arnés**, y ante duda no toca
  nada y reporta revisión manual. Cada regla tiene su prueba de identidad explícita —
  `.claude/{agents,commands,hooks,scripts,security,templates}` y los archivos que genera
  el propio arnés se borran enteros (todo archivo que difiera del manifiesto baseline se
  respalda antes); `CLAUDE.md`/`claude.md` solo por bloque marcado
  `<!-- AMPERE CORE BEGIN/END -->` o por hash byte a byte igual al que registró la
  instalación (una memoria de errores editada a mano queda para revisión manual, nunca se
  borra); `.claude/settings.json` pierde únicamente las entradas de hook idénticas a las
  de Ampere, preservando `permissions` y cualquier hook ajeno, y un JSON inválido bloquea
  con exit 2 sin mutar nada; `.gitignore`/`.gitattributes` solo por bloque marcado
  `# BEGIN/END AMPERE CORE` o por las líneas exactas que `INSTALL-STATE.json` registra
  como agregadas (y solo si cada una aparece una vez: repetida es ambigua y no se toca);
  los hooks Git nativos solo si coinciden byte a byte con el wrapper que instaló el arnés
  (un hook editado o ajeno se reporta y los demás se quitan igual); y los documentos de
  raíz (`README.md`, `INSTALAR.md`, `NOTICE.md`, `CHANGELOG.md`, `COMMAND_INDEX.md`) solo
  si su hash coincide con el registrado. El histórico del proyecto (`.claude/audits/`,
  `feedback/`, `ship/`, `logs/`, `resolved-sidecars/`) nunca se borra: se conserva y se
  reporta. Lo que se modifica en el lugar se respalda en
  `.claude/detach/<fecha-hora>/backups/`; lo que se borra con identidad probada byte a
  byte no se respalda. Un detach limpio puede llegar a eliminar `.claude/` por completo,
  cuando no queda histórico del proyecto, backups de la corrida ni ningún otro residuo.
  Con una excepción deliberada: las reglas que protegen secretos (`.env`, `.env.local` y
  equivalentes) NUNCA se quitan del `.gitignore`, ni siquiera estando dentro del bloque
  gestionado — se conservan o se reubican fuera del bloque, con un encabezado que explica
  por qué siguen ahí. Quitar el arnés desinstala también los hooks Git y el escaneo de
  secretos, así que borrar esas reglas dejaría el `.env` real listo para un commit
  accidental; si aun así queda un `.env*` sin ignorar, el comando degrada a exit 1 con un
  aviso destacado. Cuando queda runtime, backups, sidecars sin resolver o material
  ambiguo, el comando no declara "completo": reporta el residuo por categoría y lo que
  necesita revisión. Mismos códigos de salida 0/1/2 que el resto del arnés.
- `/resume` (`.claude/commands/resume.md`): reconstruye el contexto de un proyecto que
  venía a medias (estado del arnés, Blueprint, `BUILD-STATE`, auditorías, entregas,
  `git`, `doctor`) y recomienda **un** próximo paso concreto, más lo que NO hay que hacer
  todavía. De solo lectura por contrato explícito: no construye, no corrige, no instala y
  no modifica; los únicos comandos que puede correr son de diagnóstico.
- `COMMAND_INDEX.md`: índice único de comandos de terminal (`ampere ...`) y slash
  (`/...`), con el flujo recomendado situación por situación y qué **no** trae esta
  edición. Entra al payload de instalación y al paquete de release.

### Cambiado

- Trazabilidad para poder desmontar: lo que el arnés agrega a archivos que no son suyos
  queda ahora dentro de bloques marcados. `install-ampere-core.js` fusiona el
  `.gitignore` dentro de `# BEGIN AMPERE CORE` / `# END AMPERE CORE` de forma idempotente
  (si el bloque ya existe, las entradas faltantes se insertan adentro en vez de crear un
  segundo bloque), `.gitattributes` trae sus reglas dentro del mismo bloque, y
  `resolve-sidecars.js` escribe la sección Ampere Core de `CLAUDE.md` dentro de
  `<!-- AMPERE CORE BEGIN -->` / `<!-- AMPERE CORE END -->` — y esa sección ahora lista
  también `/resume`.
- `.claude/INSTALL-STATE.json` registra `detach_support`: versión del contrato, presencia
  de cada bloque marcado, entradas agregadas al `.gitignore` y hash de los archivos de
  raíz que quedaron byte a byte iguales a la fuente. Es la evidencia que `detach` usa
  para no adivinar.

### Compatibilidad

- Una instalación anterior a esta versión no tiene bloques marcados ni `detach_support`.
  Nada se envuelve retroactivamente (envolver texto ajeno en un bloque que después se
  borra entero es exactamente el riesgo que la regla 9 prohíbe): `detach` usa la
  evidencia de `INSTALL-STATE.json` cuando la hay, y cae a revisión manual cuando no.
  Correr `ampere update` sobre esos proyectos los deja con los bloques marcados de aquí
  en adelante.

## [0.9.0-beta.7] - 2026-07-30

### Agregado

- `ampere resolve [target] [--dry-run]` (`.claude/scripts/resolve-sidecars.js`):
  resuelve de forma segura los sidecars `.nuevo-*` que `ampere install`/`ampere
  update` dejan pendientes al colisionar con un proyecto existente. Nunca reemplaza
  `README.md`/`CLAUDE.md` a ciegas: `README.md.nuevo-*` se archiva como referencia en
  `.claude/resolved-sidecars/<fecha-hora>/sidecars/` sin tocar el `README.md` del
  proyecto; `CLAUDE.md.nuevo-*` agrega (con backup previo en
  `.claude/resolved-sidecars/<fecha-hora>/backups/`) una sección mínima "## Ampere
  Core" al final de `CLAUDE.md`/`claude.md`, sin fusionar el sidecar completo ni
  duplicar la sección si ya está; `.claude/settings.json.nuevo-*` fusiona hooks/claves
  faltantes sobre el `settings.json` actual (con backup previo en el mismo directorio
  de corrida), preservando `permissions` y hooks existentes de otras herramientas, con
  dedupe estructural (nunca solo por string) y tolerando un BOM inicial en cualquiera
  de los dos JSON. Todo el histórico de una corrida (backups + sidecars archivados)
  queda agrupado bajo un único directorio `.claude/resolved-sidecars/<fecha-hora>/`,
  nunca junto al archivo original — ese directorio está en `.gitignore`, así que
  `ampere resolve` nunca deja contenido potencialmente privado listo para un commit
  accidental. Si algún sidecar de la corrida queda bloqueado por un error estructural
  (ej. JSON inválido), NINGÚN sidecar de esa corrida se aplica — cero mutación
  parcial, no solo el archivo bloqueado. Cualquier sidecar que no encaje en estas
  reglas queda reportado como pendiente de revisión manual (exit 1) — eso no bloquea a
  los demás, y nunca se borra ni se archiva solo. Mismos códigos de salida 0/1/2 que
  `install`/`doctor`; `ampere doctor` ahora excluye `.claude/resolved-sidecars/**` de
  su chequeo de sidecars pendientes, así que queda en `SANO` si eso era lo único
  pendiente.

### Corregido

- `ampere doctor` y `ampere update` ahora rechazan flags desconocidos antes de
  resolver destino o ejecutar `git pull`, evitando que typos como `--surface` o
  `--no-pul` se interpreten de forma silenciosa.
- `.gitattributes` ahora fija su propio EOL como LF para reducir diferencias
  fantasma entre checkouts.
- El resumen interno del CLI ahora lista también `ampere resolve` y `ampere
  self-update`, alineado con los comandos reales disponibles.

## [0.9.0-beta.5] - 2026-07-23

### Corregido

- `ampere self-update` (`tools/ampere-cli/bin/ampere.js`) ya no asume `origin main`
  como upstream fijo: ahora resuelve el upstream real de la rama actual
  (`git rev-parse --abbrev-ref --symbolic-full-name @{u}`) y corre
  `git pull --ff-only` respetándolo — necesario de cara a un solo Ampere Core
  multi-superficie, donde distintas copias centrales pueden no vivir en `main`. Si la
  rama actual no tiene upstream configurado, `self-update` se detiene con exit 2 y un
  mensaje claro (en vez de fallar de forma confusa contra un remoto/rama inexistente),
  tanto en `--dry-run` como en corrida real.

## [0.9.0-beta.4] - 2026-07-23

### Agregado

- `ampere self-update` (`tools/ampere-cli/bin/ampere.js`): actualiza la copia central
  desde la que está linkeada la CLI (`git pull --ff-only origin main` + `npm install` +
  `npm link` en `tools/ampere-cli`), sin tocar ningún proyecto destino. Flags
  `--no-link` (no rehace el enlace global) y `--dry-run` (muestra el plan sin ejecutar
  nada). Nunca usa `git reset --hard` ni `git clean`; si la copia central tiene cambios
  locales reales sin commitear, se detiene antes de `git pull` (regla 9) — un
  "modificado fantasma" de solo fin de línea se autocura igual que en `ampere update`.
- `ampere install`/`install-ampere-core.js` ahora clasifica el destino ANTES de aplicar
  cualquier cambio e imprime el resultado real: carpeta vacía, proyecto existente con
  código (con la garantía explícita de que `src/`, `package.json`, `pyproject.toml`,
  `requirements.txt` y configs propias no se tocan), o Ampere Core ya instalado. Solo
  informativo — no cambia ninguna decisión de sidecars ni el alcance gestionado.

### Corregido

- `.gitattributes` ahora fija LF también para `BLUEPRINT-*.md` y
  `STACK-PROFILE-*.md`, evitando fallos falsos de `approve-blueprint.js
  verify-recorded` en Windows por diferencias CRLF/LF aunque el contenido visible sea
  equivalente.
- `.gitignore` requerido por el instalador agrega `/data/`, `/outputs/` y `/logs/`
  anclados a la raíz. Esto ignora artefactos runtime de proyectos sin ocultar paquetes
  internos legítimos llamados `outputs`, `data` o `logs` bajo `src/`.
- `/ship` ahora exige una respuesta visible final con veredicto, SHA entregado, ruta de
  reporte, auditoría usada, validaciones corridas y estado final; crear
  `.claude/ship/SHIP-*.md` en silencio ya no es suficiente.
- `approve-blueprint.js` ya no interpreta un encabezado de sublista con contenido
  subordinado como campo vacío sin resolver (ej. `- Reglas propias del usuario:`
  seguido de viñetas indentadas). Los campos realmente vacíos y placeholders siguen
  bloqueando.

### Documentación / Beta

- Se documenta la convención segura para ejemplos de variables: en documentación
  narrativa usar nombres como `OPENAI_API_KEY` sin asignación; para `.env.example`,
  usar placeholders claramente falsos. El bloqueo fuerte de `.env` reales se mantiene.
- Se agrega nota para PowerShell/Windows cuando la consola muestra UTF-8 como mojibake
  (`Ã³`, `â€”`, etc.): los archivos no necesariamente están dañados; puede fijarse la
  salida con `$OutputEncoding = [Console]::OutputEncoding =
  [Text.UTF8Encoding]::new()`.
- `/audit` recuerda probar `--help` en CLIs y el caso específico de Python/argparse con
  `%` en textos de ayuda (`100%% offline` o evitar `%`).

## [0.9.0-beta.1] - 2026-07-14

Primera versión con número propio — arranca la Beta privada.

### Seguridad / robustez

- La proveniencia Git del manifiesto (`source_kind: "git"`) ahora se verifica antes
  de declararse, no se asume: la raíz usada debe ser el toplevel Git real (no un
  subdirectorio de un repo ancestro no relacionado), un archivo gestionado ignorado
  por `.gitignore` o marcado `skip-worktree`/`assume-unchanged` ya no se cuela como
  "limpio", y se reconocen commits tanto SHA-1 como SHA-256.
- El validador del manifiesto v2 y `safe-replace-file.js` rechazan explícitamente
  cualquier ruta fuera del alcance gestionado por el arnés (rutas absolutas, `..`,
  separador backslash, drive letter, UNC) — `safe-replace-file.js` ahora exige
  `--root` en sus 3 modos y verifica contención real antes de escribir o borrar.
- La instalación de los hooks Git nativos (`install-git-hooks.js`) es transaccional
  (todo-o-nada entre los 4 hooks) y bloquea por defecto si `core.hooksPath` apunta a
  una ruta externa o potencialmente compartida con otro repositorio.

### Agregado

- `.claude/ARNES-VERSION` — versión del arnés, leída por el manifiesto v2
  (`arnes_version`).
- `.gitattributes` — fija el fin de línea (LF) de los archivos gestionados por el
  arnés, para que el hash de identidad (`hash_raw`) del manifiesto no dependa de la
  configuración local de Git de cada colaborador.
- **Instalador asistido** (`.claude/scripts/install-ampere-core.js`, B2): reemplaza la
  copia manual/`git archive | tar -x` (que podía sobrescribir archivos existentes si
  se usaba sobre un proyecto no vacío) por un flujo que planifica todo antes de
  escribir un solo byte (`--dry-run`), rechaza destinos peligrosos (carpeta de
  usuario, raíz de disco, cualquier cosa que no sea la raíz de un repo Git), y ante
  cualquier colisión real escribe la versión nueva al lado como
  `<archivo>.nuevo-YYYYMMDD-HHMMSS` en vez de pisar — `CLAUDE.md` es la única
  excepción, con fusión automática de la zona `ARNES:PRESERVE` si ya existe. Al
  terminar, instala los hooks Git nativos, corre su propio `--self-test`, escribe la
  baseline del manifiesto (`--write-baseline-from` la fuente) y deja
  `.claude/INSTALL-STATE.json` (estado de la instalación — runtime, nunca entra al
  manifiesto).
- **Diagnóstico** (`.claude/scripts/doctor.js`, B2): batería de solo-lectura que
  confirma que un proyecto con el arnés instalado sigue sano — manifiesto v2 válido,
  `arnes_version` alineada con la baseline, hooks Git activos, `.gitattributes`/
  `.gitignore` completos, sin sidecars `.nuevo-*` pendientes, sin documentos privados
  colados en el destino. Salida humana por defecto o `--json` para scripts/CI; código
  de salida `0`/`1`/`2` (sano / necesita revisión / bloqueado-roto), mismo criterio
  que el instalador.
- `.claude/INSTALL-STATE.json` agregado al alcance excluido del manifiesto
  (`managed-path.js`) y a las entradas requeridas de `.gitignore` — es estado de
  instalación generado en runtime, no contenido que el arnés entregue.

### Documentación

- `README.md`/`INSTALAR.md` (B2): el instalador asistido pasa a ser el camino
  recomendado; la instalación manual queda documentada como respaldo avanzado.

### Corregido (B3)

- `CLAUDE.md` (regla de oro 8 y sección "Progreso del proyecto"), `build.md` (sección
  4.3) y el frontmatter de `docs-keeper.md` decían o implicaban que el progreso de
  construcción (estado de fases, aprendizajes) se registraba dentro del Blueprint —
  contradiciendo la regla de inmutabilidad que el resto del arnés (`builder.md`,
  `BUILD-STATE-template.md`, `build-state.js`) ya aplicaba correctamente. Ahora los 4
  documentos coinciden: el Blueprint aprobado es contrato inmutable, el progreso real
  vive siempre en `BUILD-STATE-[proyecto].json`.
- `/reportar` creaba `REPORTE-ARNES.md` en la raíz del proyecto — quedaba trackeado (o
  sin trackear) según el `.gitignore` de cada proyecto, podía colarse en una auditoría,
  y no tenía ninguna advertencia sobre secretos/datos sensibles antes de compartirlo.
  Ahora escribe en `.claude/feedback/REPORTE-ARNES-YYYYMMDD-HHMMSS.md` (runtime local,
  excluido del manifiesto y de `.gitignore` por defecto — ver `managed-path.js`), un
  archivo nuevo por sesión, con una advertencia explícita de revisar/redactar antes de
  compartir y sin copiar logs completos.
- `/ship` asumía push o deploy externo como único destino de entrega — un proyecto de
  Beta privada sin remoto configurado no tenía una vía clara para "entregar". Ahora
  ofrece **entrega local Beta** (`.claude/ship/SHIP-YYYYMMDD-HHMMSS.md`, runtime local)
  cuando no hay remoto/deploy configurado, sin inventar un destino externo que el
  usuario nunca pidió — `.claude/ARNES-LAST-SHIP.txt` sigue siendo el puntero real para
  el cálculo de diff de la próxima corrida, ambos conviven.
- `NOTICE.md`/`COMO-COMPARTIR.md` (este último privado, gitignored) todavía describían
  `/reportar` con el diseño viejo (archivo único en la raíz) — actualizados.
- `INSTALAR.md` (vía manual): el payload y las entradas de `.gitignore` documentadas
  habían quedado desactualizadas desde B1/B2 (faltaban `README.md`/`CHANGELOG.md`/
  `.gitattributes` en el payload, y `.claude/INSTALL-STATE.json`/`.claude/feedback/`/
  `.claude/ship/` en el `.gitignore`) — corregido, alineado con
  `REQUIRED_GITIGNORE_ENTRIES`.

### Agregado (B4)

- **E2E real** (`.claude/scripts/run-e2e.js`): 6 recorridos completos contra repos Git
  temporales descartables, usando el instalador y el doctor reales como subprocesos
  (no sus funciones internas) — instalación limpia, colisión real con sidecar,
  destino bloqueado (`.claude` como archivo, sin stack crudo ni exit genérico),
  runtime de `/reportar`/`/ship` fuera del manifiesto, y reinstalación idempotente.
  Sin dependencia de `bash` — solo Node stdlib y `git`, corre igual en PowerShell/
  Windows y en Ubuntu. `--keep-temp` y `--scenario <nombre>` para depurar un caso
  puntual.
- **CI mínima** (`.github/workflows/ci.yml`): `windows-latest` + `ubuntu-latest` en
  cada push/PR — `node --check` de todos los `.js` del arnés, la batería completa de
  `.claude/hooks/test-*.sh` (solo en Ubuntu — Windows no depende de `bash` a
  propósito), y `run-e2e.js` en ambos. No publica ni taggea ninguna release.

### Agregado (B5)

- **Empaquetador de release** (`.claude/scripts/make-release-package.js`): genera
  `dist/ampere-core-<versión>/` desde el árbol actual del repo — sin `.git/`,
  documentos privados, ni runtime — para entregar la Beta como ZIP o como primer
  commit de un repo limpio, sin tocar la historia del repo de desarrollo. Reusa
  `computePayload()` del instalador (B2) en vez de reimplementar una lista de paths
  divergente. Antes de construir verifica (sin bandera de skip) que la fuente está
  limpia, que `make-manifest.js` confirma proveniencia Git válida, y que
  `run-e2e.js` pasa contra la fuente; después de construir verifica de nuevo,
  corriendo `run-e2e.js` y `make-manifest.js` **desde dentro** del paquete generado.
  `--zip` (ZIP writer mínimo puro Node, método STORED, sin depender de un paquete
  npm ni de un binario del sistema) y `--verify` (re-verifica un paquete ya
  construido sin reconstruir). `dist/<paquete>.SHA256SUMS.txt` con el hash de cada
  archivo, fuera del paquete.

### Corregido (B5)

- `install-ampere-core.js`: `listSourceTrackedFiles()` tiraba si la fuente no tenía
  un `.git` resoluble — descubierto corriendo `run-e2e.js` desde dentro de un
  paquete de release recién generado (deliberadamente sin `.git/`), 5 de 6
  escenarios fallaban. Ahora cae a caminar el filesystem completo cuando no hay
  Git disponible, mismo criterio que `detectSource()` en `make-manifest.js` ya usa
  para "sin git resoluble" (degradado, nunca fatal) — el instalador funciona igual
  desde un ZIP extraído o desde un paquete de release.
- `make-release-package.js`: el writer de ZIP escribía `0o100644 << 16` sin forzar
  unsigned — `<<` en JS devuelve un entero con signo, y ese valor desborda el bit
  31 y se vuelve negativo, reventando `--zip` en toda corrida. Corregido con
  `>>> 0`.

## [0.9.0-beta.2] - 2026-07-15

CLI global `ampere` (B6). El tag `v0.9.0-beta.1` sigue apuntando a la Beta anterior
(sin CLI) — no se movió ni se reescribió; esta es una versión nueva, no una
corrección retroactiva de esa.

### Agregado (B6)

- **CLI global `ampere`** (`tools/ampere-cli/`): convierte la copia central clonada
  de Ampere Core en un comando instalable con `npm link` (modelo de copia central
  clonada una sola vez) —
  `ampere --version`, `ampere help`, `ampere install [target]`,
  `ampere doctor [target]` y `ampere update [target] [--no-pull]`, invocables desde
  cualquier proyecto sin memorizar rutas a `.claude/scripts/*.js`. Router delgado sin
  dependencias externas: resuelve la raíz central desde su propia ubicación
  (`tools/ampere-cli/bin/ampere.js` -> 3 niveles arriba), valida que sea una copia
  real de Ampere Core antes de operar, resuelve `[target]` siempre contra el cwd del
  usuario (nunca contra la raíz central, mostrando siempre la ruta resuelta antes de
  operar), y delega en `install-ampere-core.js`/`doctor.js` reales como subprocesos,
  propagando sus códigos de salida (0/1/2) tal cual. `ampere update` corre
  `git pull --ff-only` en la copia central (deteniéndose con mensaje claro ante
  cambios locales, conflictos, HEAD desacoplado o falta de remoto — `--no-pull`
  saltea el pull) y encadena `install` + `doctor` sobre `[target]`.
- **Tests de la CLI** (`.claude/scripts/test-ampere-cli.js`): mismo patrón que
  `run-e2e.js` (solo Node stdlib + `git`, repos temporales descartables, subprocesos
  reales) — 12 escenarios: versión, ayuda, instalación limpia, doctor sano, doctor
  sobre proyecto sin instalar, `update --no-pull`, invocación desde otro cwd, target
  relativo resuelto contra el cwd del usuario, target implícito (cwd), target sin
  repo Git, ausencia de documentos privados, y `package.json` con `bin.ampere`
  correcto. Conectado a `ci.yml` (Windows + Ubuntu), condicionado (defensivamente,
  ver B6-FIX-01 más abajo) a que `tools/ampere-cli` exista.
- `README.md`/`INSTALAR.md`: nueva sección "Uso recomendado: una copia central +
  comando global `ampere`" documentando el flujo completo de instalación por copia
  central (clonar una vez, `npm link`, `ampere install`/`doctor`/`update` desde
  cualquier proyecto).

### Corregido (B6-FIX-01, hallazgo real de Codex)

- `make-release-package.js` armaba el paquete limpio a partir de `computePayload()`
  (el mismo alcance que instala en un proyecto destino: `.claude/**`/`CLAUDE.md`/
  documentos de producto) más un puñado de extras explícitos — `tools/ampere-cli/`
  (la CLI agregada por B6) nunca estaba en esa lista, así que el paquete de release
  quedaba **sin** la CLI global mientras que clonar el repo desde GitHub sí la
  traía: dos canales de distribución con capacidades distintas, exactamente lo que
  una Beta no puede permitirse (instrucciones que dependen de un archivo que un
  canal no tiene). Reproducido por Codex: `Test-Path
  dist/ampere-core-0.9.0-beta.1/tools` daba `False` tras un build real. Fix:
  `tools/ampere-cli/package.json` y `tools/ampere-cli/bin/ampere.js` se agregan a
  `EXTRA_RELEASE_FILES` (lista explícita, mismo criterio que `.gitignore`/`ci.yml` —
  nunca "todo `tools/**`", así que un futuro `node_modules/` sin trackear no puede
  colarse por arrastre) y a `REQUIRED_PACKAGE_FILES`; `verifyPackageStructure()`
  ahora también falla si `tools/ampere-cli/node_modules/` aparece en el paquete
  generado, y `verifyPackageRuns()` corre
  `tools/ampere-cli/bin/ampere.js --version` **desde dentro** del paquete y compara
  contra `.claude/ARNES-VERSION` — "el archivo está" y "la CLI corre de verdad" son
  chequeos distintos. Test de regresión: Caso 13 en
  `.claude/hooks/test-release-package.sh`.
- `.gitignore`: agregada entrada `node_modules/` (faltaba — `tools/ampere-cli` es el
  primer subproyecto Node de este repo).

### Corregido (B6-FIX-02, hallazgo real de Codex)

- `README.md` todavía describía el modelo de distribución pre-B6: "este repo es el
  taller de desarrollo... no se comparte directamente" y "no se publica como GitHub
  release ni se taggea todavía" — ambas afirmaciones ya eran falsas (el plan
  vigente es que colaboradores Beta clonen el repo privado y usen `npm link`; el
  tag `v0.9.0-beta.1` ya existe). Reescrita como "Distribución Beta privada": canal
  recomendado = clonar + CLI global; el ZIP de `make-release-package.js` queda
  documentado como snapshot verificable de respaldo (que desde B6-FIX-01 también
  incluye la CLI), no como el flujo principal. Comentario en `ci.yml` actualizado
  para no afirmar que el paquete de release "no incluye tools/" — desde B6-FIX-01 sí
  lo incluye; el condicional que salta ese paso queda como defensa mínima, no como
  reflejo de una limitación real.

### Corregido (B6-FIX-03, hallazgo real de Codex)

- El primer paso documentado del flujo de instalación global (`npm install` en
  `tools/ampere-cli`)
  generaba `package-lock.json` sin trackear cada vez, dejando el clon central sucio
  (`?? tools/ampere-cli/package-lock.json`) — mala experiencia para el primer paso
  recomendado, y un obstáculo potencial para el `git pull --ff-only` que corre
  `ampere update`. Reproducido por Codex: `npm install --package-lock-only
  --ignore-scripts` seguido de `git status --short` mostraba el lockfile como
  `??`. Fix: se generó y trackeó `tools/ampere-cli/package-lock.json`; se agregó a
  `EXTRA_RELEASE_FILES`/`REQUIRED_PACKAGE_FILES` en `make-release-package.js` junto a
  `package.json`/`bin/ampere.js` (`node_modules/` sigue explícitamente fuera). Test
  de regresión: Caso 14 en `.claude/hooks/test-release-package.sh` (lockfile
  presente en la fuente, presente en el paquete).

### Corregido (B6-FIX-04, hallazgo real de Codex)

- Esta versión seguía declarándose `0.9.0-beta.1` en `.claude/ARNES-VERSION` y en
  `tools/ampere-cli/package.json`, pero el tag `v0.9.0-beta.1` ya existe y apunta a
  la Beta anterior (B5, sin CLI global) — mergear B6 sin subir versión habría dejado
  dos productos distintos reclamando el mismo número (`v0.9.0-beta.1` sin `ampere`
  vs. `main` post-B6 con `ampere`, ambos "`0.9.0-beta.1`"), rompiendo trazabilidad
  para cualquiera que comparara una instalación contra el tag. Fix: `.claude/
  ARNES-VERSION` y `tools/ampere-cli/package.json` suben a `0.9.0-beta.2` (esta
  versión); el tag `v0.9.0-beta.1` no se tocó ni se movió — sigue apuntando al
  commit de B5 tal como estaba.

## [0.9.0-beta.3] - 2026-07-17

Hotfix final post-auditoría de Fable 5 (High) sobre `0.9.0-beta.2` — dos hallazgos
reales con reproducción, cerrados antes de entregar la Beta privada a los usuarios de
confianza. No agrega features ni refactoriza nada; solo cierra los dos tornillos que
la auditoría encontró. Los tags `v0.9.0-beta.1` y `v0.9.0-beta.2` no se movieron.

### Corregido (FABLE-A01, hallazgo real de Fable)

- `.gitattributes` no fijaba el fin de línea de `tools/**`, solo de `CLAUDE.md` y
  `.claude/**`. En Windows, `npm link`/`npm install` (paso de setup documentado del
  flujo de instalación global) reescribe `tools/ampere-cli/bin/ampere.js` con CRLF, y sin la regla
  `eol=lf` eso deja la copia central "modificada" (`git status` muestra
  `M tools/ampere-cli/bin/ampere.js`) apenas se corre el setup — y luego puede
  **abortar el `git pull --ff-only` de `ampere update`** si una actualización futura
  toca ese archivo, con el usuario viendo un "cambios locales sin commitear" que nunca
  hizo. Reproducido: `git clone` + `npm link` dejaba el bin en CRLF y `git status`
  dirty; un `pull --ff-only` sobre un origin que tocaba el bin abortaba con exit 1.
  Fix: agregada la regla `tools/** text eol=lf` a `.gitattributes`. Confirmado con
  `git check-attr eol -- tools/ampere-cli/bin/ampere.js` → `eol: lf`. Test de
  regresión: Casos 16-17 en `.claude/hooks/test-workflow-docs-coherence.sh`
  (consultan a `git check-attr` directamente, no el texto de `.gitattributes`).

### Corregido (FABLE-A02, hallazgo real de Fable)

- `doctor.js` validaba que el manifiesto baseline fuera estructuralmente válido y
  recalculaba un manifiesto fresco desde el disco, pero **nunca comparaba que cada
  ruta listada en `ARNES-MANIFEST.json.files` siguiera existiendo** en el destino —
  así, borrar un archivo gestionado después de una instalación limpia (ej.
  `rm .claude/commands/plan.md`) dejaba a doctor reportando SANO/exit 0 con un comando
  roto invisible al diagnóstico (un falso "SANO"). Reproducido: install limpio →
  doctor SANO → borrar `plan.md` → doctor seguía SANO. Fix: nuevo check aditivo y de
  solo lectura `checkManifestFilesPresent()` que recorre `baselineManifest.files` y
  verifica `fs.existsSync` de cada ruta; cualquier faltante baja el resultado a
  NECESITA REVISIÓN (warn/exit 1), listando las primeras rutas faltantes y el total.
  Nunca reescribe el manifiesto ni intenta reparar — solo diagnostica. Test de
  regresión: Caso 10 en `.claude/hooks/test-doctor.sh`.

### Versión

- `.claude/ARNES-VERSION`, `tools/ampere-cli/package.json`,
  `tools/ampere-cli/package-lock.json`, `README.md` suben a `0.9.0-beta.3`. Los tags
  `v0.9.0-beta.1`/`v0.9.0-beta.2` no se tocaron: apuntan a las Betas anteriores tal
  como estaban.
