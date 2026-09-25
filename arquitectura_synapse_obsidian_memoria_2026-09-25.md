# Arquitectura Synapse + Obsidian + Memoria Hermes

**Fecha:** 2026-09-25  
**Objetivo:** definir cómo Lucía/LuciaBot consulta conocimiento sin depender de buscar en el chat y sin llenar la memoria compacta de Hermes.

## 1. Principio principal

La memoria de Lucía/Hermes no debe ser el almacén completo de conocimiento.

Debe funcionar como un índice compacto que apunta a fuentes más grandes:

- Synapse: solicitudes, estados, agentes, prioridades y próximas acciones.
- Obsidian: conocimiento, documentación, reuniones, aprendizajes, decisiones y notas largas.
- Archivos `.md` por proyecto: estado canónico de clientes/productos.
- Drive: archivo externo pesado y backups.
- Memoria Hermes: preferencias, reglas estables, contactos críticos y punteros.

## 2. Estado actual verificado

Vault local encontrado:

```text
/home/diego/Obsidian
```

Estado Git del vault local:

```text
No es repo Git en esta VPS/ruta actual.
```

Tamaño aproximado:

```text
804K
```

Ejemplos de carpetas detectadas:

- `/home/diego/Obsidian/Proyectos/`
- `/home/diego/Obsidian/Reuniones/Granola/`

## 3. Cómo consulta Lucía/Hermes Obsidian

Cuando Diego pregunte algo de conocimiento, Lucía debe:

1. Identificar tema/proyecto/persona.
2. Buscar en el vault con búsqueda de archivos o contenido.
3. Leer solo las notas relevantes, no todo el vault.
4. Responder breve con fuente/ruta.
5. Si descubre conocimiento nuevo, guardarlo en la nota correspondiente.

Herramientas preferidas:

- `search_files` para buscar notas o contenido.
- `read_file` para leer fragmentos exactos.
- `write_file` o `patch` para crear/actualizar notas.

## 4. Cómo se conecta Synapse con Obsidian

Synapse no debe guardar todo el conocimiento largo dentro de solicitudes.

Cada solicitud de Synapse debe poder guardar referencias como:

```text
obsidianNote: /home/diego/Obsidian/Proyectos/.../nota.md
projectState: /home/diego/proyectos/.../estado.md
sourceDriveFolder: URL o ID de Drive
```

Ejemplo:

```text
Solicitud: organizar agentes de Synapse
Agente: producto-synapse
Nota Obsidian: /home/diego/Obsidian/Proyectos/Dmente Synapse/Arquitectura agentes.md
Estado canónico: /home/diego/proyectos/dmente_synapse/estado_dmente_synapse.md
```

## 5. Memoria Hermes compacta

La memoria persistente compacta de Hermes es pequeña. No se debe usar para guardar documentos completos.

Debe contener solo:

- reglas estables de Diego;
- datos críticos que evitan preguntar de nuevo;
- contactos clave;
- rutas importantes;
- convenciones operativas;
- punteros a archivos grandes.

No debe contener:

- estados largos de proyectos;
- logs;
- reportes completos;
- historiales extensos;
- datos que cambian cada semana.

## 6. Synapse para Tania / Rackell / PMA

Para la esposa de Diego y programas como PMA, la recomendación es no mezclar todo dentro del Synapse principal de Diego.

Opciones:

### Opción A — módulo separado dentro de Synapse

Crear dominio/agentes dedicados:

- `rackell-coordinadora`
- `pma-operaciones`
- `comedores`
- `compras-logistica`
- `sharepoint-documentos`
- `reportes-pma`

Ventaja: se administra desde la misma plataforma.

Riesgo: mezcla datos personales/agencia/PMA si no hay permisos finos.

### Opción B — Synapse separado para Tania/Rackell

Crear una instancia o perfil separado:

- datos separados;
- memoria separada;
- agentes separados;
- permisos separados;
- backup separado.

Recomendación inicial: **B**, si va a manejar datos operativos reales de PMA o documentos sensibles.

## 7. Flujo operativo recomendado

Cuando Diego hable:

1. LuciaBot clasifica:
   - tarea operativa → Synapse;
   - conocimiento/documentación → Obsidian;
   - estado de proyecto → archivo `.md` canónico;
   - archivo pesado/histórico → Drive;
   - preferencia estable → memoria Hermes compacta.
2. Si falta nota, crearla.
3. Si existe nota, actualizarla.
4. Synapse guarda solo el estado y el enlace a la fuente.
5. Lucía responde con resumen breve y ruta.

## 8. Próximos pasos sugeridos

1. Crear estructura Obsidian para Dmente Synapse.
2. Crear índice de proyectos/agentes en Obsidian.
3. Agregar campos `obsidianNote` y `sourcePath` a solicitudes de Synapse.
4. Definir si Rackell/Tania/PMA será módulo de Synapse o instancia separada.
5. Sincronizar el vault local con GitHub solo después de revisar secretos/datos sensibles.
