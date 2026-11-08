/**
 * Bakery Calculator - UI Module (v2.1.0-b4k3r3)
 * Component rendering, reactive DOM diffing, toasts and native dialogs.
 */

import {
  computeRecipeFinancials,
  formatCurrencyMXN,
  formatPercent
} from './engine.b4k3r3.js';

/* Toast Notification Manager */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const icon = type === 'success' ? '✅' : (type === 'danger' ? '⚠️' : (type === 'warning' ? '🔔' : 'ℹ️'));
  toast.innerHTML = `
    <span><strong>${icon}</strong> ${message}</span>
    <button type="button" class="icon-btn" style="width:24px;height:24px;font-size:0.75rem;margin-left:8px;" aria-label="Cerrar">✕</button>
  `;

  const closeBtn = toast.querySelector('button');
  closeBtn.addEventListener('click', () => toast.remove());

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

/* Modal Helper */
export function openConfirmDialog(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('native-confirm-dialog');
    const titleEl = document.getElementById('confirm-dialog-title');
    const bodyEl = document.getElementById('confirm-dialog-body');
    const confirmBtn = document.getElementById('confirm-dialog-ok');
    const cancelBtn = document.getElementById('confirm-dialog-cancel');

    titleEl.textContent = title;
    bodyEl.innerHTML = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    const cleanup = () => {
      confirmBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
    };

    const onOk = () => {
      cleanup();
      dialog.close();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      dialog.close();
      resolve(false);
    };

    confirmBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);

    dialog.showModal();
  });
}

/* Radial Progress KPI Renderer */
export function updateRadialKPI(financials) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius; // ~402.12

  const marginValEl = document.getElementById('hero-margin-value');
  const unitCostEl = document.getElementById('hero-unit-cost');
  const salePriceEl = document.getElementById('hero-sale-price');
  const circleProfit = document.getElementById('radial-circle-profit');

  if (marginValEl) {
    marginValEl.textContent = formatPercent(financials.margenPct);
    if (financials.margenPct >= 50) {
      marginValEl.style.color = 'var(--success)';
    } else if (financials.margenPct >= 30) {
      marginValEl.style.color = 'var(--gold)';
    } else {
      marginValEl.style.color = 'var(--danger)';
    }
  }

  if (unitCostEl) unitCostEl.textContent = formatCurrencyMXN(financials.costoUnitarioPieza);
  if (salePriceEl) salePriceEl.textContent = formatCurrencyMXN(financials.precioVenta);

  if (circleProfit) {
    circleProfit.style.strokeDasharray = `${circumference}`;
    const clampedPct = Math.min(100, Math.max(0, financials.margenPct));
    const offset = circumference - (clampedPct / 100) * circumference;
    circleProfit.style.strokeDashoffset = `${offset}`;
  }
}

/* ROI Narrative Card Renderer */
export function updateROICard(financials) {
  const roiValEl = document.getElementById('roi-value-display');
  const batchCostEl = document.getElementById('roi-batch-cost');
  const batchRevenueEl = document.getElementById('roi-batch-revenue');
  const batchProfitEl = document.getElementById('roi-batch-profit');
  const beProgressEl = document.getElementById('roi-break-even-progress');
  const narrativeEl = document.getElementById('roi-narrative-text');

  if (roiValEl) roiValEl.textContent = formatPercent(financials.roiPct);
  if (batchCostEl) batchCostEl.textContent = formatCurrencyMXN(financials.costoTotalLote);
  if (batchRevenueEl) batchRevenueEl.textContent = formatCurrencyMXN(financials.ventaTotalLote);
  if (batchProfitEl) batchProfitEl.textContent = formatCurrencyMXN(financials.utilidadLote);

  const beRatio = (financials.puntoEquilibrio / financials.piezasPorLote) * 100;
  if (beProgressEl) {
    beProgressEl.style.width = `${Math.min(100, Math.max(5, beRatio))}%`;
  }

  if (narrativeEl) {
    narrativeEl.innerHTML = `
      Vende <span class="narrative-highlight">${financials.puntoEquilibrio}</span> de <span class="narrative-highlight">${financials.piezasPorLote}</span> piezas para recuperar tu inversión (<span class="narrative-highlight">${formatCurrencyMXN(financials.costoTotalLote)}</span>).
      Las <span class="narrative-highlight">${financials.piezasGanancia}</span> piezas restantes generan <span class="narrative-highlight">${formatCurrencyMXN(financials.utilidadLote)}</span> de ganancia neta.
    `;
  }
}

/* Simulator Controls Sync */
export function updateSimulatorControls(financials) {
  const simPriceInput = document.getElementById('sim-sale-price-input');
  const simSlider = document.getElementById('sim-sale-price-slider');
  const simProfitDisplay = document.getElementById('sim-unit-profit');

  if (simPriceInput && document.activeElement !== simPriceInput) {
    simPriceInput.value = financials.precioVenta.toFixed(2);
  }
  if (simSlider && document.activeElement !== simSlider) {
    simSlider.value = financials.precioVenta.toFixed(2);
  }
  if (simProfitDisplay) {
    simProfitDisplay.textContent = `${formatCurrencyMXN(financials.gananciaPorPieza)} / pza`;
  }

  const bakeCtaBtn = document.getElementById('btn-bake-cta');
  if (bakeCtaBtn) {
    bakeCtaBtn.disabled = false;
    bakeCtaBtn.style.opacity = '1';
    bakeCtaBtn.innerHTML = `<span>👨‍🍳</span> Hornear 1 Lote (${financials.piezasPorLote} pzas)`;
  }
}

/* Empty State Renderer for Dashboard */
export function renderDashboardEmptyState() {
  const marginValEl = document.getElementById('hero-margin-value');
  const unitCostEl = document.getElementById('hero-unit-cost');
  const salePriceEl = document.getElementById('hero-sale-price');
  const circleProfit = document.getElementById('radial-circle-profit');
  const roiValEl = document.getElementById('roi-value-display');
  const batchCostEl = document.getElementById('roi-batch-cost');
  const batchRevenueEl = document.getElementById('roi-batch-revenue');
  const beProgressEl = document.getElementById('roi-break-even-progress');
  const narrativeEl = document.getElementById('roi-narrative-text');
  const simProfitDisplay = document.getElementById('sim-unit-profit');
  const simPriceInput = document.getElementById('sim-sale-price-input');
  const simSlider = document.getElementById('sim-sale-price-slider');
  const bakeCtaBtn = document.getElementById('btn-bake-cta');

  if (marginValEl) {
    marginValEl.textContent = '0%';
    marginValEl.style.color = 'var(--text-muted)';
  }
  if (unitCostEl) unitCostEl.textContent = '$0.00';
  if (salePriceEl) salePriceEl.textContent = '$0.00';
  if (circleProfit) {
    circleProfit.style.strokeDasharray = '402.12';
    circleProfit.style.strokeDashoffset = '402.12';
  }

  if (roiValEl) roiValEl.textContent = '0%';
  if (batchCostEl) batchCostEl.textContent = '$0.00';
  if (batchRevenueEl) batchRevenueEl.textContent = '$0.00';
  if (beProgressEl) beProgressEl.style.width = '0%';

  if (narrativeEl) {
    narrativeEl.innerHTML = `
      Aún no tienes recetas registradas. Sigue el <strong>Tour de Inicio</strong> o pulsa en <strong>Recetas</strong> para agregar tu primera creación.
    `;
  }

  if (simPriceInput) simPriceInput.value = '0.00';
  if (simSlider) simSlider.value = '0.00';
  if (simProfitDisplay) simProfitDisplay.textContent = '$0.00 / pza';

  if (bakeCtaBtn) {
    bakeCtaBtn.innerHTML = `<span>👨‍🍳</span> Sin Receta Activa`;
    bakeCtaBtn.disabled = true;
    bakeCtaBtn.style.opacity = '0.6';
  }
}

/* Insumos List Renderer */
export function renderInsumosList(insumos = []) {
  const container = document.getElementById('insumos-cards-list');
  const countEl = document.getElementById('insumos-count-badge');
  if (!container) return;

  if (countEl) countEl.textContent = `${insumos.length} insumos`;

  if (insumos.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 24px;">
        <p>No hay insumos registrados aún.</p>
        <p style="font-size:0.8rem; margin-top:6px;">Usa la barra superior para agregar tu primer ingrediente.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = insumos.map(ins => {
    const isCritical = ins.stockActual <= (ins.stockMinimo || 0);
    const isNegative = ins.stockActual < 0;
    const unitPrice = ins.cantidadPres > 0 ? (ins.precioPres / ins.cantidadPres) : 0;

    let badgeHtml = '';
    if (isNegative) {
      badgeHtml = `<span class="badge badge-danger">STOCK NEGATIVO (${ins.stockActual.toFixed(1)} ${ins.unidadPres})</span>`;
    } else if (isCritical) {
      badgeHtml = `<span class="badge badge-warning">⚠ STOCK BAJO (${ins.stockActual.toFixed(1)} ${ins.unidadPres})</span>`;
    } else {
      badgeHtml = `<span class="badge badge-success">✓ Stock: ${ins.stockActual.toFixed(1)} ${ins.unidadPres}</span>`;
    }

    return `
      <div class="item-card" data-insumo-id="${ins.id}">
        <div class="item-card-header">
          <div>
            <div class="item-title">${escapeHTML(ins.nombre)}</div>
            <div class="item-subtitle">${escapeHTML(ins.proveedor || 'Sin proveedor')} • Presentación: ${ins.cantidadPres} ${ins.unidadPres} por ${formatCurrencyMXN(ins.precioPres)} ($${unitPrice.toFixed(4)}/${ins.unidadPres})</div>
          </div>
          <div class="item-badges">
            ${badgeHtml}
          </div>
        </div>
        <div class="item-card-actions">
          <button type="button" class="btn-one-touch btn-add-stock-fast" data-id="${ins.id}" data-amount="${ins.cantidadPres}" title="Añadir una presentación completa">
            <span>+</span> Compré 1 paquete (${ins.cantidadPres} ${ins.unidadPres})
          </button>
          <div style="display:flex; gap:4px;">
            <button type="button" class="icon-btn btn-edit-insumo" data-id="${ins.id}" style="width:30px;height:30px;font-size:0.85rem;" title="Editar">✏</button>
            <button type="button" class="icon-btn btn-delete-insumo" data-id="${ins.id}" style="width:30px;height:30px;font-size:0.85rem;" title="Eliminar">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* Recipes List Renderer */
export function renderRecipesList(recipes = [], allInsumosMap = {}, globalIndirects = {}) {
  const container = document.getElementById('recipes-cards-list');
  const selectPicker = document.getElementById('hero-recipe-select');
  if (!container) return;

  // Sync hero dropdown
  if (selectPicker) {
    if (recipes.length === 0) {
      selectPicker.innerHTML = `<option value="">(Sin recetas registradas)</option>`;
      selectPicker.disabled = true;
    } else {
      selectPicker.disabled = false;
      const currentVal = selectPicker.value;
      selectPicker.innerHTML = recipes.map(r => `
        <option value="${r.id}" ${r.id === currentVal ? 'selected' : ''}>🍪 ${escapeHTML(r.nombre)} (${r.piezasPorLote} pzas)</option>
      `).join('');
      if (!recipes.some(r => r.id === currentVal) && recipes.length > 0) {
        selectPicker.value = recipes[0].id;
      }
    }
  }

  if (recipes.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--text-muted); padding: 24px;">
        <p>No hay recetas creadas.</p>
        <p style="font-size:0.8rem; margin-top:6px;">Usa el botón "+ Nueva Receta" para crear la primera.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recipes.map(rec => {
    const financials = computeRecipeFinancials(rec, allInsumosMap, globalIndirects);
    const isProfitable = financials.margenPct >= 50;

    return `
      <div class="item-card" data-recipe-id="${rec.id}">
        <div class="item-card-header">
          <div>
            <div class="item-title">🍪 ${escapeHTML(rec.nombre)}</div>
            <div class="item-subtitle">${rec.piezasPorLote} piezas (${rec.pesoPieza || 80}g c/u) • Costo: ${formatCurrencyMXN(financials.costoUnitarioPieza)} • Venta: ${formatCurrencyMXN(financials.precioVenta)}</div>
          </div>
          <div class="item-badges">
            <span class="badge ${isProfitable ? 'badge-success' : 'badge-warning'}">
              Margen: ${formatPercent(financials.margenPct)}
            </span>
          </div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Ingredientes (${rec.insumos ? rec.insumos.length : 0}): ${formatCurrencyMXN(financials.costoIngredientes)} | Indirectos: ${formatCurrencyMXN(financials.costoIndirectoLote)}
          ${rec.mermaPct > 0 ? `| Merma: ${rec.mermaPct}%` : ''}
        </div>
        <div class="item-card-actions">
          <button type="button" class="btn-primary btn-bake-recipe-direct" data-id="${rec.id}" style="padding:4px 10px; font-size:0.8rem;">
            ⚡ Hornear
          </button>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-secondary btn-duplicate-recipe" data-id="${rec.id}" style="padding:4px 8px; font-size:0.8rem;">📋 Duplicar</button>
            <button type="button" class="icon-btn btn-edit-recipe" data-id="${rec.id}" style="width:30px;height:30px;font-size:0.85rem;" title="Editar">✏</button>
            <button type="button" class="icon-btn btn-delete-recipe" data-id="${rec.id}" style="width:30px;height:30px;font-size:0.85rem;" title="Eliminar">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* Helper to escape HTML */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


