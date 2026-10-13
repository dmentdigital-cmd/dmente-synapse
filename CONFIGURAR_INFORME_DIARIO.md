# Informe diario de excepciones de Synapse

Actualizado: 2026-10-13

## Función

Synapse calcula las excepciones de los proyectos activos: bloqueos, tareas bloqueadas y próximas acciones sin definir. Diego puede registrar el avance diario desde la ficha de cada proyecto en curso. El servidor guarda un corte del informe a partir de las 9:15 a. m. de Bogotá y lo muestra en Proyectos al administrador.

El correo se envía a `diego@dmentedigital.co` cuando las variables SMTP están completas. El informe incluye proyectos de agencia, proyectos, tecnología, ventas, marketing y producto. No incluye por defecto dominios de familia, salud, educación o vida personal.

## Secretos y variables en Coolify

```dotenv
SYNAPSE_SMTP_HOST=<servidor-smtp-corporativo>
SYNAPSE_SMTP_PORT=587
SYNAPSE_SMTP_USER=<usuario-smtp>
SYNAPSE_SMTP_PASSWORD=<contraseña-o-clave-de-aplicación>
SYNAPSE_SMTP_FROM=<correo-remitente-autorizado>
SYNAPSE_DAILY_REPORT_TO=diego@dmentedigital.co
# Opcional: dominios incluidos en el correo
SYNAPSE_DAILY_REPORT_DOMAINS=agency,projects,technology,sales,marketing,product
```

El puerto `587` es solo un ejemplo de configuración; debe sustituirse por el puerto real del proveedor. Para el puerto `465`, la conexión usa TLS desde el inicio; para otros puertos, exige STARTTLS. No guardar la contraseña en este archivo ni en Git.

## Verificación después del despliegue

1. Confirmar que el servidor y el remitente SMTP corresponden al correo corporativo.
2. Configurar las variables en Coolify como secretos y desplegar la versión nueva de Synapse.
3. Abrir Proyectos con la cuenta administradora de Diego y registrar un seguimiento de prueba en un proyecto de pruebas.
4. Después de las 9:15 a. m. de Bogotá, comprobar que aparece el informe diario y que el estado del correo indica `enviado`.
5. Verificar que el correo llegó a `diego@dmentedigital.co` y que no contiene proyectos de dominios excluidos.

## Pendiente

No se conoce todavía el host, puerto, usuario ni remitente SMTP corporativo. La URL del panel de Coolify y el token API con permiso `deploy` también siguen pendientes. Sin esos datos no se puede completar el envío ni el despliegue por API.
