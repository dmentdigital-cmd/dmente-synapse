# Integración Synapse, Obsidian y memoria Hermes

## Responsabilidad de cada sistema

- Synapse guarda solicitudes, agente, prioridad, estado, próxima acción y referencias.
- Obsidian guarda conocimiento, decisiones, reuniones y notas extensas.
- Los archivos Markdown de proyecto conservan el estado canónico.
- Drive conserva archivos pesados y respaldos.
- La memoria compacta de Hermes conserva reglas estables y punteros, no documentos completos.

## Referencias disponibles en una solicitud

- `obsidianNote`: nota relevante dentro de `/home/diego/Obsidian`.
- `sourcePath`: archivo Markdown canónico del proyecto.
- `sourceDriveFolder`: URL o identificador de la carpeta externa.

## Flujo de LuciaBot

1. Clasificar la solicitud y asignar especialista.
2. Para conocimiento, buscar selectivamente en `/home/diego/Obsidian`.
3. Leer solo las notas necesarias y citar la ruta utilizada.
4. Para estado operativo, consultar el archivo canónico referenciado.
5. Guardar en Synapse únicamente estado y punteros.
6. Solicitar aprobación antes de acciones externas.

## MCP

`synapse_create_request` acepta las tres referencias documentales.

`synapse_update_request_sources` actualiza las referencias de una solicitud existente usando su `requestId`.

## Separación de PMA

No se mezcla PMA con la instancia principal hasta definir perfiles, permisos, datos sensibles y respaldo. La arquitectura recomienda una instancia separada cuando se incorporen datos operativos reales.
