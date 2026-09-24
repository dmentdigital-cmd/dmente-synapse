# Ampere Core

**Beta privada — `0.9.0-beta.8`.** Compartido en confianza con un grupo reducido de
personas; leé [NOTICE.md](NOTICE.md) antes de usarlo.

Ampere Core es un arnés de trabajo para construir software con ayuda de un agente de
IA, con un flujo de 4 pasos pensado para que la IA nunca construya sin plano, nunca
repita un error dos veces, y nunca decida sola algo que le corresponde decidir al
humano.

## Instalar

```powershell
node .claude/scripts/install-ampere-core.js --target <ruta-proyecto> --dry-run   # primero, para ver el plan
node .claude/scripts/install-ampere-core.js --target <ruta-proyecto>             # instala de verdad
node .claude/scripts/doctor.js <ruta-proyecto>                                    # confirma que quedó sano
```

Nunca pisa un archivo existente sin avisar: si algo colisiona, escribe la versión
nueva al lado como `<archivo>.nuevo-YYYYMMDD-HHMMSS` y sale con código 1 ("necesita
revisión") en vez de sobrescribir. Rechaza instalar en tu carpeta de usuario, en la
raíz de un disco, o en algo que no sea la raíz de un repo Git (`git init` primero).
Esos sidecars `.nuevo-*` se resuelven con `ampere resolve` (ver más abajo) — nunca
reemplaza tus archivos a ciegas. Detalle completo — incluida la vía manual, que sigue
existiendo como respaldo avanzado — en [INSTALAR.md](INSTALAR.md).

Esta vía asume que ya tenés una copia de Ampere Core a mano (clonada o extraída de un
paquete). Si todavía no la tenés, o si vas a instalar/diagnosticar/actualizar más de
un proyecto, el comando global `ampere` (ver [Distribución Beta
privada](#distribución-beta-privada)) es más cómodo — invoca exactamente estos mismos
scripts por vos.

## Cómo funciona, en una línea por paso

| Paso     | Qué hace |
| -------- | -------- |
| `/plan`  | Entrevista al usuario y produce un Blueprint aprobado explícitamente antes de escribir código de la aplicación. |
| `/build` | Construye fase por fase a partir de ese Blueprint. |
| `/audit` | Audita el proyecto completo (seguridad, datos/acceso, rendimiento, calidad), puntaje 0-100 — hallazgos críticos bloquean la entrega. |
| `/ship`  | Tests + revisión + commit + entrega, con confirmación humana en cada decisión irreversible. |

Fuera del ciclo, para retomar: `/resume` lee el estado real del proyecto (Blueprint,
BUILD-STATE, auditorías, git, `doctor`), dice en qué punto quedó y recomienda el
siguiente paso. Es de solo lectura — no construye, no corrige, no modifica nada.

Instrucciones detalladas de cada paso: `.claude/commands/`. Índice completo de
comandos, de terminal y slash: [COMMAND_INDEX.md](COMMAND_INDEX.md). Reglas de oro:
[CLAUDE.md](CLAUDE.md).

## Quitar el arnés antes de publicar

```powershell
ampere detach <ruta-proyecto> --dry-run   # primero, para ver el plan
ampere detach <ruta-proyecto>             # lo quita de verdad
git -C <ruta-proyecto> status --short     # confirmá qué cambió
```

Lo contrario de `install`, pensado para el momento de entregar o publicar el repo.
Solo borra lo que puede **probar** que es del arnés: bloques marcados, archivos cuyo
hash coincide con el que registró la instalación, hooks Git idénticos al wrapper que
instaló. Nunca toca tu código. El histórico del proyecto (`.claude/audits/`,
`feedback/`, `ship/`, `logs/`, `resolved-sidecars/`) se conserva y se reporta, todo lo
que modifica en el lugar se respalda antes en `.claude/detach/<fecha>/backups/`, y
cualquier cosa ambigua se deja para revisión manual en vez de borrarla. Detalle
completo en [COMMAND_INDEX.md](COMMAND_INDEX.md).

## Verificación local

```powershell
node .claude/scripts/run-e2e.js
node .claude/scripts/test-ampere-cli.js
```

Corre 6 recorridos completos (instalación limpia, colisión real, destino bloqueado,
runtime de `/reportar`/`/ship` fuera del manifiesto, reinstalación idempotente) contra
repos Git temporales descartables, usando el instalador y el doctor reales — no una
simulación. `--keep-temp`/`--scenario <nombre>` disponibles; detalle en la cabecera
del script. `test-ampere-cli.js` (B6) corre la suite completa de escenarios
equivalentes contra la CLI global (`tools/ampere-cli/bin/ampere.js`) como
subproceso real, incluida la
autoactualización de la copia central (`ampere self-update`). CI (GitHub Actions)
corre `node --check` y `run-e2e.js` en `windows-latest` y `ubuntu-latest`; en Ubuntu
además corre la batería `.claude/hooks/test-*.sh`; `test-ampere-cli.js` corre en
ambos cuando `tools/ampere-cli` está presente.

## Si algo no funciona como esperabas

Usá `/reportar` — deja constancia del problema en un archivo sin que tengas que
explicarlo por tu cuenta. Ver [NOTICE.md](NOTICE.md) para el resto de lo que se
espera de este acceso.

## Distribución Beta privada

**Canal recomendado para colaboradores Beta:** cloná este repositorio privado y usá
la CLI global `ampere` (B6): se clona una sola vez en una carpeta central, y desde ahí
`npm link` habilita el comando `ampere` en cualquier terminal.

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/ampere2026/ampere_core.git
cd ampere_core
git checkout main
git pull --ff-only

cd tools\ampere-cli
npm install
npm link

ampere --version
ampere help
```

Desde cualquier proyecto:

```powershell
ampere install --dry-run
ampere install         # o: ampere install C:\dev\project01
ampere doctor          # o: ampere doctor C:\dev\project01
ampere resolve --dry-run  # muestra qué sidecars .nuevo-* puede resolver, sin tocar nada
ampere resolve         # los resuelve de verdad (backup antes de modificar, nunca a ciegas)
ampere update          # git pull --ff-only en la copia central + install + doctor
ampere update --no-pull  # reinstala desde la copia central actual, sin traer cambios
```

Sin `[target]` explícito, cada comando usa el directorio actual; con una ruta
(relativa o absoluta), opera sobre esa. Detalle completo en
[INSTALAR.md](INSTALAR.md).

`ampere resolve` resuelve los sidecars `.nuevo-*` que deja `ampere install`/`ampere
update` al colisionar con un proyecto existente — nunca reemplaza `README.md` ni
`CLAUDE.md` a ciegas: `README.md.nuevo-*` se archiva como referencia en
`.claude/resolved-sidecars/<fecha>/` sin tocar tu `README.md`; `CLAUDE.md.nuevo-*`
agrega (con backup previo) una sección mínima "## Ampere Core" al final de tu
`CLAUDE.md`/`claude.md`, sin fusionar el archivo completo ni duplicar la sección si ya
está; `.claude/settings.json.nuevo-*` fusiona hooks/permisos preservando todo lo tuyo
(con backup previo) y sin duplicar hooks. Cualquier otro sidecar que no encaje se
reporta como pendiente de revisión manual (exit 1), nunca se borra ni se archiva solo.
Tras `ampere resolve`, `ampere doctor` queda SANO si eso era lo único pendiente.

Para actualizar la copia central misma (no un proyecto destino), desde
`C:\dev\ampere_core`:

```powershell
ampere self-update              # git pull --ff-only origin main + npm install + npm link
ampere self-update --no-link    # igual, sin rehacer npm link
ampere self-update --dry-run    # muestra el plan sin ejecutar nada
```

`ampere install` además clasifica el destino antes de tocar nada — imprime si
detectó una carpeta vacía, un proyecto existente con código (garantizando que
`src/`, `package.json`, `pyproject.toml`, `requirements.txt` y demás configs propias
quedan intactas), o una instalación previa de Ampere Core.

### Snapshot verificable de respaldo (ZIP)

Para quien no tiene acceso GitHub, o quiere un artefacto verificable puntual sin
clonar historia Git, `make-release-package.js` genera un paquete limpio desde el
árbol actual:

```powershell
node .claude/scripts/make-release-package.js --out dist          # carpeta de release
node .claude/scripts/make-release-package.js --out dist --zip    # + ZIP para entregar
node .claude/scripts/make-release-package.js --out dist --verify # re-verifica un paquete ya generado, sin reconstruir
```

Antes de construir, verifica (sin bandera para saltear esto) que el repo fuente está
limpio, que `make-manifest.js` confirma proveniencia Git válida, y que
[`run-e2e.js`](#verificación-local) pasa contra la fuente. El paquete resultante nunca
incluye `.git/`, los 4 documentos privados internos, ni nada de runtime
(`.claude/logs/`, `.claude/audits/`, `.claude/feedback/`, `.claude/ship/`, el
manifiesto/estado de instalación) — y esa ausencia se verifica de nuevo después de
construir, corriendo `run-e2e.js`, `make-manifest.js` y, desde B6,
`tools/ampere-cli/bin/ampere.js --version` **desde dentro** del paquete generado (sin
`node_modules/` — la CLI no tiene dependencias). `dist/<paquete>.SHA256SUMS.txt` queda
al lado (nunca adentro) con el hash de cada archivo, para que quien reciba el paquete
pueda confirmar que no se corrompió ni se modificó en tránsito. Este snapshot es un
respaldo, no el flujo principal para quien ya tiene acceso al repositorio.

Ambos canales son Beta privada, no una release pública — para el mismo grupo
reducido de confianza que [NOTICE.md](NOTICE.md) describe (los tags `v0.9.0-beta.1`,
`v0.9.0-beta.4` y `v0.9.0-beta.7` existen y apuntan a las Betas anteriores — `main` y
los paquetes generados a partir de acá ya son `0.9.0-beta.8`; no se publicó ninguna
como GitHub Release). Ninguno de los dos canales distribuye los 4 documentos privados
internos.

### Windows / PowerShell

Si PowerShell muestra acentos como `Ã³` o guiones largos como `â€”`, no asumas que los
archivos están dañados: normalmente es la consola interpretando UTF-8 con otra página
de códigos. Antes de revisar documentación larga en terminal, puedes ejecutar:

```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
```

Los archivos del arnés se guardan como UTF-8; esta línea solo mejora cómo se ven en la
consola.

## Versión

`0.9.0-beta.8` — ver [CHANGELOG.md](CHANGELOG.md) para el historial de cambios.
