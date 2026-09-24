# Dmente Synapse — kit para la clase

Este paquete contiene el prompt de construcción actualizado y los activos gráficos originales para la primera versión de Dmente Synapse. Las imágenes se crearon con Imagegen integrado.

## Para comenzar

1. Descarga y descomprime `Pulpo-Starter-kit.zip`, o descarga todos los archivos de esta carpeta de Drive.
2. Coloca los archivos en una carpeta nueva de proyecto y ábrela en Codex.
3. Copia el contenido completo de `PROMPT-PULPO-STARTER.md` o de su copia `.txt` en una nueva tarea de Codex. Ambos contienen el mismo prompt, incluido el anexo AGENTS.
4. Pide que use las imágenes incluidas. El prompt ya indica sus nombres y cómo se relacionan con los estados de los agentes.

## Personajes

| Personaje | Pose normal | Solicita atención |
|---|---|---|
| Secretaria administrativa | `administrativo-normal.png` | `administrativo-mano-levantada.png` |
| Abogado rata | `legal-normal.png` | `legal-mano-levantada.png` |
| Pulpo | `pulpo-normal.png` | `pulpo-mano-levantada.png` |

Los seis archivos son PNG RGBA de **1254 × 1254 píxeles**, con fondo transparente real. Cada par conserva la colocación y escala del personaje. La secretaria tiene moño, gafas y chaqueta ciruela; el abogado es una rata antropomórfica con traje azul y sonrisa insistente; Pulpo es naranja, con gafas y corbata.

La mano permanece levantada mientras el agente tenga alguna solicitud pendiente para el usuario, sea una pregunta, información necesaria o una aprobación. Abrir el chat o refrescar no la baja. Solo vuelve a la pose normal cuando todas sus solicitudes estén resueltas o descartadas. Pulpo usa el tentáculo levantado en su avatar de la barra superior; no aparece en el piso de la oficina.

Este kit contiene dos estados por personaje, no un ciclo de pasos. Para el starter se puede desplazar el sprite normal por la escena; una animación de caminar con cuadros adicionales sería otra entrega.

## Muebles y plantas

- `escritorio.png`: escritorio visto desde el lado del visitante, con la parte trasera del monitor visible, listo para duplicarlo en ambos puestos.
- `silla.png`: silla de oficina verde salvia.
- `planta-grande.png`: monstera en maceta de terracota.
- `planta-pequena.png`: suculenta en maceta crema.
- `archivador.png`: archivador metálico verde de tres cajones.
- `biblioteca.png`: biblioteca de madera con carpetas y libros.

Todos tienen transparencia real. El escritorio usa un lienzo horizontal de 1544 × 1019; los otros muebles usan 1254 × 1254. No los fuerces a tener el mismo ancho visible: las dimensiones reales de cada objeto en la escena son distintas.

## Oficina

- `oficina-referencia.png`: propuesta visual de la aplicación, con dos puestos, personajes, navegación y ventana de chat. Es una referencia de composición, no una interfaz funcional.
- `oficina-fondo.png`: habitación vacía para colocar los muebles y personajes por separado.

Ambas imágenes miden 1586 × 992. La nueva dirección visual usa suelo de madera clara, paredes crema y verde salvia, tres ventanas y plantas. En la implementación, el chat, los nombres y los controles se construyen con HTML/CSS; no se recortan de la imagen de referencia.

La marca visible es **Dmente Synapse**. Los agentes y sus sillas quedan detrás de los escritorios, hacia las ventanas; cada pantalla mira a su agente. La secretaria levanta la mano desde su puesto. El mueble oculta la parte inferior del personaje, dejando visibles la cara y la mano.

## Integración

- Consulta `assets.json`: inventario, dimensiones, tipos de activo, rutas de estados y hashes SHA-256.
- Conserva las proporciones de cada PNG. Usa `image-rendering: pixelated` para mantener el carácter pixel art.
- Usa el mismo contenedor y punto de anclaje para las dos poses de un personaje. No recortes cada pose de forma independiente.
- El fondo de oficina va en la capa inferior; muebles y personajes deben ser elementos independientes. La interfaz y el avatar de Pulpo van encima.
- Los PNG entregados son los originales del generador, copiados sin modificar sus píxeles. Algunos visores muestran la transparencia sobre negro; ese negro no es un fondo añadido al archivo.

## Cambios del prompt conservados

La fuente es `prompt-original-usuario.txt`, guardada sin cambios. La versión de trabajo conserva:

- La conexión **Google Super en Composio**.
- La generación de activos originales mediante un modelo de imágenes.
- El alcance ampliado del agente Legal.
- La revisión periódica como **cron job**.
- El cursor persistente y la revisión tanto de **recibidos como de enviados**.
- Pulpo en **GPT-6 Luna, Medium** por defecto.

Las adaptaciones posteriores conectan el prompt con los activos ya generados, sustituyen al abogado por una rata y explicitan la mano levantada mientras existan solicitudes pendientes. El apartado «Activos gráficos incluidos» documenta los archivos y sus usos.

`AGENTS-plantilla.md` contiene por separado el mismo anexo de instrucciones incluido en el prompt. `prompts-imagenes.json` registra los prompts y las referencias usadas para las imágenes. `VERIFICACION.md` registra las comprobaciones del paquete.
