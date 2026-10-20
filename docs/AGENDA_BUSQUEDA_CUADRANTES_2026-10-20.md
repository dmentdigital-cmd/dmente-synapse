# Agenda: búsqueda y movimiento entre cuadrantes

Fecha: 20 de octubre de 2026.

## Problema comprobado

La matriz mostraba los cuatro cuadrantes, pero aplicaba el filtro de cuadrante antes de calcular las columnas. Al entrar desde Mi Dia con Q1 seleccionado, Q2 aparecía con cero aunque tuviera registros. Al guardar Q2, la tarjeta quedaba fuera del filtro Q1.

La consulta de solo lectura en producción encontró los compromisos de Ricardo Abella (cuestionario Trillonaria) y Alfonso Cuadro (coordinar visita al consultorio) presentes en Q2. No se modificaron esos datos para reparar la interfaz.

## Cambios

- Buscador con botón Buscar y vista Todos / Buscar sobre todas las fechas y estados. Busca título, participantes, proyecto, contexto, dominio y responsable; admite palabras sin tildes y combinaciones de palabras.
- Al cambiar un cuadrante y guardar, se confirma la respuesta del servidor, se abre la matriz completa, se limpian filtros que podrían ocultar la tarjeta y se resalta el destino una sola vez.
- Un filtro de cuadrante muestra solo la columna elegida y un aviso con botón para ver todos; las otras columnas no muestran ceros engañosos.
- La URL de la matriz completa se conserva al guardar y al recargar.
- Las lecturas periódicas iniciadas antes o durante una mutación se descartan. Tampoco se aplican errores de lecturas antiguas sobre un guardado posterior.

## Verificación

Build y comprobación TypeScript del servidor completados. Pruebas de búsqueda y concurrencia, integración de cambios Q1/Q3/Q4/Q2 para compromisos y persistencia de Q2 en solicitud urgente tras reinicio real del servidor. Se actualizó el arranque del servidor de pruebas de Agenda para usar Node con --import tsx en un único proceso, evitando dejar abierto SQLite en Windows.

Se corrigieron expectativas desactualizadas de dos pruebas de arranque para las versiones de caché y service worker que ya estaban en el código.

Navegador local con 54 registros ficticios: movimiento Q1 a Q2 desde filtro Q1, búsqueda por Ricardo y Alfonso, búsqueda sin tildes de un participante de un registro histórico cerrado, estado vacío, matriz conservada al recargar y foco del buscador conservado con refrescos periódicos. Capturas en outputs/agenda-review. Vista móvil de 390 px comprobada sin desbordamiento horizontal del buscador. Revisión independiente: ship, hallazgo de foco repetido corregido.

## Límites

La comprobación visual se hizo localmente con datos ficticios. La consulta de los dos compromisos reales se hizo por MCP de producción en modo de lectura. No se crearon cuentas de operador para la comprobación visual.
