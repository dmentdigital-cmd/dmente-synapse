# Despliegue de Dmente Synapse en una VPS de Hostinget

## Opción recomendada: Coolify

Como la VPS ya tiene Coolify, se puede desplegar este repositorio como una aplicación **Dockerfile**. Coolify puede construir el Dockerfile del repositorio, exponer el puerto interno y asignar el dominio. El proceso debe escuchar en `0.0.0.0`, que ya está configurado en la imagen para Coolify. [Documentación de Dockerfile en Coolify](https://coolify.io/docs/applications/builds/dockerfile)

### Configuración en Coolify

1. Crear una nueva aplicación desde el repositorio Git.
2. Seleccionar el build pack **Dockerfile**.
3. Usar el `Dockerfile` de la raíz del repositorio.
4. Configurar el puerto expuesto como `3010`.
5. Añadir el dominio público de Synapse.
6. Crear estas variables de entorno en Coolify:

```text
SYNAPSE_OWNER_USERNAME=diego
SYNAPSE_OWNER_PASSWORD=<TU_CONTRASENA_REAL>
SYNAPSE_SESSION_SECRET=<TU_CLAVE_ALEATORIA_LARGA>
SYNAPSE_DATA_DIR=/app/data
```

No escribir secretos en el Dockerfile ni en el repositorio. Coolify inyecta las variables de entorno en el contenedor y requiere redeploy o restart para aplicar cambios. [Variables de entorno en Coolify](https://coolify.io/docs/applications/configuration/environment-variables)

### Persistencia de SQLite

En `Configuration > Persistent Storage`, añadir un **Volume Mount** con:

```text
Destination Path: /app/data
```

La aplicación escribe `synapse.sqlite` dentro de `/app/data`. Sin ese volumen, los datos podrían desaparecer al reemplazar el contenedor. Coolify documenta que solo los datos escritos bajo la ruta de destino montada son persistentes y que el almacenamiento persistente no reemplaza los respaldos. [Persistent Storage de Coolify](https://coolify.io/docs/applications/configuration/persistent-storage)

### Health check

Configurar, si la versión de Coolify lo permite:

```text
Path: /api/health
Port: 3010
```

Después de desplegar, verificar el dominio público y revisar los logs del contenedor.

## Arquitectura

- Nginx sirve `dist/` por HTTP/HTTPS.
- Nginx reenvía `/api/` al backend Node.js en `127.0.0.1:3010`.
- PM2 mantiene activo el proceso Node.js.
- SQLite se conserva en el directorio `data/` de la VPS.
- Las credenciales se configuran en el entorno de la VPS, nunca en Git.

La VPS mostrada por el usuario está identificada como Ubuntu 24.04 LTS. El proyecto local todavía no tiene un remote Git configurado, por lo que Coolify aún no puede clonarlo directamente.

## Datos que faltan para hacer el despliegue real

1. IP o hostname de la VPS.
2. Sistema operativo y versión.
3. Usuario SSH con permisos `sudo`.
4. Dominio que apuntará a la VPS.
5. Confirmación de si el dominio ya tiene certificado SSL.

No envíes contraseñas ni claves privadas por el chat.

## Preparación inicial en la VPS

```bash
sudo apt update
sudo apt install -y git nginx
```

Instalar Node.js 24 y PM2 según el método aprobado para la VPS:

```bash
node --version
npm --version
npm install --global pm2
```

La aplicación utiliza `node:sqlite`, por lo que la versión de Node debe ser compatible con Node 24.

## Copiar y compilar la aplicación

```bash
sudo mkdir -p /var/www/dmente-synapse
sudo chown -R "$USER":"$USER" /var/www/dmente-synapse
cd /var/www/dmente-synapse
git clone <URL_DEL_REPOSITORIO> .
npm ci
npm run build
mkdir -p data
```

## Configurar secretos

Crear un archivo fuera del repositorio:

```bash
sudo nano /etc/dmente-synapse.env
```

Contenido:

```text
SYNAPSE_OWNER_USERNAME=diego
SYNAPSE_OWNER_PASSWORD=<TU_CONTRASENA_REAL>
SYNAPSE_SESSION_SECRET=<TU_CLAVE_ALEATORIA_LARGA>
SYNAPSE_DATA_DIR=/var/www/dmente-synapse/data
```

Protegerlo:

```bash
sudo chmod 600 /etc/dmente-synapse.env
```

Antes de iniciar PM2, cargar el archivo en la sesión o incorporarlo al mecanismo de secretos de la VPS.

## Iniciar con PM2

```bash
cd /var/www/dmente-synapse
set -a
source /etc/dmente-synapse.env
set +a
export SYNAPSE_APP_DIR=/var/www/dmente-synapse
export SYNAPSE_DATA_DIR=/var/www/dmente-synapse/data
pm2 start deploy/hostinget/ecosystem.config.cjs
pm2 save
pm2 startup
```

El comando `pm2 startup` mostrará un comando adicional. Debe ejecutarse con `sudo` y luego repetir `pm2 save`.

## Configurar Nginx

```bash
sudo cp deploy/hostinget/nginx.conf.example /etc/nginx/sites-available/dmente-synapse
sudo nano /etc/nginx/sites-available/dmente-synapse
sudo ln -s /etc/nginx/sites-available/dmente-synapse /etc/nginx/sites-enabled/dmente-synapse
sudo nginx -t
sudo systemctl reload nginx
```

Cambiar `synapse.example.com` por el dominio real.

## Validación

```bash
curl http://127.0.0.1:3010/api/health
curl http://TU_DOMINIO/api/health
pm2 status
```

Después de validar HTTP, configurar HTTPS con el método aprobado para la VPS y forzar redirección de HTTP a HTTPS.

## Operación y respaldos

Respaldar regularmente:

```bash
cp /var/www/dmente-synapse/data/synapse.sqlite /ruta/segura/synapse-$(date +%F).sqlite
```

No se debe publicar la API en `0.0.0.0` mientras Nginx actúe como proxy local. El ejemplo mantiene `SYNAPSE_HOST=127.0.0.1`.
