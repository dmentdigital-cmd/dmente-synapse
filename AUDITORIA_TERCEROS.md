# Auditoría de componentes y terceros de Synapse

Revisión del repositorio: 2026-10-08. Esta revisión no inspecciona contratos, paneles de la VPS ni la cuenta de Hermes.

| Componente | Uso comprobado en el código | Licencia declarada en paquete instalado | Datos y límite de verificación |
| --- | --- | --- | --- |
| React 19.3.0 y React DOM 19.3.0 | Interfaz local compilada | MIT | No aparece un endpoint externo de React en el código. |
| Lucide React 1.47.0 | Iconos de interfaz | ISC | Los iconos se distribuyen en el bundle. |
| SimpleWebAuthn Browser 14.0.0 y Server 14.0.3 | Registro y autenticación mediante passkeys | MIT | La clave pública y el contador se guardan en SQLite de Synapse. La biometría permanece bajo control del dispositivo, según el flujo implementado; no se auditó el sistema operativo. |
| Vite 8.3.0 y TypeScript 7.0.2 | Compilación | MIT y Apache-2.0, respectivamente | Son herramientas de compilación; revisar el árbol de dependencias en cada actualización. |
| Hermes | Respuestas con IA si se configura `HERMES_API_URL` | No verificable en este repositorio | Puede recibir mensajes y contexto reciente. Los dominios familia, salud y educación no se envían automáticamente salvo activación explícita. Faltan operador, subencargados, región y conservación. |
| VPS | Alojamiento de la API, archivos y SQLite | No verificable en este repositorio | Documentación histórica menciona Hostinger; falta contrastar con el panel actual, región, contrato y política de copias. |

La consulta `npm audit --omit=dev --json` del 2026-10-08 devolvió cero avisos conocidos. Ese resultado no demuestra ausencia de vulnerabilidades ni conformidad legal de proveedores. La búsqueda de `fetch` en `src/` y `server/` identificó llamadas a la API propia, Hermes y el healthcheck local; no mostró SDK de analítica, publicidad, pagos ni correo automatizado. El inventario de imágenes publicadas y su procedencia declarada está en `LICENCIAS_ACTIVOS.md`.

## Antes de incorporar otro tercero

Registrar nombre y versión, finalidad, datos transmitidos, país o región, condiciones contractuales, licencia y plazo de retención. Revisar la política de privacidad y el consentimiento aplicable antes de habilitar el envío de datos.
