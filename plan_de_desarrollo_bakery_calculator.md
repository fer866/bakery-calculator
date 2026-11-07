# PLAN PARA GEMINI — Bakery Calculator (Edición Modular \& PWA)

> ANTES DE PEGAR ESTE PLAN EN GEMINI, ADJUNTA LOS 3 ARCHIVOS:
>
> 1. `Costeo\_ingredientes\_galletas.xlsx` (datos y fórmulas base)
>
> 2. `ui\_base\_cookiecost.json` (estructura UI/UX y motor de cálculo base)
>
> 3. `logo\_paulicious\_bakery.jpg` (o identidad visual del negocio)
>
> Si no ves los archivos adjuntos, PÍDELOS antes de comenzar. No inventes su contenido.

## 1\. ROL Y OBJETIVO

Actúa como un equipo de desarrollo senior (arquitecto de software, diseñador UI/UX especializado en micro-interacciones, desarrollador frontend y especialista en QA/SEO). Construye **Bakery Calculator**: una aplicación web móvil, inteligente, modular y ultra accesible para calcular costos de producción, márgenes de ganancia, retorno de inversión (ROI), punto de equilibrio e inventario en repostería y panadería artesanal.

La app debe ofrecer:

* Curva de aprendizaje cero gracias a un sistema de registro simplificado en 1 o 2 toques.
* Tour interactivo guiado paso a paso para usuarios primerizos.
* Arquitectura desacoplada, limpia y modular (sin JavaScript incrustado en el HTML).
* Cumplimiento total de estándares de la industria en SEO, accesibilidad, PWA y tematización moderna (`light-dark()`).
* Actualización silenciosa y transparente del Service Worker al cambiar de ruta, sin modales ni banners molestos.
* Archivo estandarizado `llms.txt` para proveer contexto ultracompacto a modelos de lenguaje y ahorrar tokens.

## 2\. STACK TECNOLÓGICO Y ARQUITECTURA MODULAR

### 2.1. Arquitectura de Archivos (Desacoplada y sin JS incrustado)

El proyecto se divide de forma estricta en módulos independientes, garantizando mantenibilidad y cumplimiento de buenas prácticas:

```
/
├── index.html                  # Estructura semántica, meta tags SEO/PWA, sin inline JS
├── sw.js                       # Service Worker con skipWaiting y actualización en rutas
├── manifest.webmanifest        # Manifiesto de instalación PWA
├── llms.txt                    # Contexto estructurado estándar para modelos de lenguaje
├── css/
│   └── styles.\[hash].css       # Tokens semánticos con light-dark(), layout y componentes
└── js/
    ├── app.\[hash].js           # Router de rutas/tabs, ciclo de vida SW y orquestador
    ├── db.\[hash].js            # Abstracción reactiva sobre IndexedDB con Promesas
    ├── engine.\[hash].js        # Motor matemático de costeo, simulación y conversiones
    ├── ui.\[hash].js            # Renderizado por componentes y actualización reactiva del DOM
    ├── theme.\[hash].js         # Sincronización de tema (auto, claro, oscuro)
    └── tour.\[hash].js          # Orquestador del tour guiado interactivo
```

### 2.2. Estrategia de Caché y Actualización Silenciosa del Service Worker

A diferencia de los sistemas tradicionales con banners ("*Hay una nueva versión disponible, pulsa aquí para recargar*"), la actualización se ejecuta **en segundo plano de forma 100% transparente**:

1. **Detección por Cambio de Ruta y Navegación:**

   * En cada cambio de pestaña o ruta interna en `app.\[hash].js` (mediante el router de vistas o evento `hashchange`/`popstate`), el cliente invoca:

```javascript
     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.ready.then(registration => {
         registration.update();
       });
     }
     ```

2. **Relevo Inmediato sin Espera (`skipWaiting` + `clients.claim`):**

   * En `sw.js`, el evento `install` llama inmediatamente a `self.skipWaiting()`.
   * El evento `activate` invoca `self.clients.claim()`, purga cachés desactualizadas y toma el control de inmediato.
   * La próxima vista o navegación del usuario cargará automáticamente los nuevos bundles con su respectivo hash sin interrumpir el flujo de trabajo ni mostrar alertas intrusivas.
3. **Nombres con hash de contenido:** Todos los archivos referenciados en HTML (`styles.\[hash].css`, `app.\[hash].js`, etc.) usan un hash identificador de versión (ej. `app.v2-a7f3b.js`).
4. **Encabezados y metaetiquetas de control de caché en `index.html`:**

```html
   <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
   <meta http-equiv="Pragma" content="no-cache">
   <meta http-equiv="Expires" content="0">
   ```

### 2.3. Sistema de Temas Moderno (`color-scheme` y `light-dark()`)

Implementación de la especificación moderna de CSS sin sobrecargar clases complejas:

* Configuración global en `:root`:

```css
  :root {
    color-scheme: light dark;
    --bg-main: light-dark(#FDF8F3, #1A120E);
    --surface: light-dark(#FFFFFF, #261B16);
    --surface-elevated: light-dark(#FFFDF9, #32231D);
    --text-primary: light-dark(#4A2818, #F7ECE4);
    --text-muted: light-dark(#8C7063, #B89C8E);
    --primary: light-dark(#E0636C, #E5737B);
    --primary-dark: light-dark(#C44D56, #C75B63);
    --border: light-dark(#F2DFCE, #443026);
    --gold: light-dark(#C89B5E, #E0B47A);
    --success: light-dark(#2E8B57, #45B277);
    --danger: light-dark(#C93B2B, #E25B4C);
  }
  ```

* **Tres modalidades disponibles en Ajustes:**

  1. `Automático (Sistema)`: escucha cambios con `window.matchMedia('(prefers-color-scheme: dark)')`.
  2. `Claro (Light)`: fuerza `style="color-scheme: light;"` en `<html>`.
  3. `Oscuro (Dark)`: fuerza `style="color-scheme: dark;"` en `<html>`.
* Persistencia inmediata de la preferencia seleccionada en IndexedDB/LocalStorage.

## 3\. SEO DE ALTO RENDIMIENTO, METADATOS Y PERSONALIZACIÓN

El archivo `index.html` debe incorporar el estándar completo de la industria para PWA y posicionamiento orgánico:

* **Autor:** Erik Fernando Pérez Díaz
* **Viewport adaptativo:** `width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover`
* **Etiquetas dinámicas `theme-color` con media queries:**

```html
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FDF8F3">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1A120E">
  ```

* **Iconografía PWA \& Apple Touch:**

  * `apple-mobile-web-app-capable`: `yes`
  * `apple-mobile-web-app-status-bar-style`: `black-translucent`
  * `apple-mobile-web-app-title`: `Bakery Calc`
* **Open Graph y Twitter Cards completos:** Título, descripción, imagen representativa `og:image`, tipo `website`, idioma `es\_MX`.
* **Datos estructurados Schema.org (`application/ld+json`):**

  * Tipo: `WebApplication` / `SoftwareApplication`
  * Name: `Bakery Calculator`
  * Author: `Erik Fernando Pérez Díaz`
  * ApplicationCategory: `BusinessApplication` / `FinanceApplication`
  * OperatingSystem: `All (Web, iOS, Android)`

## 4\. ANÁLISIS DE BIBLIOTECA DE TOURS GUIADOS (ONBOARDING)

Para guiar al usuario sin añadir sobrecarga innecesaria, se evalúan tres enfoques:

|Criterio|Driver.js (Recomendado)|Shepherd.js|Tour Nativo Vanilla Propio|
|-|-|-|-|
|**Peso / Bundle**|$\\approx 5\\text{ KB}$ (gzipped)|$\\approx 15\\text{ KB}$ + Popper.js|$< 2\\text{ KB}$|
|**Dependencias**|Cero (100% vanilla)|Requiere Popper|Cero|
|**Respaldo Offline**|Fácil de incluir en `sw.js`|Requiere sincronizar Popper|100% integrado|
|**Personalización de estilos**|Soporta CSS variables nativas|Requiere overrides profundos|Directo con `--primary`, etc.|
|**Popovers con 'Highlight' real**|Sí (SVG overlay recortado)|Sí (vía Popper/Tippy)|Requiere canvas/backdrop|

### Decisión de Arquitectura:

Adoptar **Driver.js** (vía CDN local/cacheado por Service Worker) o un micro-módulo nativo en `js/tour.\[hash].js` que utiliza `<dialog>` y un elemento con `box-shadow: 0 0 0 9999px rgba(0,0,0,0.65)`.

* **Comportamiento:** Se activa automáticamente en la primera visita del usuario tras completar la pantalla de bienvenida.
* **Pasos del Tour:**

  1. *Hero Metric:* Explicación del margen y costo unitario en vivo.
  2. *Simulador:* Cómo arrastrar sliders para ajustar ganancias deseadas.
  3. *Acción Principal:* Botón "Hornear Lote" y cómo descuenta inventario automáticamente.
  4. *Navegación:* Ubicación de las pestañas de Recetas, Stock y Gastos.
* Incluye botón permanente en **Ajustes**: `\[ 🚀 Repetir Tour de Bienvenida ]`.

## 5\. EXPERIENCIA DE USUARIO (UX) CON FLUJOS ULTRA SENCILLOS

Para reducir la fricción al mínimo indispensable en cada pantalla:

1. **Dashboard (Inicio):**

   * Selector superior desplegable de postre activo.
   * Botón de acción masiva: `\[ 👨‍🍳 Hornear Lote ]` en 1 solo clic con diálogo nativo de confirmación (`"¿Confirmas horneado de 16 piezas? Se descontará del stock"`).
2. **Registro Ultrarrápido de Recetas (Wizard en 2 pasos):**

   * *Paso 1 (Esenciales):* Nombre del postre y cantidad de piezas que rinde.
   * *Paso 2 (Insumos con autocompletado):* Lista rápida con chips de los insumos más comunes. Al tocar un insumo solo se solicita la cantidad utilizada (ej. `250 g`).
   * *Opcionales plegados:* Campos de empaque, gas y mano de obra permanecen plegados en un acordeón con valores globales sugeridos por defecto.
3. **Registro Ultrarrápido de Insumos (En 1 sola pantalla):**

   * Fila de entrada rápida permanente en la parte superior: `\[Nombre] \[Precio pagado] \[Cantidad comprada] \[Unidad ▼] \[+ Guardar]`.
   * Sin abrir formularios largos para altas cotidianas.
4. **Reposición de Stock en 2 Toques:**

   * Al lado de cada insumo hay un botón `\[+ Compré más]`.
   * Al tocarlo, abre un micro-prompt numérico: *"¿Cuántas unidades compraste?"* y recalcula el stock en 1 segundo.
5. **Ajustes Rápidos de Costos Indirectos:**

   * Valores sugeridos estándar precargados (ej. gas promedio por minuto, bolsa por pieza). El usuario solo modifica lo que necesita.

## 6\. ESTÁNDAR `llms.txt` (OPTIMIZACIÓN DE TOKENS Y LECTURA CONTEXTUAL)

Para permitir que agentes autónomos y modelos de lenguaje comprendan el proyecto sin reanalizar todo el código fuente ni gastar tokens de forma redundante, se generará el archivo `/llms.txt` siguiendo el estándar oficial:

```markdown
# Bakery Calculator

> Aplicación web progresiva (PWA) móvil, offline-first, para costeo de repostería, cálculo de márgenes, punto de equilibrio y control de inventario.

## Arquitectura y Stack
- Frontend: HTML5 semántico, CSS3 moderno (color-scheme, light-dark()), Vanilla JS modular (ES Modules).
- Persistencia: IndexedDB (Base de datos: BakeryCalculatorDB).
- Autor: Erik Fernando Pérez Díaz.
- Ciclo de vida PWA: Service Worker (sw.js) con actualización transparente en cambios de ruta y sin inline JS.

## Fórmulas Financieras Clave
- costoUnitarioInsumo = precioPresentacion / cantidadPresentacion
- costoIngredientes = Σ (costoUnitarioInsumo × cantidadReceta)
- costoIndirectoLote = gas + manoDeObra + empaqueLote + amortizacion
- costoTotalLote = costoIngredientes + costoIndirectoLote
- costoUnitarioPieza = costoTotalLote / piezasPorLote
- margenPct = ((precioVenta - costoUnitarioPieza) / precioVenta) × 100
- puntoEquilibrio = ceil(costoTotalLote / precioVenta)

## Módulos de Código
- `index.html`: Shell PWA con meta tags SEO, JSON-LD Schema.org y viewport adaptable.
- `js/engine.\[hash].js`: Motor de costeo matemático puro y conversiones de unidades.
- `js/db.\[hash].js`: Capa IndexedDB para insumos, postres, gastos y configuración.
- `js/ui.\[hash].js`: Renderizado por diferencias y componentes de interfaz.
- `js/theme.\[hash].js`: Gestión tri-estado de temas (auto, claro, oscuro).
- `js/tour.\[hash].js`: Tour guiado de onboarding interactivo.
- `sw.js`: Service worker para modo offline y actualización silenciosa.
```

## 7\. MOTOR FINANCIERO Y FÓRMULAS (`js/engine.\[hash].js`)

$$
\\begin{aligned}
\\text{costoIngredientes} \&= \\sum \\left( \\frac{\\text{precioPres}}{\\text{cantidadPres}} \\times \\text{cantidadReceta} \\right) \\
\\text{costoIndirectoLote} \&= \\text{gas} + \\text{manoObra} + (\\text{costoEmpaquePieza} \\times \\text{piezas}) + \\text{amortizacion} \\
\\text{costoTotalLote} \&= \\text{costoIngredientes} + \\text{costoIndirectoLote} \\
\\text{costoUnitario} \&= \\frac{\\text{costoTotalLote}}{\\text{piezasPorLote}} \\
\\text{utilidadLote} \&= (\\text{piezasPorLote} \\times \\text{precioVenta}) - \\text{costoTotalLote} \\
\\text{margenPorcentual} \&= \\left( \\frac{\\text{precioVenta} - \\text{costoUnitario}}{\\text{precioVenta}} \\right) \\times 100 \\
\\text{roiPorcentual} \&= \\left( \\frac{\\text{utilidadLote}}{\\text{costoTotalLote}} \\right) \\times 100 \\
\\text{puntoEquilibrio} \&= \\left\\lceil \\frac{\\text{costoTotalLote}}{\\text{precioVenta}} \\right\\rceil
\\end{aligned}
$$

## 8\. MODELO DE PERSISTENCIA (`js/db.\[hash].js`)

IndexedDB con base de datos `BakeryCalculatorDB` versión 2:

* `insumos`: `{ id, nombre, proveedor, cantidadPres, unidadPres, precioPres, stockActual, stockMinimo, updatedAt }`
* `postres`: `{ id, nombre, piezasPorLote, pesoPieza, precioVenta, indirectos: {...}, insumos: \[...] }`
* `lotesHorneados`: `{ id, postreId, fecha, piezasReales, costoTotalHistorico }`
* `gastosGenerales`: `{ id, tipo, tarifa, periodicidad }`
* `preferencias`: `{ key, value }` (incluye `'theme\_preference': 'auto' | 'light' | 'dark'`, `'tour\_completed': true/false`)

## 9\. ENTREGABLES

1. `index.html` sin código JavaScript incrustado, con enlaces de módulos `<script type="module" src="js/app.\[hash].js">`.
2. Hojas de estilos en `/css` con soporte nativo `light-dark()` y `color-scheme`.
3. Módulos JavaScript independientes y desacoplados en `/js`.
4. Service Worker `sw.js` con actualización transparente en transiciones de ruta.
5. Manifiesto PWA `manifest.webmanifest`.
6. Archivo estándar `/llms.txt` con la especificación de contexto compacta.
7. Conjunto de datos semilla listo para importar o cargar en 1 toque.

## 10\. CRITERIOS DE ACEPTACIÓN TÉCNICA

* **Sin JS inline:** Cero etiquetas `<script>` con código ejecutable embebido dentro de `index.html`.
* **Actualización transparente del SW:** Al navegar entre rutas, el Service Worker actualiza recursos silenciosamente sin solicitar al usuario clics en banners ni recargas forzadas.
* **Contexto LLM disponible:** Existencia del archivo `/llms.txt` accesible vía HTTP con la síntesis técnica del sistema.
* **Soporte de temas:** Al alternar el tema del sistema operativo o el interruptor manual, la interfaz conmuta instantáneamente sin parpadeos (*flash of unstyled content*).
* **Tour guiado:** El tour se ejecuta suavemente en el primer ingreso y se puede reiniciar desde Ajustes sin recargar la página.
* **Precisión de datos semilla:** $\\approx $8.42$ (Chispas) y $\\approx $12.10$ (M\&M's) por pieza antes de costos indirectos.
* **SEO \& Accesibilidad:** 100% de metadatos requeridos validados, autor Erik Fernando Pérez Díaz acreditado y contraste accesible en tema claro y oscuro (WCAG AA).

## 11\. FASE DE PREGUNTAS Y CLARIFICACIÓN PREVIA (ANTES DE EMPEZAR)

> \*\*INSTRUCCIÓN MANDATORIA PARA EL MODELO:\*\*
> \*\*NO comiences a escribir código ni a generar la aplicación hasta haber presentado esta lista completa de preguntas al usuario y haber recibido sus respuestas.\*\*

1. **Tema inicial por defecto:** ¿Deseas que la app inicie en sincronización automática con el sistema del dispositivo (`auto`), o forzada en modo claro en su primer inicio?
2. **Biblioteca del Tour Guiado:** ¿Prefieres integrar **Driver.js** (vía CDN local/almacenada en caché) o un micro-módulo tour nativo en vanilla JS de cero dependencias?
3. **Flujo de registro ultra sencillo:** En el registro de insumos, ¿prefieres la fila de captura rápida fija siempre visible en la pantalla de inventario, o un botón flotante `(+)` que abre un micro-formulario deslizable desde abajo (*bottom sheet*)?
4. **Política ante stock insuficiente:** Al pulsar "Hornear Lote" con ingredientes faltantes, ¿se debe bloquear la acción mostrando qué falta comprar, o se permite hornear dejando el stock en saldo negativo?
5. **Merma e imprevistos:** ¿Se añade una casilla simple de porcentaje de merma (ej. 3% o 5%) al costo de los ingredientes o se calcula al 100% exacto de la receta?
6. **Estructura de hashes:** Para el cache busting de archivos, ¿prefieres el formato `archivo.v1.js` (basado en versiones semánticas) o hashes aleatorios estilo bundler `archivo.a9f2b1.js`?
7. **Moneda y formato regional:** ¿Se conserva exclusivamente el peso mexicano (`MXN $`) o deseas dejar listo el selector para cualquier divisa en Ajustes?

## 12\. PANTALLAS Y WIREFRAMES ASCII / UNICODE (APROBACIÓN OBLIGATORIA)

> \*\*COMPUERTA DE APROBACIÓN OBLIGATORIA:\*\*
> \*\*El modelo debe mostrar todos los wireframes en formato ASCII/Unicode detallados a continuación. DEBE DETENERSE Y ESPERAR CONFIRMACIÓN Y VISTO BUENO EXPLÍCITO DEL USUARIO sobre la distribución visual y flujos de registro ultra sencillos antes de programar.\*\*

### Pantalla 1: Dashboard Principal con Tour y Tema (Pestaña: Inicio)

```
┌────────────────────────────────────────┐
│ \[🧁] Bakery Calculator   \[☀️/🌙] \[⚙]  │
├────────────────────────────────────────┤
│ Postre: \[ 🍪 Galletas Chispas 80g  ▼ ] │
│                                        │
│  ╭── MARGEN Y COSTO UNITARIO ────────╮ │
│  │   \[Paso 1 Tour: Tu margen real]   │ │
│  │             ╭───────────╮         │ │
│  │            │   65.4%   │         │ │
│  │             ╰───────────╯         │ │
│  │   Costo: $9.85   •   Venta: $28.50│ │
│  ╰───────────────────────────────────╯ │
│                                        │
│  ╭── RETORNO DE INVERSIÓN (ROI) ─────╮ │
│  │ Lote: 16 pzas  • Costo total: $157│ │
│  │ Venta total: $456 • Ganancia: $298│ │
│  │ Punto de equilibrio: 6 galletas   │ │
│  ╰───────────────────────────────────╯ │
│                                        │
│  ╭── SIMULADOR RÁPIDO ───────────────╮ │
│  │ \[Paso 2 Tour: Ajusta y simula]    │ │
│  │ Precio venta: $28.50 \[───●─────]  │ │
│  │ Ganancia por galleta: $18.65      │ │
│  ╰───────────────────────────────────╯ │
│                                        │
│  ╭── REGISTRO ULTRA SENCILLO EN 1 CLIC ╮
│  │ \[Paso 3 Tour: Descuenta stock]    │ │
│  │ \[ 👨‍🍳 HORNEAR 1 LOTE (16 PZAS) ]   │ │
│  ╰───────────────────────────────────╯ │
├────────────────────────────────────────┤
│ \[🏠 Inicio] \[🍪 Recetas] \[📦 Stock] \[📊 Gastos] │
└────────────────────────────────────────┘
```

### Pantalla 2: Recetas con Flujo de Alta Ultrarrápida (Pestaña: Recetas)

```
┌────────────────────────────────────────┐
│  Recetas de Repostería       \[+ Nueva] │
├────────────────────────────────────────┤
│ \[🔍 Buscar postre...]                  │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ 🍪 Galletas Chispas (16 pzas)      │ │
│ │ Costo: $9.85  •  Venta: $28.50     │ │
│ │ Margen: 65.4% \[ Rentable ]         │ │
│ │ \[⚡ Hornear]  \[📋 Duplicar] \[✏ Editar]│ │
│ └────────────────────────────────────┘ │
│                                        │
│ ── ALTA RÁPIDA (Solo 2 pasos) ──────── │
│ 1. ¿Cómo se llama? \[ Brownies Nuez   ] │
│    ¿Cuántas piezas rinde? \[ 12 ]       │
│                                        │
│ 2. Agrega ingredientes (Toca y suma):  │
│    \[+ Harina] \[+ Mantequilla] \[+ Huevo]│
│    \[+ Azúcar] \[+ Chocolate]   \[+ Ver +]│
│                                        │
│    Ingredientes seleccionados:         │
│    • Harina:      \[ 200 ] g    ($3.60) │
│    • Mantequilla: \[ 150 ] g   ($31.80) │
│    • Chocolate:   \[ 120 ] g   ($36.00) │
│                                        │
│    Precio de venta deseado: \[ $35.00 ] │
│    \[ 💾 Guardar Receta al Instante ]   │
├────────────────────────────────────────┤
│ \[🏠 Inicio] \[🍪 Recetas] \[📦 Stock] \[📊 Gastos] │
└────────────────────────────────────────┘
```

### Pantalla 3: Inventario con Fila de Entrada Rápida (Pestaña: Insumos)

```
┌────────────────────────────────────────┐
│  Inventario de Insumos                 │
├────────────────────────────────────────┤
│ ── REGISTRO ULTRA RÁPIDO (Sin modals) ─│
│ Insumo: \[ Harina Selecta       ]       │
│ Compré: \[ 1000 ] \[ g ▼ ] por \[ $22.50 ]│
│ \[ + Agregar al Inventario ]            │
├────────────────────────────────────────┤
│ Stock actual (12 insumos registrados): │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Mantequilla sin sal (1080 g)       │ │
│ │ Stock: 2160 g  •  $0.238/g         │ │
│ │ \[+ Compré 1 paquete más (1 toque)] │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ⚠ Chispas de chocolate (1000 g)    │ │
│ │ Stock: 150 g  \[STOCK CRÍTICO]      │ │
│ │ \[+ Compré 1 paquete más (1 toque)] │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ \[🏠 Inicio] \[🍪 Recetas] \[📦 Stock] \[📊 Gastos] │
└────────────────────────────────────────┘
```

### Pantalla 4: Costos Indirectos Simplificados (Pestaña: Gastos)

```
┌────────────────────────────────────────┐
│  Costos Operativos Rápidos             │
├────────────────────────────────────────┤
│ ╭── GAS POR HORNEADA ────────────────╮ │
│ │ ¿Cuántos min horneas?: \[ 18 ] min  │ │
│ │ Costo calculado: $4.80 por lote    │ │
│ ╰─────────────────────────────────────╯ │
│                                        │
│ ╭── MANO DE OBRA DIRECTA ────────────╮ │
│ │ ¿Cuánto quieres ganar por hora?    │ │
│ │ Tarifa: \[ $80.00 ] / hora           │ │
│ │ Tiempo por lote: \[ 45 ] minutos    │ │
│ │ Costo por lote: $60.00             │ │
│ ╰─────────────────────────────────────╯ │
│                                        │
│ ╭── EMPAQUE POR PIEZA ───────────────╮ │
│ │ Bolsa + Listón + Sticker: \[ $2.00 ]│ │
│ ╰─────────────────────────────────────╯ │
│ \[ 💾 Actualizar Parámetros ]           │
├────────────────────────────────────────┤
│ \[🏠 Inicio] \[🍪 Recetas] \[📦 Stock] \[📊 Gastos] │
└────────────────────────────────────────┘
```

### Pantalla 5: Ajustes, Tema, Tour y Respaldos (Pestaña: Ajustes)

```
┌────────────────────────────────────────┐
│  Ajustes y Personalización             │
├────────────────────────────────────────┤
│ Negocio: \[ Mi Taller de Repostería   ] │
│ Autor del sistema: Erik Fernando Pérez │
│                                        │
│ ╭── APARIENCIA \& TEMA (light-dark) ──╮ │
│ │ \[ (•) Auto (Sistema) ]             │ │
│ │ \[ ( ) Modo Claro     ]             │ │
│ │ \[ ( ) Modo Oscuro    ]             │ │
│ ╰─────────────────────────────────────╯ │
│                                        │
│ ╭── APRENDIZAJE ─────────────────────╮ │
│ │ ¿Quieres repasar el funcionamiento?│ │
│ │ \[ 🚀 Iniciar Tour Interactivo ]    │ │
│ ╰─────────────────────────────────────╯ │
│                                        │
│ ╭── RESPALDO DE DATOS ───────────────╮ │
│ │ \[ 📥 Exportar JSON Seguro ]         │ │
│ │ \[ 📤 Restaurar Archivo JSON ]       │ │
│ │ \[ 🔄 Cargar Galletas de Ejemplo ]  │ │
│ ╰─────────────────────────────────────╯ │
│ Versión: v2.1.0-hash4f8e (Offline PWA) │
├────────────────────────────────────────┤
│ \[🏠 Inicio] \[🍪 Recetas] \[📦 Stock] \[📊 Gastos] │
└────────────────────────────────────────┘
```

## 13\. PROTOCOLO Y TESTS DE FLUJOS (QA Y CONTROL DE CALIDAD)

Matriz exhaustiva para verificar la integridad del código, interfaz y datos:

|ID|Flujo Evaluado|Procedimiento de Prueba|Criterio de Éxito / Resultado Esperado|
|-|-|-|-|
|**T-01**|Precisión matemática base|Cargar semilla de Chispas y M\&M's sin indirectos.|Costos unitarios exactos: $\\approx $8.42$ y $\\approx $12.10$ por pieza.|
|**T-02**|Conmutación de tema (`light-dark`)|Alternar entre Auto, Modo Claro y Modo Oscuro en Ajustes y a nivel de SO.|Los tokens CSS cambian sin flash ni errores en consola; la preferencia se almacena y persiste al recargar.|
|**T-03**|Ciclo de vida del Tour Guiado|Entrar por primera vez o presionar `\[ Iniciar Tour Interactivo ]`.|Los tooltips se centran en los elementos correctos, el backdrop bloquea clics no deseados y se puede finalizar o cerrar con tecla Escape.|
|**T-04**|Registro rápido de insumo|Rellenar la fila rápida superior con un insumo y presionar Enter o botón `+`.|El insumo se guarda en IndexedDB y aparece en la lista en menos de 100 ms sin refresco de página.|
|**T-05**|Acción rápida "Compré más"|Presionar el botón de un toque al lado de un ingrediente y añadir 1 unidad.|El stock se incrementa inmediatamente y la alerta de stock bajo se desactiva si supera el mínimo.|
|**T-06**|Hornear lote con deducción|Presionar `Hornear 1 Lote` en el Dashboard.|Todos los insumos del postre descuentan la cantidad exacta de la receta en IndexedDB; se muestra toast de confirmación.|
|**T-07**|Actualización silenciosa del Service Worker en cambio de ruta|Desplegar una nueva versión con hash nuevo y navegar entre pestañas (ej. de Inicio a Stock).|`registration.update()` se ejecuta, el nuevo Service Worker toma el control con `skipWaiting()` y `clients.claim()` de forma transparente y sin cuadros de diálogo molestos.|
|**T-08**|Disponibilidad y formato de `llms.txt`|Acceder a `/llms.txt` desde el navegador o cliente HTTP.|El archivo entrega texto plano estructurado con el contexto condensado, reduciendo drásticamente el consumo de tokens en prompts posteriores.|
|**T-09**|Integridad SEO y Metadatos|Inspeccionar el `<head>` del documento generado.|Metas de Open Graph, Schema.org con autor Erik Fernando Pérez Díaz y `theme-color` dinámicos presentes y válidos.|
|**T-10**|Operación Offline absoluta|Cortar la conexión de red (Modo Avión) y reiniciar navegador.|La aplicación carga instantáneamente y conserva 100% de funciones de costeo, edición y guardado.|



