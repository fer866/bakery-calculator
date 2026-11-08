/**
 * Bakery Calculator - Database Module (v2.1.0-b4k3r3)
 * Reactive IndexedDB abstraction with Promises.
 */

const DB_NAME = 'BakeryCalculatorDB';
const DB_VERSION = 2;

let dbPromise = null;

export function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('insumos')) {
        const storeInsumos = db.createObjectStore('insumos', { keyPath: 'id' });
        storeInsumos.createIndex('nombre', 'nombre', { unique: false });
      }

      if (!db.objectStoreNames.contains('postres')) {
        const storePostres = db.createObjectStore('postres', { keyPath: 'id' });
        storePostres.createIndex('nombre', 'nombre', { unique: false });
      }

      if (!db.objectStoreNames.contains('lotesHorneados')) {
        const storeLotes = db.createObjectStore('lotesHorneados', { keyPath: 'id', autoIncrement: true });
        storeLotes.createIndex('fecha', 'fecha', { unique: false });
        storeLotes.createIndex('postreId', 'postreId', { unique: false });
      }

      if (!db.objectStoreNames.contains('gastosGenerales')) {
        db.createObjectStore('gastosGenerales', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('preferencias')) {
        db.createObjectStore('preferencias', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/* Generic Store Operations */

export async function getAll(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function putItem(storeName, item) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName, id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/* Specific Helper Methods */

export async function getPreference(key, defaultValue = null) {
  const item = await getById('preferencias', key);
  return item ? item.value : defaultValue;
}

export async function setPreference(key, value) {
  return putItem('preferencias', { key, value, updatedAt: Date.now() });
}

export async function getGlobalIndirects() {
  const defaults = {
    id: 'global_indirects',
    gasMinutos: 18,
    costoGasPorMinuto: 0.2667, // ~$4.80 por lote de 18 min
    tarifaHoraManoObra: 80.00,
    tiempoManoObraMin: 45,     // ~$60.00 por lote de 45 min
    empaquePorPieza: 2.00,     // Bolsa + Listón + Sticker por pieza
    otrosIndirectos: 0.00,
    nombreNegocio: ''
  };

  const stored = await getById('gastosGenerales', 'global_indirects');
  return stored ? { ...defaults, ...stored } : defaults;
}

export async function saveGlobalIndirects(data) {
  return putItem('gastosGenerales', {
    id: 'global_indirects',
    ...data,
    updatedAt: Date.now()
  });
}

/**
 * Deduct inventory when baking a batch
 */
export async function deductInventoryForBatch(recipe, batchPieces = null, allowNegative = true) {
  const db = await getDB();
  const tx = db.transaction(['insumos', 'lotesHorneados'], 'readwrite');
  const storeInsumos = tx.objectStore('insumos');
  const storeLotes = tx.objectStore('lotesHorneados');

  const ratio = batchPieces ? (batchPieces / (recipe.piezasPorLote || 1)) : 1;
  const insumosDeducted = [];
  const warnings = [];

  for (const item of (recipe.insumos || [])) {
    const getReq = storeInsumos.get(item.insumoId);
    const insumo = await new Promise((res) => {
      getReq.onsuccess = () => res(getReq.result);
      getReq.onerror = () => res(null);
    });

    if (insumo) {
      const cantidadADescontar = Number(item.cantidad) * ratio;
      const stockAnterior = Number(insumo.stockActual) || 0;
      const nuevoStock = stockAnterior - cantidadADescontar;

      if (nuevoStock < 0) {
        warnings.push(`${insumo.nombre}: Faltaron ${(Math.abs(nuevoStock)).toFixed(1)} ${insumo.unidadPres}`);
      }

      insumo.stockActual = nuevoStock;
      insumo.updatedAt = Date.now();
      storeInsumos.put(insumo);

      insumosDeducted.push({
        id: insumo.id,
        nombre: insumo.nombre,
        descontado: cantidadADescontar,
        stockRestante: nuevoStock,
        unidad: insumo.unidadPres
      });
    }
  }

  // Record batch
  const loteRecord = {
    postreId: recipe.id,
    postreNombre: recipe.nombre,
    fecha: new Date().toISOString(),
    piezasReales: batchPieces || recipe.piezasPorLote,
    costoTotalHistorico: recipe.costoTotalCalculado || 0,
    insumosDescontados: insumosDeducted
  };
  storeLotes.add(loteRecord);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve({ success: true, warnings, insumosDeducted });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Add stock in 1-touch or custom quantity
 */
export async function addStockToInsumo(insumoId, cantidadAñadida) {
  const insumo = await getById('insumos', insumoId);
  if (!insumo) return null;

  insumo.stockActual = (Number(insumo.stockActual) || 0) + Number(cantidadAñadida);
  insumo.updatedAt = Date.now();
  await putItem('insumos', insumo);
  return insumo;
}

/**
 * Initialize default user preferences without any preloaded seed data.
 * The application starts completely blank (from scratch).
 */
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

/**
 * Clear all data in IndexedDB (insumos, postres, lotes, indirects)
 * and reset onboarding state so the user starts fresh.
 */
export async function clearAllData() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['insumos', 'postres', 'lotesHorneados', 'gastosGenerales', 'preferencias'], 'readwrite');
    tx.objectStore('insumos').clear();
    tx.objectStore('postres').clear();
    tx.objectStore('lotesHorneados').clear();
    tx.objectStore('gastosGenerales').clear();
    
    const storePref = tx.objectStore('preferencias');
    storePref.put({ key: 'tour_completed', value: false, updatedAt: Date.now() });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Full JSON export of database
 */
export async function exportDatabaseJSON() {
  const insumos = await getAll('insumos');
  const postres = await getAll('postres');
  const lotes = await getAll('lotesHorneados');
  const indirects = await getGlobalIndirects();
  const themePref = await getPreference('theme_preference', 'auto');

  return JSON.stringify({
    version: '2.1.0',
    exportDate: new Date().toISOString(),
    business: indirects.nombreNegocio || 'Bakery Calculator',
    insumos,
    postres,
    lotesHorneados: lotes,
    gastosGenerales: indirects,
    preferencias: { theme_preference: themePref }
  }, null, 2);
}

/**
 * Full JSON import of database
 */
export async function importDatabaseJSON(jsonString) {
  const data = JSON.parse(jsonString);

  if (Array.isArray(data.insumos)) {
    for (const item of data.insumos) {
      await putItem('insumos', item);
    }
  }

  if (Array.isArray(data.postres)) {
    for (const item of data.postres) {
      await putItem('postres', item);
    }
  }

  if (data.gastosGenerales) {
    await saveGlobalIndirects(data.gastosGenerales);
  }

  if (data.preferencias && data.preferencias.theme_preference) {
    await setPreference('theme_preference', data.preferencias.theme_preference);
  }

  return true;
}


