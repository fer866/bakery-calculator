/**
 * Bakery Calculator - Tour Module (v2.1.0-b4k3r1)
 * Guided onboarding experience powered by Driver.js (offline-ready).
 */

import { getPreference, setPreference } from './db.b4k3r1.js';

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

export function startTour(force = false) {
  const DriverFactory = getDriver();
  if (!DriverFactory) {
    console.warn('Driver.js no está disponible en este momento.');
    return;
  }

  // Switch to home tab first to ensure all elements are visible
  const homeTabBtn = document.querySelector('[data-view="tab-inicio"]');
  if (homeTabBtn) homeTabBtn.click();

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
        driverInstance.destroy();
      },
      steps: [
        {
          element: '#hero-metric-card',
          popover: {
            title: '1. Tu Margen y Costo Real',
            description: 'Aquí ves en tiempo real tu margen de ganancia porcentual y el costo de producción exacto por cada pieza.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#roi-metric-card',
          popover: {
            title: '2. Punto de Equilibrio y ROI',
            description: 'Conoce cuántas piezas debes vender para recuperar tu inversión inicial en ingredientes y gastos operativos.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#simulador-card',
          popover: {
            title: '3. Simulador de Precios en Vivo',
            description: 'Desliza el control o escribe un precio de venta para ver al instante cómo cambia tu margen y tu ganancia neta.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#btn-bake-cta',
          popover: {
            title: '4. Hornear en 1 Clic',
            description: 'Al pulsar aquí, confirmas la producción del lote y el sistema descuenta automáticamente los ingredientes exactos de tu inventario.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#bottom-nav-bar',
          popover: {
            title: '5. Navegación Rápida',
            description: 'Accede a tus Recetas (alta rápida en 2 pasos), tu Inventario de Stock (captura directa) y tus Gastos Operativos.',
            side: 'top',
            align: 'center'
          }
        }
      ]
    });

    driverInstance.drive();
  }, 100);
}
