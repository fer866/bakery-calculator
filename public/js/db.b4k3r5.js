/**
 * Bakery Calculator - Database Client Module (v2.2.1-b4k3r5)
 * Persistencia en Cloudflare D1 (bakery-db) vía Pages Functions API.
 * IndexedDB reservada exclusivamente para preferencias y ajustes locales del usuario.
 */

const LOCAL_DB_NAME = 'BakeryCalculatorUserPrefs';
const LOCAL_DB_VERSION = 1;

let localDbPromise = null;

/**
 * Obtener conexión a IndexedDB para ajustes personales locales
 */
export function getLocalDB() {
  if (localDbPromise) return localDbPromise;

  localDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('preferencias')) {
        db.createObjectStore('preferencias', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return localDbPromise;
}

/* ==========================================================
 * Preferencias Personales Locales (IndexedDB)
 * ========================================================== */

export async function getPreference(key, defaultValue = null) {
  try {
    const db = await getLocalDB();
    return new Promise((resolve) => {
      const tx = db.transaction('preferencias', 'readonly');
      const store = tx.objectStore('preferencias');
      const request = store.get(key);
      request.onsuccess = () => {
        const item = request.result;
        resolve(item ? item.value : defaultValue);
      };
      request.onerror = () => resolve(defaultValue);
    });
  } catch (_) {
    return defaultValue;
  }
}

export async function setPreference(key, value) {
  try {
    const db = await getLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('preferencias', 'readwrite');
      const store = tx.objectStore('preferencias');
      const request = store.put({ key, value, updatedAt: Date.now() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error guardando preferencia personal:', err);
    return false;
  }
}

export async function initDatabaseDefaults() {
  const existingTheme = await getPreference('theme_preference');
  if (!existingTheme) {
    await setPreference('theme_preference', 'auto');
  }

  const existingTour = await getPreference('tour_completed');
  if (existingTour === null || existingTour === undefined) {
    await setPreference('tour_completed', false);
  }

  return true;
}

/* ==========================================================
 * Manejo de Expiración de Sesión Cloudflare Zero Trust Access
 * ========================================================== */

let isRedirectingToAuth = false;

export function notifyAndRedirectSessionExpired() {
  if (isRedirectingToAuth) return;
  isRedirectingToAuth = true;

  console.warn('[Cloudflare Access] Sesión de Zero Trust vencida (24h). Redirigiendo a reautenticación...');

  if (typeof document !== 'undefined') {
    if (!document.getElementById('cf-auth-expired-notice')) {
      const notice = document.createElement('div');
      notice.id = 'cf-auth-expired-notice';
      notice.setAttribute('role', 'alertdialog');
      notice.setAttribute('aria-modal', 'true');
      notice.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        animation: fadeIn 0.25s ease-out;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      notice.innerHTML = `
        <div style="background: var(--surface, #ffffff); color: var(--text-main, #1a202c); padding: 2rem; border-radius: 1.25rem; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="font-size: 3.25rem; line-height: 1; margin-bottom: 1rem;">🔐</div>
          <h2 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em;">Sesión de Acceso Expirada</h2>
          <p style="margin: 0 0 1.25rem 0; font-size: 0.95rem; line-height: 1.5; opacity: 0.85;">
            Tu sesión de seguridad de 24 horas en <strong>Cloudflare Zero Trust</strong> ha concluido. Redirigiendo a la pantalla de verificación para renovar tus credenciales...
          </p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 1rem;">
            <div style="width: 22px; height: 22px; border: 3px solid rgba(150, 150, 150, 0.3); border-top-color: #d97706; border-radius: 50%; animation: cf-spin 0.8s linear infinite;"></div>
            <span style="font-size: 0.9rem; font-weight: 500; opacity: 0.8;">Cargando pantalla de acceso...</span>
          </div>
          <style>
            @keyframes cf-spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          </style>
        </div>
      `;
      document.body.appendChild(notice);
    }

    setTimeout(() => {
      // Redirige la navegación del documento a la raíz.
      // El Service Worker (Network-First en navigation) pasará la petición a la red y Cloudflare
      // Access responderá con 302 que el navegador seguirá nativamente sin errores de CORS.
      window.location.href = window.location.origin + '/';
    }, 1200);
  }
}

/* ==========================================================
 * Cliente API REST para Cloudflare D1 (Datos de Negocio)
 * ========================================================== */

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
      redirect: 'manual' // Evita que fetch siga la redirección cross-origin a cloudflareaccess.com y dispare un error CORS
    });
  } catch (fetchErr) {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      notifyAndRedirectSessionExpired();
      throw new Error('Sesión de Cloudflare Access vencida. Redirigiendo a reautenticación...');
    }
    throw fetchErr;
  }

  // Detectar redirección de Cloudflare Access (opaqueredirect status 0 o 302) o estados 401/403
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    notifyAndRedirectSessionExpired();
    throw new Error('Sesión de Cloudflare Zero Trust expirada.');
  }

  if (!response.ok) {
    let errorMsg = `Error HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return await response.json();
}

/**
 * Obtener todos los registros de una entidad desde D1
 */
export async function getAll(storeName) {
  if (storeName === 'insumos') {
    return await apiRequest('/api/insumos');
  }
  if (storeName === 'postres') {
    return await apiRequest('/api/postres');
  }
  if (storeName === 'lotesHorneados') {
    return await apiRequest('/api/lotes');
  }
  if (storeName === 'preferencias') {
    const db = await getLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('preferencias', 'readonly');
      const store = tx.objectStore('preferencias');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  return [];
}

/**
 * Obtener un registro por ID
 */
export async function getById(storeName, id) {
  if (storeName === 'insumos') {
    return await apiRequest(`/api/insumos?id=${encodeURIComponent(id)}`);
  }
  if (storeName === 'postres') {
    return await apiRequest(`/api/postres?id=${encodeURIComponent(id)}`);
  }
  if (storeName === 'gastosGenerales') {
    return await getGlobalIndirects();
  }
  if (storeName === 'preferencias') {
    return await getPreference(id);
  }
  return null;
}

/**
 * Guardar o actualizar registro (Upsert) en D1
 */
export async function putItem(storeName, item) {
  if (storeName === 'insumos') {
    const res = await apiRequest('/api/insumos', {
      method: 'POST',
      body: item
    });
    return res.item || item;
  }
  if (storeName === 'postres') {
    const res = await apiRequest('/api/postres', {
      method: 'POST',
      body: item
    });
    return res.item || item;
  }
  if (storeName === 'gastosGenerales') {
    return await saveGlobalIndirects(item);
  }
  if (storeName === 'preferencias') {
    return await setPreference(item.key, item.value);
  }
  return item;
}

/**
 * Eliminar registro por ID en D1
 */
export async function deleteItem(storeName, id) {
  if (storeName === 'insumos') {
    return await apiRequest(`/api/insumos?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
  if (storeName === 'postres') {
    return await apiRequest(`/api/postres?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
  return true;
}

/**
 * Configuración de Gastos Generales / Empresa (Cloudflare D1)
 */
export async function getGlobalIndirects() {
  return await apiRequest('/api/empresa');
}

export async function saveGlobalIndirects(data) {
  const res = await apiRequest('/api/empresa', {
    method: 'PUT',
    body: data
  });
  return res.item;
}

/**
 * Deducción de inventario por lote de horneado (Transacción atómica en Cloudflare D1)
 */
export async function deductInventoryForBatch(recipe, batchPieces = null, allowNegative = true) {
  return await apiRequest('/api/lotes', {
    method: 'POST',
    body: {
      recipe,
      batchPieces,
      allowNegative
    }
  });
}

/**
 * Sumar stock rápido a un insumo (+1 toque) en Cloudflare D1
 */
export async function addStockToInsumo(insumoId, cantidadAñadida) {
  const res = await apiRequest('/api/insumos', {
    method: 'POST',
    body: {
      action: 'add_stock',
      id: insumoId,
      cantidadAñadida
    }
  });
  return res.item;
}

/**
 * Vaciar datos de negocio en Cloudflare D1 y reiniciar onboarding local
 */
export async function clearAllData() {
  await apiRequest('/api/clear', { method: 'POST' });
  await setPreference('tour_completed', false);
  return true;
}

/**
 * Exportar respaldo completo JSON desde Cloudflare D1 + preferencias locales
 */
export async function exportDatabaseJSON() {
  const d1Backup = await apiRequest('/api/backup');
  const themePref = await getPreference('theme_preference', 'auto');

  return JSON.stringify({
    ...d1Backup,
    preferencias: { theme_preference: themePref }
  }, null, 2);
}

/**
 * Importar respaldo JSON hacia Cloudflare D1 y restaurar preferencias locales
 */
export async function importDatabaseJSON(jsonString) {
  const data = JSON.parse(jsonString);

  await apiRequest('/api/backup', {
    method: 'POST',
    body: data
  });

  if (data.preferencias && data.preferencias.theme_preference) {
    await setPreference('theme_preference', data.preferencias.theme_preference);
  }

  return true;
}
