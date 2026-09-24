# Cómo instalar este arnés en un proyecto

La regla de oro es que instalar el arnés nunca debe destruir nada que ya exista. Desde
B2 hay un instalador asistido que aplica esa regla automáticamente — es el camino
recomendado. La vía manual (copiar archivos a mano) sigue documentada más abajo como
respaldo avanzado, para cuando el instalador no puede correr (ej. sin Node
disponible) o para entender exactamente qué hace por dentro.

## Uso recomendado: una copia central + comando global `ampere` (B6)

Modelo de copia central: el repo de Ampere Core se clona **una sola vez** en una
carpeta central, y desde ahí se instala una CLI global (`npm link`) que se puede
invocar como `ampere` desde cualquier proyecto — sin memorizar rutas a
`.claude/scripts/*.js` cada vez.

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/ampere2026/ampere_core.git
cd ampere_core
git checkout main
git pull --ff-only
```

Para la Beta viva, usá `main` actualizado. No hagas checkout a un tag anterior salvo
que Juan lo pida explícitamente: puede faltar un hotfix posterior aunque la CLI siga
reportando la misma versión Beta.

Instalar la CLI global:

```powershell
cd C:\dev\ampere_core\tools\ampere-cli
npm install
npm link
```

Verificar:

```powershell
ampere --version
ampere help
```

### Notas de instalación real en Windows / VS Code

Estas notas salen de una instalación real de Beta sobre un proyecto nuevo. No
reemplazan el flujo anterior; son las pequeñas trampas prácticas que conviene avisarle
a cualquier tester.

1. **Confirma que estás usando la copia central correcta.** Si existen carpetas
   viejas como `C:\dev\arnes_generico` y `C:\dev\ampere_core`, no asumas que son lo
   mismo. Antes de borrar o usar una, revisa:

   ```powershell
   git -C C:\dev\ampere_core remote -v
   git -C C:\dev\ampere_core status --short
   git -C C:\dev\ampere_core rev-parse --short HEAD
   ```

   La copia válida para Beta debe tener `.claude/ARNES-VERSION`,
   `tools/ampere-cli/bin/ampere.js` y responder `ampere --version` con la versión
   esperada.

2. **Copia una línea de comando a la vez.** En PowerShell es fácil pegar dos comandos
   juntos por accidente. Ejemplos reales:

   ```text
   ampere --versionampere --version
   git status --shortgit
   ```

   Eso produce errores como `Comando desconocido: "--versionampere"` o
   `unknown option 'shortgit'`. No es un fallo del arnés: borra la línea y vuelve a
   ejecutar el comando correcto, una sola vez.

3. **VS Code funciona perfecto como superficie de trabajo.** Después de instalar la
   CLI global, puedes abrir el proyecto en VS Code, usar la terminal integrada y
   ejecutar:

   ```powershell
   cd C:\dev\proyecto01
   ampere doctor
   ```

4. **Después de instalar, haz un primer commit limpio del arnés.**

   ```powershell
   git status --short
   git add .
   git commit -m "Instalar Ampere Core v0.9.0-beta.8"
   ampere doctor
   ```

   En una instalación nueva pueden aparecer warnings de Git sobre `CRLF`/`LF`. Si el
   commit termina bien y `ampere doctor` queda en `SANO`, no es bloqueante. En la
   prueba real, después del primer commit `doctor` pasó de
   `source_kind=unverified-directory` a `source_kind=git` apuntando al commit inicial
   del proyecto.

5. **Revisa la copia central después de `npm link`.** Si `git status --short` dentro
   de la copia central muestra modificado `tools/ampere-cli/bin/ampere.js` después de
   `npm link`, es una reescritura de finales de línea de Windows sobre una copia
   central checked-out antes de beta.3 (los clones nuevos no lo sufren). No hay
   contenido real cambiado: `ampere update` lo normaliza solo antes de hacer
   `git pull --ff-only`, o podés limpiarlo a mano con
   `git -C <ruta-copia-central> checkout -- tools/ampere-cli/bin/ampere.js`.
   Solo repórtalo como fricción Beta si reaparece después de eso o si
   `git diff` muestra cambios de contenido de verdad.

Crear (o vincular) un proyecto:

```powershell
mkdir C:\dev\project01
cd C:\dev\project01
git init
ampere install --dry-run
ampere install
ampere doctor
```

Para testers en Windows/VS Code: copia y ejecuta esos comandos **una línea a la vez**,
aunque PowerShell acepte pegar varias líneas juntas. En la prueba real, pegar el bloque
completo funcionó, pero mantenerlo línea por línea hace más fácil detectar exactamente
en qué paso ocurrió cualquier salida inesperada.

Actualizar más adelante (trae cambios de GitHub a la copia central con
`git pull --ff-only`, después reinstala y corre doctor sobre el proyecto):

```powershell
ampere update
```

O con ruta explícita, desde cualquier carpeta:

```powershell
ampere install C:\dev\project01 --dry-run
ampere install C:\dev\project01
ampere doctor C:\dev\project01
ampere resolve C:\dev\project01 --dry-run
ampere resolve C:\dev\project01
ampere detach C:\dev\project01 --dry-run
ampere detach C:\dev\project01
ampere update C:\dev\project01
ampere update C:\dev\project01 --no-pull   # reinstala sin traer cambios de GitHub
```

Sin `[target]`, cada comando usa el directorio actual; una ruta relativa se resuelve
contra ese directorio actual (nunca contra la copia central). `ampere doctor` corre el
`doctor.js` que quedó instalado **dentro** del proyecto destino — si el proyecto
todavía no tiene el arnés instalado, falla con un mensaje claro sugiriendo
`ampere install` (`ampere resolve` hace lo mismo). `ampere update` se detiene sin tocar
nada si `git pull --ff-only` falla en la copia central (cambios locales sin commitear,
conflicto, HEAD desacoplado, o sin remoto configurado) — resolvé eso a mano en
`C:\dev\ampere_core`, o usá `--no-pull` para reinstalar desde la copia central tal
como está.

### Quitar el arnés de un proyecto (`ampere detach`)

Lo contrario de `ampere install`, para cuando vas a entregar o publicar el repo y no
querés que Ampere Core viaje con él:

```powershell
ampere detach C:\dev\project01 --dry-run   # primero: el plan, sin tocar nada
ampere detach C:\dev\project01             # lo quita de verdad
git -C C:\dev\project01 status --short     # confirmá qué cambió
```

Solo borra lo que puede **probar** que es del arnés: los bloques marcados
`# BEGIN AMPERE CORE` / `<!-- AMPERE CORE BEGIN -->`, los archivos cuyo hash coincide
con el que registró la instalación en `.claude/INSTALL-STATE.json`, y los hooks Git
idénticos byte a byte al wrapper que instaló. Tu código nunca se toca. El histórico del
proyecto (`.claude/audits/`, `feedback/`, `ship/`, `logs/`, `resolved-sidecars/`) se
conserva y se reporta; lo que modifica en el lugar se respalda antes en
`.claude/detach/<fecha-hora>/backups/`; y lo ambiguo (un `CLAUDE.md` con tu memoria de
errores editada, un hook Git modificado, un `.gitignore` de una instalación vieja sin
marcadores) se deja intacto y se reporta para revisión manual, con exit 1.

Mismos códigos de salida que el resto: `0` completo, `1` parcial/revisión manual, `2`
bloqueado sin haber tocado nada.

### Actualizar la copia central misma (`ampere self-update`)

`ampere update` actualiza la copia central y **después** reinstala/diagnostica un
proyecto destino. Si solo querés poner al día la copia central (sin tocar ningún
proyecto), usá `ampere self-update` desde `C:\dev\ampere_core`:

```powershell
cd C:\dev\ampere_core
ampere self-update
ampere --version
```

Hace, en orden: `git pull --ff-only origin main`, `npm install` y `npm link` dentro de
`tools/ampere-cli`. Nunca usa `git reset --hard` ni `git clean`, ni borra archivos; si
la copia central tiene cambios locales reales sin commitear, se detiene ANTES de tocar
`git pull` (regla 9 — nunca se pierde trabajo). Un "modificado fantasma" de solo fin de
línea (ver nota de `npm link` arriba) se autocura solo, igual que en `ampere update`.

```powershell
ampere self-update --no-link   # actualiza sin rehacer "npm link"
ampere self-update --dry-run   # muestra qué haría (pull/install/link) sin ejecutar nada
```

`self-update` nunca toma `[target]` ni toca ningún proyecto destino — opera
exclusivamente sobre la copia central desde la que está linkeada la CLI.

Esta vía **no reemplaza** al instalador asistido de abajo — `ampere install`/`ampere
doctor`/`ampere update` son exactamente los mismos `install-ampere-core.js`/
`doctor.js` invocados como subprocesos, con las rutas resueltas por vos. Si preferís
invocar los scripts directamente (sin `npm link`), seguí usando el camino de la
sección siguiente.

## Camino recomendado — instalador asistido (B2)

```powershell
node .claude/scripts/install-ampere-core.js --target <ruta-proyecto> --dry-run
```

Corré esto primero — calcula el plan completo (qué se crearía, qué colisiona) **sin
escribir un solo byte**. Revisá la salida. Si el destino no es ni siquiera un repo
Git, el instalador te lo va a decir ahí ("corré `git init` primero") — hacelo antes de
seguir.

Antes de calcular el plan, el instalador (`--dry-run` o real) siempre imprime primero
una clasificación real del destino — no un mensaje genérico, sino el resultado de
inspeccionar el filesystem:

- **Carpeta vacía** (sin nada más que `.git`): instalación inicial de Ampere Core.
- **Proyecto existente con código** (cualquier destino no vacío sin el arnés ya
  instalado, ej. con `src/`, `package.json`, `pyproject.toml`, `requirements.txt`,
  `app/`, etc.): instalación aditiva del cerebro Ampere Core — garantiza que esos
  archivos propios del proyecto quedan intactos (nunca forman parte del payload del
  instalador) y que cualquier colisión real con archivos del arnés va a sidecar
  `.nuevo-*`, nunca se pisa.
- **Ampere Core ya instalado** (ya existe `.claude/ARNES-MANIFEST.json` o
  `.claude/INSTALL-STATE.json`): reinstalación/actualización local segura.

```powershell
node .claude/scripts/install-ampere-core.js --target <ruta-proyecto>
```

Instala de verdad: copia `.claude/**` gestionado, `CLAUDE.md`, `NOTICE.md`,
`INSTALAR.md`, `README.md`, `CHANGELOG.md`, `COMMAND_INDEX.md` y `.gitattributes`;
amplía `.gitignore` solo agregando líneas dentro de un bloque marcado
`# BEGIN AMPERE CORE` / `# END AMPERE CORE` (nunca borra ni reordena lo que ya tenías,
y ese bloque es lo que `ampere detach` sabe quitar después); instala los hooks
Git nativos y corre su propio `--self-test`; y deja `.claude/ARNES-MANIFEST.json` +
`.claude/INSTALL-STATE.json` (estado de la instalación, nunca contenido del arnés —
no entra al manifiesto).

**Nunca sobrescribe una diferencia real sin dejar rastro.** Si un archivo del destino
ya existe con contenido distinto al de la fuente, el instalador NO lo toca: escribe la
versión nueva al lado, como `<archivo>.nuevo-YYYYMMDD-HHMMSS`, y termina con código de
salida `1` para que sepas que hay algo pendiente de revisar y fusionar a mano.
`CLAUDE.md` es la única excepción con lógica propia: si ya tiene la zona
`ARNES:PRESERVE`, se fusiona automáticamente (tu memoria de errores y tu progreso de
proyecto nunca se pierden); si no la tiene, sigue la misma regla del sidecar que
cualquier otro archivo.

```powershell
node .claude/scripts/doctor.js <ruta-proyecto>
node .claude/scripts/doctor.js <ruta-proyecto> --json   # para scripts/CI
```

Corrélo después de instalar (y cuando quieras, después) para confirmar que todo sigue
sano: manifiesto válido, hooks activos, `.gitattributes`/`.gitignore` completos, sin
sidecars `.nuevo-*` pendientes, sin documentos privados colados en el destino.

**Códigos de salida, iguales en el instalador y en `doctor`:**

| Código | Qué significa |
| ------ | -------------- |
| `0`    | Sano — nada pendiente. |
| `1`    | Necesita revisión — algo quedó como sidecar sin fusionar, o los hooks no quedaron completamente sanos (ej. `core.hooksPath` externo bloqueado a propósito). No es un error fatal, pero no lo ignores. |
| `2`    | Bloqueado/roto — el destino es peligroso (carpeta de usuario, raíz de disco, no es un repo Git) o falta algo fundamental (manifiesto, `CLAUDE.md`, hooks, o un documento privado que nunca debió estar ahí). |

`--force-managed` sobrescribe directamente (sin sidecar) los archivos gestionados bajo
`.claude/` que difieran del destino — nunca a `CLAUDE.md` (que siempre sigue su propia
regla) ni a los documentos de producto (`NOTICE.md`/`INSTALAR.md`/`README.md`/
`CHANGELOG.md`/`.gitattributes`, que siempre van a sidecar en una colisión real). Usalo
solo cuando sepas que querés descartar cambios locales en scripts del arnés — no es el
default por algo.

### Resolver sidecars `.nuevo-*` (`ampere resolve`)

Cuando `doctor` reporta `sin_sidecars_pendientes` en warn, `ampere resolve` los
resuelve de forma segura — **nunca reemplaza `README.md`/`CLAUDE.md` a ciegas**, cada
tipo de colisión tiene su propia regla:

```powershell
node .claude/scripts/resolve-sidecars.js <ruta-proyecto> --dry-run   # primero, para ver el plan
node .claude/scripts/resolve-sidecars.js <ruta-proyecto>             # resuelve de verdad
# o, con la CLI global:
ampere resolve --dry-run
ampere resolve
```

Todo el histórico de una corrida (backups + sidecars ya resueltos) queda agrupado bajo
un único directorio por corrida: `.claude/resolved-sidecars/<fecha-hora>/backups/` y
`.claude/resolved-sidecars/<fecha-hora>/sidecars/` — nunca junto al archivo original en
la raíz o en `.claude/`. Ese directorio está en `.gitignore` (puede contener contenido
privado del proyecto, como la versión previa de tu `CLAUDE.md` o `settings.json`) y
nunca queda listo para un commit accidental; `git status` después de resolver solo
muestra los archivos realmente modificados (`CLAUDE.md`, `.claude/settings.json`).

- **`README.md.nuevo-*`**: `README.md` del proyecto NUNCA se toca. El sidecar se
  archiva tal cual, como referencia, en `.claude/resolved-sidecars/<fecha-hora>/sidecars/`.
- **`CLAUDE.md.nuevo-*`**: se agrega (con backup previo en
  `.claude/resolved-sidecars/<fecha-hora>/backups/CLAUDE.md.backup`) una sección mínima
  "## Ampere Core" al final de tu `CLAUDE.md` (o `claude.md` si `CLAUDE.md` no existe)
  — nunca fusiona el sidecar completo, y nunca duplica la sección si ya está. El
  sidecar se archiva igual que el de README.
- **`.claude/settings.json.nuevo-*`**: fusiona el `settings.json` actual con el
  entrante (con backup previo en el mismo directorio de corrida) — preserva TODAS las
  claves y `permissions` existentes, incorpora los hooks de Ampere que falten sin
  duplicar (dedupe por contenido estructural, no por string), y nunca borra hooks de
  otras herramientas. Un BOM inicial en cualquiera de los dos JSON se ignora al
  parsear. Si el JSON actual o el del sidecar sigue siendo inválido, TODA la corrida se
  bloquea (exit 2) sin modificar nada — ni siquiera los sidecars de esa misma corrida
  que sí resolverían limpio.
- **Cualquier otro sidecar** que no encaje en las reglas anteriores no se toca, no se
  borra ni se archiva solo: queda reportado como pendiente de revisión manual (exit 1);
  a diferencia de un error estructural, esto no bloquea la resolución de los demás
  sidecars de la corrida.

Mismos códigos de salida 0/1/2 que `install`/`doctor`. Corré `ampere doctor` después —
si esos sidecars eran lo único pendiente, queda en `SANO`.

## Instalación manual (avanzado / respaldo)

Documentado acá por completitud y para cuando el instalador no puede correr — **usalo
solo si sabés lo que hacés**: a diferencia del instalador de arriba, esta vía no
detecta colisiones automáticamente, no instala los hooks Git, y no deja un
`.claude/ARNES-MANIFEST.json` calculado desde la fuente salvo que sigas el paso 1 de
abajo a mano. No hay CLI propio en esta vía — es copiar archivos, y **cómo** se copian
importa: la misma regla de oro (nunca destruir nada que ya exista) aplica tanto si lo
hacés vos a mano como si le pedís a un agente de IA que lo instale por vos.

## Paso 0 — Detectar el estado real de la carpeta destino, antes de copiar nada

| Estado de la carpeta                                                                               | Qué hacer                                                                                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Vacía** (o solo tiene `.git` sin historia real)                                                  | Instala el payload completo del arnés: `.claude/`, `CLAUDE.md`, `NOTICE.md`, `INSTALAR.md`, `README.md`, `CHANGELOG.md`, `COMMAND_INDEX.md`, `.gitattributes`, y `.gitignore` por merge append-only (ver debajo cómo). Sin riesgo de pisar nada, pero igual sin copiar de más.                                                                      |
| **Ya tiene código** (hay `package.json`, otros archivos, historia de git)                          | Instala el mismo payload de arriba — nunca toques nada que no sea eso — pero cada archivo que colisione con algo que el proyecto ya tenía se trata como el instalador asistido trata una colisión real: no se sobrescribe, se deja al lado como `<archivo>.nuevo-YYYYMMDD-HHMMSS` para revisión manual (`CLAUDE.md` es la excepción con zona `ARNES:PRESERVE`, ver INSTALAR.md sección "Paso 1"). |
| **Ya tiene este arnés instalado** (ya existe `.claude/commands/plan.md` con esta misma estructura) | No reinstales por encima. Corre `/update` en vez de copiar de nuevo a mano.                                    |

**Nunca hagas una copia cruda del filesystem de la carpeta fuente** (ej. `cp -r` de
toda la carpeta, o arrastrar el explorador de archivos completo) — hallazgo real, 6ta
auditoría: `.gitignore` protege qué se sube a un repo, pero no protege nada en una
copia directa del disco. Una copia cruda arrastra igual `ARNES-EXPLICADO.md`,
`GUIA-PRACTICA.md`, `COMANDOS-REFERENCIA.md`, `COMO-COMPARTIR.md` (los 4 documentos
privados que nunca deben distribuirse), y probablemente también `.git/` y logs locales
de la copia fuente. Instalá copiando **solo** los paths concretos de arriba
(`.claude/`, `CLAUDE.md`, `NOTICE.md`, `INSTALAR.md`, `README.md`, `CHANGELOG.md`,
`COMMAND_INDEX.md`, `.gitattributes`, `.gitignore`), o si la fuente es un repo Git, generá un archivo
limpio con solo lo trackeado:
`git -C <carpeta-fuente-del-arnés> archive HEAD | tar -x -C <raíz-del-proyecto>` (esto
también respeta lo que ese repo fuente ya excluye vía `.gitignore` en su propio
control de versiones, que es justamente donde viven excluidos los 4 documentos).

**Nunca instales en la carpeta HOME del usuario** (`$HOME`/`%USERPROFILE%`) ni en un
directorio elegido a ciegas — confirma siempre la ruta destino antes de escribir nada.

**En una instalación fresca** (fila "Vacía" o "Ya tiene código" de la tabla), al
terminar de copiar:

1. Crea `.claude/ARNES-MANIFEST.json` corriendo
   `node .claude/scripts/make-manifest.js <raíz-del-proyecto> --write-baseline-from <carpeta-fuente-del-arnés>`
   — nunca calcules los hashes uno por uno a mano, y nunca uses `--write-baseline` a
   secas aquí. La diferencia importa: `--write-baseline-from` calcula los hashes desde
   la carpeta FUENTE (la que acabás de copiar), no desde lo que quedó en el destino —
   así, si el Paso 2 dejó algún archivo ajeno preservado junto a un sidecar `.nuevo`
   sin fusionar, la baseline registra el hash real del arnés (el del sidecar), nunca el
   del archivo ajeno (hallazgo real de auditoría: usar `--write-baseline` a secas en
   una instalación con colisiones terminaba registrando un archivo de otra herramienta
   como si fuera del arnés). Es lo que `/update` va a necesitar más adelante para
   distinguir tus cambios de los del arnés. Sin este archivo desde el día uno,
   `/update` tiene que asumir el estado actual como línea base la primera vez que
   corra, perdiendo la certeza de qué cambiaste vos.
2. Crea o amplía el `.gitignore` del proyecto para que incluya las 8 entradas que el
   arnés necesita hoy — las mismas que el instalador asistido agrega automáticamente
   (`REQUIRED_GITIGNORE_ENTRIES` en `install-ampere-core.js`, que `doctor.js` también
   verifica): `.env`, `.env.local`, `.claude/logs/`, `.claude/audits/`,
   `.claude/ARNES-LAST-SHIP.txt`, `.claude/INSTALL-STATE.json`, `.claude/feedback/`,
   `.claude/ship/`, `.claude/resolved-sidecars/`, `.claude/detach/`, `/data/`,
   `/outputs/` y `/logs/` (si el proyecto ya tiene un
   `.gitignore`, agrégalas sin pisar lo que ya tenía — merge tipo append-only, nunca
   reemplazar el archivo). Las tres últimas van **ancladas a la raíz** a propósito:
   ignoran artefactos runtime como `C:\dev\proyecto01\outputs\`, pero no ocultan
   paquetes internos legítimos como `src\mi_app\outputs\`. Esto es importante
   por varias razones: evita que un archivo de credenciales termine subido a un
   repositorio, evita que el hook de escaneo de secretos bloquee commits por culpa de
   un `.env` que ni siquiera se está intentando commitear, evita que correr `/audit` o
   `/ship` deje el árbol "sucio" con archivos sin trackear (que a su vez rompería el
   propio chequeo de árbol limpio que esos comandos exigen — hallazgo real, 5ta y 6ta
   auditoría), y evita que `/reportar`/`/ship` (runtime local, B3) terminen
   commiteando contexto del proyecto del usuario por accidente.

3. **Instala los hooks Git nativos** corriendo
   `node .claude/scripts/install-git-hooks.js <raíz-del-proyecto>`. Esto instala
   `pre-commit`, `commit-msg`, `pre-merge-commit` y `pre-push` — defensa LOCAL
   fail-closed contra secretos que corre en el momento exacto de cada operación de
   Git, sin depender de que Claude Code esté siquiera involucrado en el comando
   (hallazgo real, 6ta auditoría: antes solo se instalaba dentro de `/build`, así que
   un proyecto donde alguien edita a mano y corre `/audit → /ship` directamente nunca
   lo tenía activo). **Importante: esto no es una garantía imposible de evitar** — un
   usuario con acceso a la máquina siempre puede `git commit --no-verify` o cambiar
   `core.hooksPath`. Es defensa contra errores genuinos, no contra alguien que
   deliberadamente quiere saltársela; si necesitás una garantía que no dependa de la
   máquina del desarrollador, hace falta CI o un hook del lado del servidor Git —
   este mecanismo no lo reemplaza.
   Verificá que quedó realmente activo con
   `node .claude/scripts/install-git-hooks.js <raíz-del-proyecto> --self-test` (solo
   lectura contra ESE repo real — confirma que los 4 hooks existen con el contenido
   exacto esperado, sin tocar su índice ni su historial). Para una prueba funcional
   real (que el mecanismo efectivamente bloquea un secreto, no solo que el archivo
   existe), usá `--implementation-test` en cambio: crea un repo descartable aparte,
   instala ahí los mismos hooks, e intenta commitear un secreto real.
4. Si estás en Windows y PowerShell muestra caracteres raros (`Ã³`, `â€”`, `Ã©`) al leer
   documentación, primero confirma que no sea solo la consola. Los archivos del arnés
   están en UTF-8; puedes mejorar la salida de esa sesión con:

   ```powershell
   $OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
   ```

   Esto no cambia el contenido de los archivos: solo cómo PowerShell imprime texto.

## Paso 1 — Si el proyecto ya tiene su propio `CLAUDE.md`

No se sobrescribe nunca a ciegas. Dos casos:

- **Ya tiene la marca `<!-- ARNES:PRESERVE:START -->`** de una instalación anterior de
  este arnés → todo lo que está entre esa marca y `<!-- ARNES:PRESERVE:END -->`
  (memoria de errores, progreso del proyecto) es del usuario y no se toca. Lo de
  arriba de la marca sí se puede refrescar con la versión nueva del arnés.
- **No tiene esa marca** (es un `CLAUDE.md` propio del usuario, de antes de este
  arnés) → se deja completamente intacto. No se agrega el flujo de trabajo del
  arnés adentro sin preguntar — se le muestra al usuario el contenido de nuestro
  `CLAUDE.md` y se le pregunta cómo prefiere fusionarlo (¿lo agrega él a mano?,
  ¿preferís que combinemos las dos versiones juntos ahora mismo?).

## Paso 2 — Si algún archivo choca

Si un archivo que el arnés instalaría ya existe con contenido distinto (por ejemplo,
ya hay un `.claude/settings.json` de otra herramienta), **no se sobrescribe**: se
escribe la versión del arnés al lado, como `<archivo>.nuevo` (ej.
`settings.json.nuevo`), y se avisa al usuario para que lo revise y fusione a mano.

**Advertencia explícita en este caso concreto:** mientras `settings.json.nuevo` no se
fusione a mano dentro del `settings.json` real, **los hooks del arnés no están
activos** — Claude Code solo lee `settings.json`, no `.nuevo`. Eso incluye el escaneo
de secretos antes de cada commit. No basta con avisar "revísalo cuando puedas": hay que
decir explícitamente que, hasta que se fusione, ese proyecto está construyendo **sin**
esa capa de seguridad.

## Paso 3 — Si quien instala es un agente de IA, no una persona escribiendo a mano

Si te piden instalar este arnés de forma autónoma sobre un proyecto que ya existe:

1. Corre primero el Paso 0 y reporta el estado detectado — no asumas.
2. Si la carpeta ya tiene código o su propio `CLAUDE.md`, **pide confirmación
   explícita antes de escribir un solo archivo** — no hay forma segura de adivinar
   la intención del usuario sin preguntar, y equivocarse aquí no es reversible.
3. Si no hay forma de confirmar en esa conversación (por ejemplo, se te pidió desde
   un script sin humano presente), **niégate y explica por qué**, en vez de decidir
   por tu cuenta.

## Paso 4 — Cómo quitar el arnés de un proyecto (sin CLI, a mano)

No hace falta un comando dedicado — es una operación simple y poco frecuente:

1. Antes de borrar `.claude/`, pregunta si el usuario quiere conservar
   `.claude/audits/` (el historial de auditorías de `/audit`) — si sí, muévelo fuera
   primero. Es el mismo cuidado que el paso 2 le da a la continuidad operativa de
   `CLAUDE.md`; no hay razón para tratarlo distinto.
2. Borra la carpeta `.claude/` completa (con `ARNES-MANIFEST.json` adentro, ya
   incluido).
3. En `CLAUDE.md`, decide qué hacer con la zona `ARNES:PRESERVE` (memoria de errores,
   progreso): si el usuario quiere conservar ese historial, muévelo a un archivo aparte
   antes de borrar el resto de `CLAUDE.md`; si no le importa, se borra todo junto.
4. Borra `INSTALAR.md`, `NOTICE.md`, `GUIA-PRACTICA.md` si existen — son del arnés, no
   del proyecto del usuario.
5. Lo que el arnés haya construido (`src/`, el código de la aplicación en sí) queda
   intacto — el arnés nunca es dueño de eso, solo lo ayudó a planificar.

**Siempre confirmar con el usuario antes de borrar nada** — mismo principio que el
resto de este documento: preguntar, nunca asumir.

Esta regla existe porque instalar sobre un proyecto real y sin preguntar es
exactamente el tipo de error irreversible que este mismo documento busca evitar — más
vale una pregunta de más que un `CLAUDE.md` o una config de alguien pisada sin aviso.
