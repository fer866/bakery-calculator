/**
 * Bakery Calculator - Database Client Module (v2.2.0-b4k3r4)
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

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

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
