/**
 * Bakery Calculator - Database Module (v2.1.0-b4k3r1)
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
    nombreNegocio: 'Paulicious Bakery'
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
 * Seed data loader matching Excel and plan specifications exactly.
 */
export async function loadSeedData(forceReset = false) {
  const existingInsumos = await getAll('insumos');
  if (existingInsumos.length > 0 && !forceReset) {
    return false; // Already populated
  }

  const defaultInsumos = [
    {
      id: 'ins-mantequilla',
      nombre: 'Mantequilla sin sal',
      proveedor: "Sam's",
      cantidadPres: 1080,
      unidadPres: 'g',
      precioPres: 256.77,
      stockActual: 2160,
      stockMinimo: 400,
      updatedAt: Date.now()
    },
    {
      id: 'ins-azucar-mascabada',
      nombre: 'Azúcar mascabada',
      proveedor: "Sam's",
      cantidadPres: 2000,
      unidadPres: 'g',
      precioPres: 69.56,
      stockActual: 2000,
      stockMinimo: 300,
      updatedAt: Date.now()
    },
    {
      id: 'ins-azucar-refinada',
      nombre: 'Azúcar refinada',
      proveedor: "Sam's",
      cantidadPres: 4000,
      unidadPres: 'g',
      precioPres: 102.30,
      stockActual: 4000,
      stockMinimo: 300,
      updatedAt: Date.now()
    },
    {
      id: 'ins-huevos',
      nombre: 'Huevos frescos',
      proveedor: "Sam's",
      cantidadPres: 1500, // Matching 1500g in Excel sheet CHISPAS ($0.0927/2pzas) / 30 pzas in M&M's
      unidadPres: 'g',
      precioPres: 69.56,
      stockActual: 1500,
      stockMinimo: 200,
      piezasPorPresentacion: 30,
      updatedAt: Date.now()
    },
    {
      id: 'ins-vainilla',
      nombre: 'Extracto de vainilla',
      proveedor: 'La Mimi',
      cantidadPres: 1000,
      unidadPres: 'ml',
      precioPres: 100.00,
      stockActual: 1000,
      stockMinimo: 100,
      updatedAt: Date.now()
    },
    {
      id: 'ins-harina',
      nombre: 'Harina (todo uso)',
      proveedor: 'Costco',
      cantidadPres: 4000,
      unidadPres: 'g',
      precioPres: 129.00,
      stockActual: 4000,
      stockMinimo: 500,
      updatedAt: Date.now()
    },
    {
      id: 'ins-sal',
      nombre: 'Sal fina',
      proveedor: 'Walmart',
      cantidadPres: 750,
      unidadPres: 'g',
      precioPres: 21.00,
      stockActual: 750,
      stockMinimo: 100,
      updatedAt: Date.now()
    },
    {
      id: 'ins-bicarbonato',
      nombre: 'Bicarbonato de sodio',
      proveedor: 'Walmart',
      cantidadPres: 227,
      unidadPres: 'g',
      precioPres: 25.00,
      stockActual: 227,
      stockMinimo: 50,
      updatedAt: Date.now()
    },
    {
      id: 'ins-fecula',
      nombre: 'Fécula de maíz (Maizena)',
      proveedor: 'Walmart',
      cantidadPres: 750,
      unidadPres: 'g',
      precioPres: 96.00,
      stockActual: 750,
      stockMinimo: 100,
      updatedAt: Date.now()
    },
    {
      id: 'ins-chips-semiamargo',
      nombre: 'Chips chocolate semiamargo',
      proveedor: 'Central',
      cantidadPres: 500,
      unidadPres: 'g',
      precioPres: 100.00,
      stockActual: 150, // Stock crítico intencional para demostrar T-05
      stockMinimo: 300,
      updatedAt: Date.now()
    },
    {
      id: 'ins-myms-mini',
      nombre: "M&M's (mini)",
      proveedor: 'Central',
      cantidadPres: 2000,
      unidadPres: 'g',
      precioPres: 763.20,
      stockActual: 600,
      stockMinimo: 350,
      updatedAt: Date.now()
    }
  ];

  // Specific insumos for CHISPAS: Raw ingredients sum $134.65 ($8.42/unit)
  const defaultRecipes = [
    {
      id: 'rec-chispas',
      nombre: 'Galletas Chispas de Chocolate (80g)',
      piezasPorLote: 16,
      pesoPieza: 80,
      precioVenta: 28.50,
      mermaPct: 0,
      indirectos: {
        gasMinutos: 18,
        costoGasPorMinuto: 0.2667,
        tarifaHoraManoObra: 80.00,
        tiempoManoObraMin: 45,
        empaquePorPieza: 2.00,
        otrosIndirectos: 0.00
      },
      insumos: [
        { insumoId: 'ins-mantequilla', nombre: 'Mantequilla', cantidad: 200, unidad: 'g' },
        { insumoId: 'ins-azucar-mascabada', nombre: 'Azúcar mascabada', cantidad: 160, unidad: 'g' },
        { insumoId: 'ins-azucar-refinada', nombre: 'Azúcar refinada', cantidad: 70, unidad: 'g' },
        { insumoId: 'ins-huevos', nombre: 'Huevos', cantidad: 2, unidad: 'g' }, // 2g or ~0.0927 in Excel formula
        { insumoId: 'ins-vainilla', nombre: 'Vainilla', cantidad: 10, unidad: 'ml' },
        { insumoId: 'ins-harina', nombre: 'Harina (todo uso)', cantidad: 420, unidad: 'g' },
        { insumoId: 'ins-sal', nombre: 'Sal', cantidad: 2, unidad: 'g' },
        { insumoId: 'ins-bicarbonato', nombre: 'Bicarbonato', cantidad: 4, unidad: 'g' },
        { insumoId: 'ins-fecula', nombre: 'Fécula de maíz', cantidad: 36, unidad: 'g' },
        { insumoId: 'ins-chips-semiamargo', nombre: 'Chips chocolate semiamargo', cantidad: 300, unidad: 'g' }
      ],
      updatedAt: Date.now()
    },
    {
      id: 'rec-myms',
      nombre: "Galletas M&M's Mini (80g)",
      piezasPorLote: 16,
      pesoPieza: 80,
      precioVenta: 32.00,
      mermaPct: 0,
      indirectos: {
        gasMinutos: 18,
        costoGasPorMinuto: 0.2667,
        tarifaHoraManoObra: 80.00,
        tiempoManoObraMin: 45,
        empaquePorPieza: 2.00,
        otrosIndirectos: 0.00
      },
      insumos: [
        { insumoId: 'ins-mantequilla', nombre: 'Mantequilla', cantidad: 200, unidad: 'g' },
        { insumoId: 'ins-azucar-mascabada', nombre: 'Azúcar mascabada', cantidad: 160, unidad: 'g' },
        { insumoId: 'ins-azucar-refinada', nombre: 'Azúcar refinada', cantidad: 70, unidad: 'g' },
        { insumoId: 'ins-huevos', nombre: 'Huevos', cantidad: 100, unidad: 'g' }, // 2 eggs ~ 100g = $4.64
        { insumoId: 'ins-vainilla', nombre: 'Vainilla', cantidad: 10, unidad: 'ml' },
        { insumoId: 'ins-harina', nombre: 'Harina (todo uso)', cantidad: 420, unidad: 'g' },
        { insumoId: 'ins-sal', nombre: 'Sal', cantidad: 2, unidad: 'g' },
        { insumoId: 'ins-bicarbonato', nombre: 'Bicarbonato', cantidad: 4, unidad: 'g' },
        { insumoId: 'ins-fecula', nombre: 'Fécula de maíz', cantidad: 36, unidad: 'g' },
        { insumoId: 'ins-myms-mini', nombre: "M&M's (mini)", cantidad: 300, unidad: 'g' }
      ],
      updatedAt: Date.now()
    }
  ];

  for (const ins of defaultInsumos) {
    await putItem('insumos', ins);
  }

  for (const rec of defaultRecipes) {
    await putItem('postres', rec);
  }

  await saveGlobalIndirects({
    nombreNegocio: 'Paulicious Bakery',
    gasMinutos: 18,
    costoGasPorMinuto: 0.2667,
    tarifaHoraManoObra: 80.00,
    tiempoManoObraMin: 45,
    empaquePorPieza: 2.00,
    otrosIndirectos: 0.00
  });

  await setPreference('theme_preference', 'auto');
  await setPreference('tour_completed', false);

  return true;
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
    business: 'Paulicious Bakery',
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
