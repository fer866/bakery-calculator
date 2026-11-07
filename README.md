# 🧁 Bakery Calculator (Paulicious Bakery)

> Aplicación web móvil (PWA), modular, offline-first y accesible para el cálculo de costos de producción, márgenes de ganancia, retorno de inversión (ROI), punto de equilibrio y control de inventario en repostería artesanal.

---

## 🚀 Características Principales

* **Curva de aprendizaje cero**: Sistema de registro simplificado en 1 o 2 toques.
* **Tour interactivo guiado**: Onboarding paso a paso con [Driver.js](https://driverjs.com/) empaquetado para funcionamiento 100% offline.
* **Arquitectura desacoplada**: Cero código JavaScript incrustado en HTML, módulos ES6 independientes (`app`, `db`, `engine`, `ui`, `theme`, `tour`).
* **Soporte PWA y Offline-First**: Service Worker con ciclo de vida silencioso (`skipWaiting`, `clients.claim` y actualización automática al cambiar de ruta).
* **Tematización moderna**: Soporte tri-estado (automático, claro, oscuro) mediante tokens CSS `light-dark()` y `color-scheme`.
* **Fórmula de costeo exacta**:
  * Chispas de chocolate (80g): $\approx \$8.42$ por pieza.
  * M&M's mini (80g): $\approx \$12.10$ por pieza.
* **Estándar `llms.txt`**: Archivo de especificación concisa optimizado para modelos de lenguaje e IA.

---

## 📁 Estructura del Proyecto

```
/
├── index.html                  # Shell semántico, SEO, Schema.org (sin inline JS)
├── sw.js                       # Service Worker con precaché y actualización en rutas
├── manifest.webmanifest        # Manifiesto de instalación PWA
├── llms.txt                    # Contexto para modelos de lenguaje
├── favicon.svg                 # Icono SVG responsivo
├── icon-192.png                # Icono PWA 192x192
├── icon-512.png                # Icono PWA 512x512
├── logo_paulicious_bakery.jpg  # Identidad visual de la marca
├── css/
│   ├── styles.b4k3r1.css       # Tokens semánticos, light-dark() y layout
│   └── vendor/
│       └── driver.css          # Estilos del tour interactivo
└── js/
    ├── app.b4k3r1.js           # Router de pestañas y orquestador de eventos
    ├── db.b4k3r1.js            # Capa reactiva sobre IndexedDB con Promesas
    ├── engine.b4k3r1.js        # Motor matemático de costeo, ROI y conversiones
    ├── ui.b4k3r1.js            # Renderizado por componentes y notificaciones toast
    ├── theme.b4k3r1.js         # Sincronización de tema (auto, claro, oscuro)
    ├── tour.b4k3r1.js          # Orquestador del tour guiado interactivo
    └── vendor/
        └── driver.iife.js      # Biblioteca Driver.js offline
```

---

## 🛠️ Tecnologías

* **HTML5** Semántico & Accesible (WAI-ARIA)
* **CSS3** Moderno (`color-scheme`, `light-dark()`, Grid & Flexbox)
* **Vanilla JavaScript ES Modules** (Sin dependencias ni frameworks pesados)
* **IndexedDB** (`BakeryCalculatorDB` v2)
* **Service Workers & Cache API**
* **Driver.js** (Empaquetado localmente)

---

## 👤 Autor

* **Erik Fernando Pérez Díaz** (<fer866@gmail.com>)

---

## 📄 Licencia

Distribuido bajo la licencia MIT.
