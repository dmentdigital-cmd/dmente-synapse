# Verificación del kit

- 14 PNG generados con Imagegen integrado.
- 6 sprites de personajes: todos 1254 × 1254, RGBA y con píxeles completamente transparentes.
- 6 muebles/plantas: PNG RGBA con transparencia real.
- 2 vistas de oficina: fondo vacío y referencia de interfaz.
- Cada PNG original se copió sin modificar sus píxeles.
- Las referencias de imágenes en el prompt corresponden al inventario.
- El prompt original del usuario se conserva sin cambios.

| Archivo | Dimensiones | Transparencia real |
|---|---|---|
| administrativo-normal.png | 1254 × 1254 | Sí |
| administrativo-mano-levantada.png | 1254 × 1254 | Sí |
| legal-normal.png | 1254 × 1254 | Sí |
| legal-mano-levantada.png | 1254 × 1254 | Sí |
| pulpo-normal.png | 1254 × 1254 | Sí |
| pulpo-mano-levantada.png | 1254 × 1254 | Sí |
| escritorio.png | 1544 × 1018 | Sí |
| silla.png | 1254 × 1254 | Sí |
| planta-grande.png | 1254 × 1254 | Sí |
| planta-pequena.png | 1254 × 1254 | Sí |
| archivador.png | 1254 × 1254 | Sí |
| biblioteca.png | 1254 × 1254 | Sí |
| oficina-fondo.png | 1586 × 992 | No; imagen de oficina |
| oficina-referencia.png | 1586 × 992 | No; imagen de oficina |

Los hashes SHA-256 están en `assets.json`. Esta comprobación valida los archivos y el paquete; no implica que la aplicación descrita en el prompt ya esté implementada.

## Actualización 2026-09-24

- Abogado sustituido por una rata en las dos poses y en la referencia de oficina.
- Las dos poses nuevas mantienen 1254 × 1254, RGBA y transparencia real.
- La referencia de oficina mantiene 1586 × 992.
- Prompt y guía especifican mano levantada mientras existan solicitudes pendientes, incluyendo el avatar de Pulpo.
- Todas las referencias PNG del prompt existen en el kit; hashes del inventario recalculados.

## Corrección de marca y puestos — 2026-09-24

- Referencia visual revisada: cabecera «Dmente Synapse», dos agentes en el lado de trabajo, sillas detrás y monitores de espaldas a la cámara.
- Escritorio individual actualizado con la misma orientación y transparencia real.
- Prompt Markdown y TXT idénticos; instrucciones explícitas de marca, orientación y capas.
- Manifiesto actualizado con dimensiones y SHA-256 de los 14 PNG.
- ZIP reconstruido y comprobado sin errores de integridad.
