# Dmente Synapse: landing comercial

Página estática independiente, en HTML, CSS y JavaScript. No requiere instalar dependencias. No modifica la aplicación Synapse existente.

## Probar localmente

Desde esta carpeta, con Node.js 20 o posterior:

```powershell
npm run dev
```

Abra `http://127.0.0.1:4178`. Para otro puerto: `$env:PORT='4180'; npm run dev`. Detenga el servidor con Ctrl+C.

También puede ejecutar `python -m http.server 4178 --bind 127.0.0.1` desde esta carpeta.

## Generar la entrega

```powershell
npm run build
npm run preview
```

`dist/` contiene únicamente los archivos públicos que se deben servir. Las rutas son relativas y permiten montar la landing en una subcarpeta. No se usa Vite ni se necesita configurar `base`.

Cuando se confirme el dominio público, configure `SITE_URL` antes de generar la entrega. El script añade canonical, `og:url`, imagen social absoluta, sitemap y robots. Use la URL completa de la landing, terminada en `/`. No se ha inventado un dominio.

```powershell
$env:SITE_URL='https://DOMINIO-CONFIRMADO/'
npm run build
```

## Archivos

- `index.html`: contenido, SEO y estructura semántica.
- `styles.css`: identidad visual, responsive, foco y movimiento reducido.
- `app.js`: menú móvil, pestañas accesibles, selección de proyectos y aprobación simulada reversible.
- `assets/`: logo optimizado, favicon, Manrope alojada localmente y su licencia.
- `legal/`: copias de los documentos existentes de la versión de pruebas, con rutas relativas y una aclaración de su alcance. No se han redactado nuevas condiciones comerciales.
- `scripts/build.mjs`: copia los archivos públicos a `dist` y configura el dominio si está definido.
- `scripts/serve.mjs`: servidor de desarrollo local.
- `DESIGN.md`: decisiones visuales de esta superficie.
- `VERIFICATION.md`: comprobaciones y límites de verificación.

## Comportamiento y contenido

El CTA principal de prueba lleva a `https://synapse.dmentedigital.co/?trial=1`; el enlace alternativo abre WhatsApp al `+57 321 834 6407`, según la elección del usuario. Los mensajes están precargados; el visitante decide enviarlos. Correo: `info@dmentedigital.co`.

El tablero es ilustrativo. Proyectos, nombres, responsables, avances y horarios son ficticios. Simular una aprobación solo cambia el DOM; permite reiniciar y no hace llamadas de red ni ejecuta una acción real. La landing no recopila formularios, no inicia sesión, no utiliza almacenamiento del navegador ni incluye analítica.

La prueba se controla en la aplicación Synapse: el registro crea una cuenta viewer con `trial_started_at` igual al instante de creación y `trial_ends_at` 15 días después. Las rutas operativas consultan esa fecha en cada solicitud y responden con `TRIAL_EXPIRED` cuando vence; la sesión puede mostrar la pantalla de finalización y ofrecer continuidad por WhatsApp. Las cuentas administrativas creadas internamente no reciben este límite.

Los textos parten del archivo `PROMPT_CODEX_LANDING_SYNAPSE_2026-10-19.md`. Se conserva literalmente el principio rector. Se utiliza «Solicite una propuesta» sin precios, métricas, clientes ni testimonios inventados. La [referencia comercial](https://korvexiamx.com/) se consultó para estructura, sin copiar su texto ni diseño.

## Desplegar en Coolify

La landing debe ser una aplicación independiente en Coolify, con su propio UUID. No use el UUID ni sustituya el despliegue de la aplicación operativa Synapse.

### Opción Static + Nginx con `/dist`

1. Ejecute `npm run build` desde esta carpeta. Configure antes `SITE_URL` cuando tenga el dominio definitivo.
2. Prepare un repositorio o rama de entrega que incluya los archivos generados dentro de `dist/`. `dist/` se ignora en el repositorio de desarrollo; el repositorio de entrega debe contenerlo explícitamente. Compruebe repositorio y rama antes de desplegar.
3. Cree en Coolify una aplicación para ese repositorio y rama. Elija **Static** como Build Pack y **Nginx** como servidor (`nginx:alpine`).
4. Configure **Base Directory** como `/dist` si esa carpeta está en la raíz del repositorio de entrega. Static sirve los archivos ya construidos; no ejecuta `npm run build`.
5. Configure el dominio, el puerto interno `80` y el certificado HTTPS. Despliegue y compruebe la portada, los recursos, los enlaces legales y WhatsApp.

Si conserva esta carpeta dentro del repositorio actual y entrega el `dist` generado allí, la ruta sería `/synapse-landing/dist`. No seleccione `/dist` en la raíz del repositorio actual: pertenece a la aplicación operativa.

### Opción con build desde el código fuente

Use Nixpacks con Site type **Static**, Base Directory `/synapse-landing` si mantiene este monorepo (o `/` en un repositorio independiente), Build Command `npm run build` y Publish Directory `/dist`. Esta opción genera los archivos en Coolify. La landing no tiene dependencias npm.

La diferencia entre Base Directory y Publish Directory está documentada por Coolify: [Static](https://coolify.io/docs/applications/builds/static), [Nixpacks](https://next.coolify.io/docs/applications/builds/nixpacks/deploy).

La conexión global autorizada de Dmente Digital se encuentra en `C:\Users\diego\AppData\Local\DmenteDigital\Coolify\README.md`. Consúltela y ejecute `check` antes de diagnosticar una falta de credencial. Esta entrega no contiene credenciales ni ha desplegado recursos.

## Pendientes para publicación comercial

- Confirmar dominio final y generar con `SITE_URL`.
- Confirmar responsable, proveedor, ubicación de datos y servicios de IA para la implementación comercial; la documentación actual los deja pendientes de verificación.
- Revisar y actualizar los documentos legales de pruebas para la oferta comercial antes de incorporar datos de clientes o aceptar pagos.

## Origen de recursos

El logo procede de `LOGO DMENTE SYNAPSE FINAL.jpg`, suministrado en este proyecto. Se redujo a WebP de 640 × 640 sin generar una marca nueva. El favicon es una D tipográfica geométrica auxiliar, no sustituye el logo.

Tipografía Manrope, distribución de Google Fonts, licencia SIL Open Font License en `assets/Manrope-OFL.txt`. URL de origen: `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2`. Iconos geométricos SVG incluidos en el HTML. No hay CDN ni dependencias remotas en tiempo de ejecución.
