# Blueprint — OAuth de Synapse para Claude Desktop

## Objetivo

Permitir que Claude Desktop se conecte al MCP remoto `https://synapse.dmentedigital.co/mcp` usando las cuentas existentes de Synapse, sin eliminar ni debilitar la autenticación Bearer usada por Hermes y otros clientes.

## Alcance de esta fase

- Descubrimiento OAuth estándar.
- Registro controlado de clientes OAuth.
- Authorization Code con PKCE.
- Pantalla de autorización usando la sesión existente de Synapse.
- MFA respetado cuando la cuenta lo requiera.
- Access tokens de corta duración y refresh tokens rotatorios.
- Mapeo de identidad a dominios y permisos MCP.
- Conservación del endpoint Bearer existente.

## Fuera de alcance

- Cambios de DNS, Coolify o secretos productivos.
- Despliegue automático.
- Reemplazo del login web existente.
- Acciones externas desde MCP.
- Guardar contraseñas, tokens o códigos OAuth en archivos del repositorio.

## Supuestos verificables

1. Claude Desktop intenta Dynamic Client Registration al usar “Iniciar sesión ahora”.
2. El servidor debe anunciar `authorization_endpoint`, `token_endpoint`, `registration_endpoint` y PKCE.
3. La identidad OAuth debe terminar en una cuenta Synapse existente, no en una cuenta nueva automática.
4. Los permisos MCP se derivan de rol y dominios de la cuenta autenticada.

## Criterios de éxito

- Los endpoints `.well-known` devuelven JSON válido y no HTML.
- Un cliente de prueba puede registrarse respetando una política de redirect URIs.
- El flujo Authorization Code + PKCE completa login y MFA sin exponer credenciales.
- Un access token permite `initialize` y `tools/list` en `/mcp`.
- Un token read-only no puede invocar herramientas de escritura.
- El Bearer MCP existente continúa funcionando.
- Las pruebas automáticas pasan.

## Orden de implementación

1. Modelo persistente para clientes, códigos, tokens y consentimientos.
2. Endpoints OAuth de descubrimiento y registro controlado.
3. Authorization endpoint integrado con sesión web y MFA.
4. Token endpoint con PKCE, expiración y rotación.
5. Adaptación de `/mcp` para aceptar tokens OAuth además de Bearer.
6. Pruebas unitarias, integración local y smoke test MCP.
7. Auditoría de seguridad; solo después se considerará despliegue.
