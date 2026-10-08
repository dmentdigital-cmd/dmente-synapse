# Estado de cumplimiento de Synapse

Fecha de revisión: 2026-10-08. Alcance: versión de pruebas con cuentas creadas por administración. Esta revisión describe el código del repositorio; no certifica el despliegue ni constituye concepto jurídico.

## Implementado en el repositorio

| Requisito | Implementación |
| --- | --- |
| Privacidad, términos, cookies y contacto | `public/legal/` y enlaces en acceso y pie de página. Los datos del responsable fueron proporcionados por el propietario del proyecto. |
| Aceptación antes de usar una cuenta | Pantalla de aceptación explícita tras autenticación, registro de fecha en `user_accounts.terms_accepted_at` y bloqueo de API de usuario hasta aceptarla. |
| Solicitud de borrado | Configuración permite crear una solicitud persistente para revisión de supresión total. El administrador ve las pendientes. La solicitud no ejecuta automáticamente la supresión. |
| Cookies | Aviso visible, política pública y ninguna categoría opcional detectada en el código. La cookie de sesión es necesaria para autenticación. |
| Formularios y minimización | Acceso, chat, proyectos, cuentas y agenda explican la finalidad de los datos. La API pública de leads exige nombre y WhatsApp; sus campos adicionales son opcionales. El formulario parental no pide datos del menor ni carga documentos. El formulario externo que envía leads a la API no está en este repositorio. |
| Minimización de terceros | Se retiró la carga de Google Fonts. El envío automático a Hermes de dominios `family`, `health` y `education` queda desactivado salvo `SYNAPSE_SENSITIVE_AI_ENABLED=true`. |
| Autorización parental | La cuenta no administrativa con dominio familia, salud o educación debe presentar autorización expresa; un administrador distinto registra una referencia de verificación fuera de banda. El titular puede revocar. Se bloquea el acceso a esos dominios antes de la verificación y tras la revocación. Las cuentas administrativas quedan reservadas a la operación interna; no se debe asignar ese rol a clientes. |
| Accesibilidad | Las imágenes de la interfaz tienen `alt` (vacío cuando son decorativas), el chat tiene nombre accesible, los diálogos de agenda y proyectos controlan foco/Tab/Escape y se añadió foco visible global. Se elevaron 95 colores de texto semitransparente sobre fondos oscuros. Falta medición visual de todos los estados y prueba con lector de pantalla. |
| Dependencias y activos | `npm audit --omit=dev --json` devolvió cero avisos el 2026-10-08. `AUDITORIA_TERCEROS.md` documenta paquetes y flujos detectados; `LICENCIAS_ACTIVOS.md` inventaría 30 activos publicados y la declaración de Diego. Ninguna de estas verificaciones prueba las condiciones de los proveedores remotos ni una cesión formal de derechos. |
| Pagos, reembolsos y baja de correos | El código actual no contiene checkout, suscripciones ni envío automatizado de correo. Los términos indican que estas funciones no existen en esta versión. |
| Ética comercial | No se encontraron testimonios, reseñas, precios ni cobros en la interfaz examinada. El pie de página muestra nombre indicado de la titular, ciudad, teléfono, correo y documentos legales. Antes de activar pagos, reseñas o correo automatizado, se deben implementar desglose de precio/impuestos/renovación, consentimiento de compra, cancelación, reseñas verificables y enlace funcional de baja. |

## Pendiente antes de ofrecer Synapse a clientes

1. Identificar proveedor, región y contratos de la VPS y de toda la cadena de Hermes/IA. La configuración del endpoint no prueba dónde se procesan los datos ni la política de retención de esos proveedores.
2. Completar la evidencia de autoría y eventual cesión de logos e imágenes descrita en `LICENCIAS_ACTIVOS.md`. Diego Sanabria declaró haberlos creado para el proyecto, pero la cesión formal a Tania Alvarado garcia no se verificó.
3. Definir y aplicar una rutina de supresión para cuentas, mensajes, proyectos, leads, auditoría y copias de respaldo. Hoy solo existe la **solicitud** de borrado. Los registros de auditoría son inmutables por disparadores de SQLite y pueden contener identificadores de actor.
4. Probar con representantes reales el procedimiento externo de verificación parental, interés superior y escucha del menor según su madurez. El código registra una referencia de comprobación, pero no puede validar por sí solo la autenticidad de la representación. Antes del alta pública, añadir aislamiento entre clientes y evitar cuentas administrativas para clientes.
5. Medir contraste renderizado de todos los estados y recorrer la aplicación completa con teclado y lector de pantalla. Los ajustes de CSS, foco y `alt` no constituyen una auditoría WCAG completa. Referencia: [WCAG 2.2, criterios de contraste y teclado](https://www.w3.org/TR/WCAG22/).
6. Revisar textos legales con asesoría jurídica antes del lanzamiento a clientes, incluidos tratamiento de datos sensibles, encargados, transferencias y política comercial. Actualizar términos y pedir nueva aceptación al cambiar su versión.

## Conservación propuesta

[Inferencia] La opción prudente es conservar por finalidad, con plazos distintos: cuentas mientras tengan acceso; mensajes y tareas mientras el proyecto o uso familiar siga activo; leads durante 12 meses desde la última interacción sin avance; registros técnicos durante 90 días; y copias de respaldo durante un máximo de 30 días después de una supresión. Las excepciones por deber legal o disputa deben documentarse por caso. Estos plazos **no están implementados** y no deben presentarse al usuario como vigentes hasta configurar las rutinas y confirmar el régimen aplicable y el respaldo de la VPS.

La [SIC explica que el tratamiento debe tener una finalidad informada y durar solo lo necesario](https://www.sic.gov.co/recursos_user/boletin-juridico-feb2017/articulo/datos/el-principio-de-la-finalidad-debe-tenerse-en-cuenta.html). También [describe el contenido y la publicidad de la política de tratamiento](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales).
