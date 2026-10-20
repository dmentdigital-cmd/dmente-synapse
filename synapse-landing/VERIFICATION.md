# Verificación de la landing

Comprobaciones ejecutadas el 20 de octubre de 2026:

- `node --check` en `app.js`, `scripts/build.mjs` y `scripts/serve.mjs`: completados sin errores.
- `npm run build`: completado. Entrega pública en `dist/`, 11 archivos, 120854 bytes en la generación comprobada.
- Servidor de vista previa `http://127.0.0.1:4179/`: respuesta HTTP 200 y contenido de Synapse confirmado.
- Revisión de enlaces locales de todos los HTML de `dist`: 27 referencias comprobadas, sin recursos ni anclas faltantes y sin identificadores duplicados.
- Navegador de escritorio a 1440 × 1000: captura completa y de portada. Ancho de scroll del documento igual al viewport, 1440 px. Fuente Manrope cargada.
- Navegador móvil a 390 × 844: captura completa y portada. Ancho de scroll del documento igual al viewport, 390 px. Menú móvil visible.
- Demo: se abrió Agenda y se verificó su contenido; se abrió Solicitudes, se simuló la aprobación y se verificó la incorporación del registro ficticio.
- Tras la inspección se ocultó el control Menú en escritorio, se añadieron espacios junto a saltos de línea de titulares que se ocultan en tablet/móvil y se marcaron iconos decorativos con aria-hidden.
- Se recargó y volvió a capturar la página en el tamaño normal del navegador integrado: la landing quedó visible y marcada como entrega. La captura actual es `.impeccable/review/preview-current.jpg`.
- Revisión independiente de HTML, CSS, JavaScript y las capturas: disposición `ship` para mostrar la versión local. No acredita contraste medido ni pruebas de teclado.

El detector mecánico devolvió una lista vacía, pero informó ejecución degradada por ausencia de parsers HTML/CSS; ese resultado no acredita contraste calculado ni accesibilidad completa.

Una ronda adicional del navegador quedó bloqueada antes de devolver evidencia. Por ello no se dan por verificadas las interacciones de teclado, el cierre del menú con Escape, la reapertura del FAQ mediante ancla ni la presentación a 768 px, aunque están implementadas. No se ha ejecutado auditoría externa de accesibilidad o rendimiento.

La revisión visual inicial mantiene las capturas anteriores para trazabilidad; `desktop.jpg` incluye el control de menú que se corrigió después. Las imágenes con `loading=lazy` pueden aparecer como pendientes antes de desplazarse hasta ellas; el logo superior se cargó correctamente.

No se publicó en Coolify. Dominio final y condiciones comerciales siguen sin definir. Los documentos legales existentes se conservan como documentos de pruebas con su alcance señalado.

Paquete público generado: `outputs/synapse-landing-2026-10-20-dist.zip` en la raíz del proyecto padre. Solo contiene los archivos de `dist/`.
