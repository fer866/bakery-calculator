/**
 * Bakery Calculator - Tour Module (v2.2.0-b4k3r4)
 * Guided onboarding experience powered by Driver.js (offline-ready).
 * Guides the user step-by-step starting completely from scratch:
 * 1. Welcome & Brand Identity
 * 2. Operating & Indirect Costs
 * 3. Ingredients & Inventory Management
 * 4. Recipe Creation Wizard
 * 5. Margin & Production Cost Dashboard
 * 6. Break-even & ROI Analysis
 * 7. One-click Batch Baking
 */

import { getPreference, setPreference } from './db.b4k3r4.js';

let driverInstance = null;

export function getDriver() {
  if (window.driver && window.driver.js && typeof window.driver.js.driver === 'function') {
    return window.driver.js.driver;
  }
  return null;
}

export async function shouldShowTour() {
  const completed = await getPreference('tour_completed', false);
  return !completed;
}

export async function markTourCompleted() {
  await setPreference('tour_completed', true);
}

export async function resetTour() {
  await setPreference('tour_completed', false);
  startTour(true);
}

function goToTab(tabId) {
  if (tabId === 'tab-ajustes') {
    const btn = document.getElementById('btn-header-settings');
    if (btn) btn.click();
  } else {
    const btn = document.querySelector(`[data-view="${tabId}"]`);
    if (btn) btn.click();
  }
}

export function startTour(force = false) {
  const DriverFactory = getDriver();
  if (!DriverFactory) {
    console.warn('Driver.js no está disponible en este momento.');
    return;
  }

  // Ensure starting at home tab first
  goToTab('tab-inicio');

  setTimeout(() => {
    driverInstance = DriverFactory({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: 'Siguiente ➜',
      prevBtnText: '◀ Atrás',
      doneBtnText: '¡Listo, a hornear! 👨‍🍳',
      onDestroyStarted: () => {
        markTourCompleted();
        goToTab('tab-inicio');
        driverInstance.destroy();
      },
      steps: [
        {
          element: '.app-header',
          popover: {
            title: '👋 ¡Bienvenido a Bakery Calculator!',
            description: 'Tu calculadora profesional conectada a Cloudflare D1 para costear tus postres, asegurar tu margen de ganancia y controlar tu inventario. La app inicia desde cero para que configures tu propio taller o repostería.',
            side: 'bottom',
            align: 'center'
          },
          onHighlightStarted: () => {
            goToTab('tab-inicio');
          }
        },
        {
          element: '#settings-negocio-nombre',
          popover: {
            title: '1. Registra tu Marca o Taller',
            description: 'Comienza escribiendo aquí el nombre de tu repostería o taller. Se guardará en la nube y se mostrará en el encabezado de la app y en tus reportes exportados.',
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            goToTab('tab-ajustes');
          }
        },
        {
          element: '#tab-gastos .card',
          popover: {
            title: '2. Costos Indirectos y Operativos',
            description: 'Establece tus gastos de gas por minuto de horneado, tarifa de mano de obra y costo de empaque por pieza. Así sabrás el costo real de cada lote sin dejar gastos fuera.',
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            goToTab('tab-gastos');
          }
        },
        {
          element: '#insumo-quick-add-form',
          popover: {
            title: '3. Registra tus Insumos e Ingredientes',
            description: 'Agrega cada ingrediente con su presentación comercial y precio de compra (ej. Harina 1000g en $32). El sistema calcula automáticamente el costo por gramo y controla tu stock restante.',
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            goToTab('tab-stock');
          }
        },
        {
          element: '#btn-open-recipe-wizard',
          popover: {
            title: '4. Diseña tus Recetas',
            description: 'Pulsa "+ Nueva Receta" para combinar tus insumos, definir cuántas piezas produce cada lote, contemplar mermas y asignar tu precio de venta deseado.',
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            goToTab('tab-recetas');
          }
        },
        {
          element: '#hero-metric-card',
          popover: {
            title: '5. Margen y Costo Unitario en Vivo',
            description: 'Al elegir una receta en el inicio, verás al instante tu costo unitario exacto por pieza y tu porcentaje de margen real de ganancia.',
            side: 'bottom',
            align: 'start'
          },
          onHighlightStarted: () => {
            goToTab('tab-inicio');
          }
        },
        {
          element: '#roi-metric-card',
          popover: {
            title: '6. Punto de Equilibrio y ROI',
            description: 'Descubre cuántas piezas debes vender para recuperar exactamente tu inversión en insumos e indirectos, y cuántas son pura ganancia libre.',
            side: 'top',
            align: 'center'
          },
          onHighlightStarted: () => {
            goToTab('tab-inicio');
          }
        },
        {
          element: '#btn-bake-cta',
          popover: {
            title: '7. Hornear en 1 Clic',
            description: 'Cuando prepares un lote, pulsa este botón. El sistema registrará la producción y descontará automáticamente del inventario las cantidades de cada insumo en la base de datos.',
            side: 'top',
            align: 'center'
          },
          onHighlightStarted: () => {
            goToTab('tab-inicio');
          }
        }
      ]
    });

    driverInstance.drive();
  }, 120);
}
