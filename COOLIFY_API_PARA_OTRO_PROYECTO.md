# Acceso a la API de Coolify para otro proyecto

Actualizado: 2026-10-13

## Datos disponibles

- Instancia: Coolify usado para desplegar Dmente Synapse.
- Aplicación de Synapse en producción: `j20dljqtnxzcq5nrxhxdrrik`. Este identificador corresponde a Synapse; el otro proyecto debe usar el identificador de su propia aplicación.
- El token local mencionado en el estado de Synapse no tenía permiso `deploy` cuando se intentó desplegar por terminal. Hay que comprobar los permisos del token que se entregue al otro proyecto.

## Datos que debe completar el administrador de Coolify

```dotenv
COOLIFY_BASE_URL=https://<dominio-del-panel-coolify>
COOLIFY_API_TOKEN=<token-creado-para-el-otro-proyecto>
COOLIFY_APPLICATION_UUID=<uuid-de-la-aplicacion-del-otro-proyecto>
```

No se ha verificado en este repositorio la URL del panel de Coolify ni el UUID de la aplicación del otro proyecto. La URL pública `https://synapse.dmentedigital.co` corresponde a Synapse y no se debe asumir que es la URL de la API de Coolify.

## Entrega al otro proyecto

1. En Coolify, identificar la URL del panel y el UUID de la aplicación de destino.
2. Crear un token de API para el otro proyecto con los permisos necesarios para sus operaciones. Si necesita desplegar, comprobar específicamente el permiso `deploy`.
3. Guardar el token como secreto o variable de entorno en el proyecto de destino. No incluirlo en Git, documentos compartidos ni conversaciones.
4. Configurar las tres variables del bloque anterior en el proyecto de destino y verificar el acceso con una operación de lectura antes de automatizar cambios o despliegues.

## Estado de esta entrega

Este archivo es una guía de configuración. No contiene una credencial de API ni concede acceso por sí mismo.

## Despliegue de Synapse por API

El repositorio incluye `scripts/coolify-deploy.mjs`. Con `COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN` y `COOLIFY_APPLICATION_UUID` configuradas en el entorno, `node scripts/coolify-deploy.mjs` verifica por lectura que el UUID corresponde a Dmente Synapse. `node scripts/coolify-deploy.mjs --deploy` solicita el despliegue por API y muestra el identificador devuelto por Coolify. El script no está diseñado para desplegar otro proyecto.

Referencia oficial: [API de despliegue de Coolify](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid) y [consulta de aplicación por UUID](https://coolify.io/docs/api/endpoints/applications/get-application-by-uuid).
