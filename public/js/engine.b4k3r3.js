/**
 * Bakery Calculator - Engine Module (v2.1.0-b4k3r3)
 * Mathematical costing engine, ROI, break-even and unit conversion.
 */

export const UNIT_CONVERSIONS = {
  // Base: grams
  g: { base: 'g', factor: 1, label: 'gramos' },
  gramos: { base: 'g', factor: 1, label: 'gramos' },
  gr: { base: 'g', factor: 1, label: 'gramos' },
  kg: { base: 'g', factor: 1000, label: 'kilogramos' },
  kilos: { base: 'g', factor: 1000, label: 'kilogramos' },

  // Base: milliliters
  ml: { base: 'ml', factor: 1, label: 'mililitros' },
  mililitros: { base: 'ml', factor: 1, label: 'mililitros' },
  l: { base: 'ml', factor: 1000, label: 'litros' },
  litros: { base: 'ml', factor: 1000, label: 'litros' },

  // Base: pieces
  pza: { base: 'pza', factor: 1, label: 'piezas' },
  pzas: { base: 'pza', factor: 1, label: 'piezas' },
  piezas: { base: 'pza', factor: 1, label: 'piezas' }
};

export function normalizeUnit(unitStr) {
  if (!unitStr) return 'g';
  const clean = String(unitStr).toLowerCase().trim();
  return UNIT_CONVERSIONS[clean] ? clean : 'g';
}

/**
 * Calculates unitary cost of an ingredient item in the recipe.
 */
export function calculateIngredientCost(insumo, cantidadReceta, unidadReceta = null) {
  if (!insumo || !insumo.precioPres || !insumo.cantidadPres) return 0;

  const presUnitKey = normalizeUnit(insumo.unidadPres);
  const recUnitKey = normalizeUnit(unidadReceta || insumo.unidadPres);

  const presUnit = UNIT_CONVERSIONS[presUnitKey];
  const recUnit = UNIT_CONVERSIONS[recUnitKey];

  const presInBase = insumo.cantidadPres * (presUnit ? presUnit.factor : 1);
  const recInBase = cantidadReceta * (recUnit ? recUnit.factor : 1);

  if (presInBase <= 0) return 0;

  // Handle case where base units match
  if (presUnit && recUnit && presUnit.base === recUnit.base) {
    const costPerBase = insumo.precioPres / presInBase;
    return costPerBase * recInBase;
  }

  // Fallback for direct unit ratio (e.g. piece or custom)
  const directUnitCost = insumo.precioPres / insumo.cantidadPres;
  return directUnitCost * cantidadReceta;
}

/**
 * Formats currency in MXN ($#,##0.00)
 */
export function formatCurrencyMXN(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Formats percentage (#0.0%)
 */
export function formatPercent(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(1)}%`;
}

/**
 * Complete batch and unit financial calculation
 */
export function computeRecipeFinancials(recipe, allInsumosMap = {}, globalIndirects = {}) {
  const piezasPorLote = Math.max(1, Number(recipe.piezasPorLote) || 16);
  const precioVenta = Math.max(0.01, Number(recipe.precioVenta) || 28.50);
  const mermaPct = Math.max(0, Number(recipe.mermaPct !== undefined ? recipe.mermaPct : 0));
  const mermaFactor = 1 + (mermaPct / 100);

  // 1. Ingredients Cost
  let rawIngredientsCost = 0;
  const ingredientsDetail = (recipe.insumos || []).map(item => {
    const insumoRef = allInsumosMap[item.insumoId];
    let unitCost = 0;
    let cost = 0;
    let name = item.nombre || (insumoRef ? insumoRef.nombre : 'Insumo');
    let unidad = item.unidad || (insumoRef ? insumoRef.unidadPres : 'g');
    let cantidad = Number(item.cantidad) || 0;

    if (insumoRef) {
      cost = calculateIngredientCost(insumoRef, cantidad, unidad);
      unitCost = insumoRef.cantidadPres > 0 ? (insumoRef.precioPres / insumoRef.cantidadPres) : 0;
    } else if (item.costoCalculado) {
      cost = Number(item.costoCalculado) || 0;
    }

    rawIngredientsCost += cost;

    return {
      insumoId: item.insumoId,
      nombre: name,
      cantidad,
      unidad,
      costo: cost,
      insumoRef
    };
  });

  const costoIngredientes = rawIngredientsCost * mermaFactor;

  // 2. Indirect Costs
  // Priority: recipe overrides -> globalIndirects defaults
  const ind = recipe.indirectos || {};
  const gasMinutos = Number(ind.gasMinutos ?? globalIndirects.gasMinutos ?? 18);
  const costoGasPorMinuto = Number(ind.costoGasPorMinuto ?? globalIndirects.costoGasPorMinuto ?? 0.2667); // ~$4.80 for 18 min
  const gasTotal = gasMinutos * costoGasPorMinuto;

  const tarifaHoraManoObra = Number(ind.tarifaHoraManoObra ?? globalIndirects.tarifaHoraManoObra ?? 80.00);
  const tiempoManoObraMin = Number(ind.tiempoManoObraMin ?? globalIndirects.tiempoManoObraMin ?? 45);
  const manoObraTotal = (tiempoManoObraMin / 60) * tarifaHoraManoObra;

  const empaquePorPieza = Number(ind.empaquePorPieza ?? globalIndirects.empaquePorPieza ?? 2.00);
  const empaqueTotal = empaquePorPieza * piezasPorLote;

  const otrosIndirectos = Number(ind.otrosIndirectos ?? globalIndirects.otrosIndirectos ?? 0);

  const costoIndirectoLote = gasTotal + manoObraTotal + empaqueTotal + otrosIndirectos;

  // 3. Totals and Unitary Costs
  const costoTotalLote = costoIngredientes + costoIndirectoLote;
  const costoUnitarioPieza = costoTotalLote / piezasPorLote;
  const costoSoloIngredientesPieza = costoIngredientes / piezasPorLote;
  const costoSoloIndirectosPieza = costoIndirectoLote / piezasPorLote;

  // 4. Margins, ROI and Break-Even
  const ventaTotalLote = piezasPorLote * precioVenta;
  const utilidadLote = ventaTotalLote - costoTotalLote;
  const gananciaPorPieza = precioVenta - costoUnitarioPieza;
  const margenPct = precioVenta > 0 ? ((precioVenta - costoUnitarioPieza) / precioVenta) * 100 : 0;
  const roiPct = costoTotalLote > 0 ? (utilidadLote / costoTotalLote) * 100 : 0;

  const puntoEquilibrio = precioVenta > 0 ? Math.min(piezasPorLote, Math.ceil(costoTotalLote / precioVenta)) : piezasPorLote;
  const piezasGanancia = Math.max(0, piezasPorLote - puntoEquilibrio);

  // Ratio for radial progress
  const costRatioPct = precioVenta > 0 ? Math.min(100, Math.max(0, (costoUnitarioPieza / precioVenta) * 100)) : 100;
  const profitRatioPct = Math.max(0, 100 - costRatioPct);

  return {
    piezasPorLote,
    precioVenta,
    mermaPct,
    mermaFactor,
    rawIngredientsCost,
    costoIngredientes,
    ingredientsDetail,
    indirectos: {
      gasMinutos,
      costoGasPorMinuto,
      gasTotal,
      tarifaHoraManoObra,
      tiempoManoObraMin,
      manoObraTotal,
      empaquePorPieza,
      empaqueTotal,
      otrosIndirectos,
      total: costoIndirectoLote
    },
    costoIndirectoLote,
    costoTotalLote,
    costoUnitarioPieza,
    costoSoloIngredientesPieza,
    costoSoloIndirectosPieza,
    ventaTotalLote,
    utilidadLote,
    gananciaPorPieza,
    margenPct,
    roiPct,
    puntoEquilibrio,
    piezasGanancia,
    costRatioPct,
    profitRatioPct
  };
}


