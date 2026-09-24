# Índice de comandos — Ampere Core

Todo lo que Ampere Core te deja invocar, en un solo lugar: qué hace cada cosa, cuándo
usarla, y qué **no** viene en esta edición. Es un índice de referencia, no un tutorial
— si estás empezando, corré `/onboarding` y volvé acá cuando necesites buscar algo
puntual.

Hay dos familias de comandos, y no son intercambiables:

- **Comandos de terminal (`ampere ...`)** — gestionan el arnés en sí: instalarlo,
  diagnosticarlo, actualizarlo, quitarlo. Los corrés vos en una consola.
- **Comandos slash (`/...`)** — son el flujo de trabajo: planificar, construir,
  auditar, entregar. Los escribís dentro de la conversación con el agente.

---

## Comandos de terminal (`ampere`)

Requieren tener el comando global instalado (ver [INSTALAR.md](INSTALAR.md)). Sin
`[target]`, todos operan sobre el directorio actual.

Códigos de salida, iguales en todos: **0** sano · **1** necesita revisión humana ·
**2** bloqueado, no se tocó nada.

| Comando | Qué hace |
| ------- | -------- |
| `ampere install [target] [--dry-run] [--force-managed]` | Instala Ampere Core en un proyecto. Nunca pisa un archivo tuyo: si algo colisiona, deja la versión nueva al lado como `<archivo>.nuevo-YYYYMMDD-HHMMSS` y sale con código 1. `--dry-run` muestra el plan sin escribir nada. |
| `ampere doctor [target]` | Diagnostica una instalación: qué falta, qué quedó a medias, qué necesita revisión. Solo lectura. |
| `ampere resolve [target] [--dry-run]` | Resuelve los sidecars `.nuevo-*` que dejó una instalación con colisiones (README.md, CLAUDE.md, `.claude/settings.json`). Archiva, fusiona con backup previo, o reporta revisión manual — nunca reemplaza tus archivos a ciegas. |
| `ampere detach [target] [--dry-run]` | Quita Ampere Core del proyecto. Lo contrario de `install`. Ver abajo. |
| `ampere update [target] [--no-pull]` | Trae la última versión a la copia central y reinstala + diagnostica el proyecto. |
| `ampere self-update [--no-link] [--dry-run]` | Actualiza la **copia central** del arnés (no un proyecto): `git pull`, `npm install`, `npm link`. |
| `ampere help` | La lista de comandos con sus flags. |
| `ampere --version` | Versión instalada de Ampere Core. |

### `ampere detach` — quitar el arnés antes de publicar

Pensado para el momento de entregar o publicar el repositorio: sacar Ampere Core sin
tocar una sola línea de tu código.

La regla es una sola: **solo borra lo que puede probar que es del arnés.** Si no tiene
certeza, no toca nada y lo reporta para revisión manual. Nunca toca `src/`, `app/`,
`package.json`, `.env`, ni ningún archivo o configuración tuya.

- **Quita** los archivos gestionados bajo `.claude/`, los hooks Git que coincidan byte
  a byte con los que instaló, y los documentos que instaló y siguen sin editar.
- **Modifica quirúrgicamente** `CLAUDE.md`, `.claude/settings.json`, `.gitignore` y
  `.gitattributes`: quita solo el bloque marcado de Ampere o los hooks idénticos a los
  suyos, y respalda el archivo antes en `.claude/detach/<fecha>/backups/`.
- **Conserva siempre** el histórico del proyecto: `.claude/audits/`, `feedback/`,
  `ship/`, `logs/`, `resolved-sidecars/`. Son tus datos, no del arnés — los reporta y
  los deja donde están.
- **Deja para revisión manual** todo lo ambiguo: un `CLAUDE.md` con tu memoria de
  errores editada a mano, un hook Git modificado, un `.gitignore` de una instalación
  vieja sin marcadores.

Corré siempre `ampere detach --dry-run` primero, y `git status --short` después.

---

## Comandos slash (dentro de la conversación)

| Comando | Qué hace |
| ------- | -------- |
| `/onboarding` | Ruta personalizada para empezar según tu proyecto y tu experiencia. |
| `/check` | Diagnóstico del entorno: confirma que las herramientas del stack están instaladas. Solo lectura. |
| `/plan` | Entrevista y produce `BLUEPRINT-[proyecto].md` + `STACK-PROFILE-[proyecto].md`. Nada de código de la aplicación hasta que lo apruebes explícitamente. |
| `/validate` | Validación estratégica opcional entre `/plan` y `/build`. |
| `/build` | Construye fase por fase a partir del Blueprint aprobado, con aprobación humana de las subtareas de cada fase. |
| `/audit` | Audita seguridad, datos/acceso, rendimiento y calidad. Puntaje 0-100 — un hallazgo crítico bloquea la entrega. |
| `/ship` | Tests + revisión + commit + entrega, con confirmación humana en cada decisión irreversible. |
| `/resume` | Reconstruye el contexto de un proyecto que venía a medias y recomienda el siguiente paso. Solo lectura: no construye, no corrige, no modifica nada. |
| `/update` | Actualiza el arnés en un proyecto que ya lo tiene instalado. |
| `/reportar` | Deja constancia de un problema con el arnés, para que no se pierda. |

---

## Flujo recomendado

| Situación | Qué correr |
| --------- | ---------- |
| **Iniciar un proyecto** | `ampere install` → `ampere doctor` → `/onboarding` → `/check` → `/plan` |
| **Construir** | `/validate` (opcional) → `/build`, fase por fase → `/audit` → `/ship` |
| **Retomar después de días** | `/resume` — y recién después el comando que recomiende |
| **Resolver conflictos de instalación** | `ampere resolve --dry-run` → `ampere resolve` |
| **Actualizar el arnés** | `ampere self-update` (copia central) → `ampere update <proyecto>` |
| **Desconectar antes de publicar** | `ampere detach --dry-run` → `ampere detach` → `git status --short` |

La regla de oro que atraviesa todo el flujo: **el humano aprueba, la IA no.** Cada fase
de construcción, cada entrega y cada decisión irreversible necesitan un "sí" explícito
en la conversación.

---

## Qué NO incluye esta edición

Ampere Core Basic cubre el ciclo completo de planificar → construir → auditar →
entregar, y ahora también retomar y desconectar. Lo que **no** trae:

- **Feature packs** — módulos listos para pegar (pagos, autenticación, suscripciones).
- **Pagos y auth** — no hay integración preconstruida de ninguna pasarela ni proveedor
  de identidad.
- **Pricing y estrategia comercial** — nada sobre precios, posicionamiento o lanzamiento.
- **UX review avanzado** — `/audit` cubre calidad general, no una revisión de
  experiencia de usuario dedicada.
- **Web audit avanzado** — sin auditoría de performance web, SEO o accesibilidad
  especializada.
- **Módulos Plus** — todo lo anterior vive en la edición Plus.

Nada de esto te impide construirlo vos mismo con `/plan` y `/build`: lo que falta son
los atajos preconstruidos, no la capacidad.

**Nota de distribución:** Basic es potente, pero no es la edición Plus. Si algo de la
lista de arriba es central para lo que estás haciendo, esta edición te va a dejar
construirlo a mano, no resolverlo de fábrica.
