/**
 * Bakery Calculator - App Controller & Router (v2.1.0-b4k3r4)
 * Decoupled event delegation, route orchestrator and silent SW updater.
 */

import {
  getAll,
  getById,
  putItem,
  deleteItem,
  getGlobalIndirects,
  saveGlobalIndirects,
  deductInventoryForBatch,
  addStockToInsumo,
  initDatabaseDefaults,
  clearAllData,
  exportDatabaseJSON,
  importDatabaseJSON
} from './db.b4k3r4.js';

import {
  computeRecipeFinancials,
  formatCurrencyMXN
} from './engine.b4k3r4.js';

import {
  initTheme,
  applyTheme
} from './theme.b4k3r4.js';

import {
  startTour,
  resetTour,
  shouldShowTour
} from './tour.b4k3r4.js';

import {
  showToast,
  openConfirmDialog,
  updateRadialKPI,
  updateROICard,
  updateSimulatorControls,
  renderInsumosList,
  renderRecipesList,
  renderDashboardEmptyState,
  escapeHTML
} from './ui.b4k3r4.js';

/* App Global State */
const state = {
  activeView: 'tab-inicio',
  activeRecipeId: null,
  insumos: [],
  recipes: [],
  globalIndirects: {},
  insumosMap: {},
  wizardSelectedInsumos: []
};

/* Service Worker Silent Updater on Route/Tab change */
export function triggerSilentSWUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.update();
      })
      .catch(() => {});
  }
}

/* Tab Switcher / Router */
export function switchView(targetTabId) {
  state.activeView = targetTabId;

  // Update views
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === targetTabId);
  });

  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === targetTabId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Silent SW update on navigation
  triggerSilentSWUpdate();
}

/* Data Loaders and State Synchronizers */
export async function refreshAllData() {
  try {
    state.insumos = await getAll('insumos');
    state.recipes = await getAll('postres');
    state.globalIndirects = await getGlobalIndirects();
  } catch (err) {
    console.error('Error al sincronizar datos con Cloudflare D1:', err);
    showToast('Error al conectar con Cloudflare D1: ' + err.message, 'danger', 6000);
    state.insumos = state.insumos || [];
    state.recipes = state.recipes || [];
    state.globalIndirects = state.globalIndirects || {};
  }

  state.insumosMap = {};
  for (const ins of state.insumos) {
    state.insumosMap[ins.id] = ins;
  }

  // Ensure an active recipe is selected
  if (!state.activeRecipeId && state.recipes.length > 0) {
    state.activeRecipeId = state.recipes[0].id;
  } else if (!state.recipes.some(r => r.id === state.activeRecipeId) && state.recipes.length > 0) {
    state.activeRecipeId = state.recipes[0].id;
  }

  renderInsumosList(state.insumos);
  renderRecipesList(state.recipes, state.insumosMap, state.globalIndirects);
  renderRecipeWizardChips();
  renderGastosForm();
  updateDashboard();
}

/* Update Dashboard KPIs based on active recipe */
export function updateDashboard() {
  const activeRecipe = state.recipes.find(r => r.id === state.activeRecipeId);
  if (!activeRecipe) {
    renderDashboardEmptyState();
    return;
  }

  const financials = computeRecipeFinancials(activeRecipe, state.insumosMap, state.globalIndirects);
  updateRadialKPI(financials);
  updateROICard(financials);
  updateSimulatorControls(financials);
}

/* Render Gastos Form */
function renderGastosForm() {
  const g = state.globalIndirects;
  const gasMin = document.getElementById('gastos-gas-minutos');
  const gasCosto = document.getElementById('gastos-gas-costo-min');
  const gasTotalDisp = document.getElementById('gastos-gas-total-display');

  const moTarifa = document.getElementById('gastos-mo-tarifa');
  const moTiempo = document.getElementById('gastos-mo-tiempo');
  const moTotalDisp = document.getElementById('gastos-mo-total-display');

  const empPieza = document.getElementById('gastos-empaque-pieza');
  const negocioNombre = document.getElementById('settings-negocio-nombre');

  if (gasMin) gasMin.value = g.gasMinutos || 18;
  if (gasCosto) gasCosto.value = g.costoGasPorMinuto || 0.2667;
  if (gasTotalDisp) {
    const totGas = (Number(g.gasMinutos) || 18) * (Number(g.costoGasPorMinuto) || 0.2667);
    gasTotalDisp.textContent = `Costo calculado: ${formatCurrencyMXN(totGas)} por lote`;
  }

  if (moTarifa) moTarifa.value = g.tarifaHoraManoObra || 80.00;
  if (moTiempo) moTiempo.value = g.tiempoManoObraMin || 45;
  if (moTotalDisp) {
    const totMo = ((Number(g.tiempoManoObraMin) || 45) / 60) * (Number(g.tarifaHoraManoObra) || 80);
    moTotalDisp.textContent = `Costo por lote: ${formatCurrencyMXN(totMo)}`;
  }

  if (empPieza) empPieza.value = g.empaquePorPieza || 2.00;
  if (negocioNombre) negocioNombre.value = g.nombreNegocio || '';

  const brandTitle = document.getElementById('header-brand-title');
  if (brandTitle) {
    brandTitle.textContent = g.nombreNegocio || 'Bakery Calculator';
  }
}

/* Render Chips in Recipe Creation Wizard */
function renderRecipeWizardChips() {
  const chipsContainer = document.getElementById('recipe-wizard-chips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = state.insumos.map(ins => `
    <button type="button" class="chip-btn" data-insumo-id="${ins.id}" data-insumo-name="${escapeHTML(ins.nombre)}" data-insumo-unit="${ins.unidadPres}">
      + ${escapeHTML(ins.nombre)}
    </button>
  `).join('');
}

/* Render Wizard Selected Ingredients Table */
function renderWizardSelectedItems() {
  const container = document.getElementById('wizard-selected-items-list');
  if (!container) return;

  if (state.wizardSelectedInsumos.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">Toca los botones arriba para sumar ingredientes a esta receta.</p>`;
    return;
  }

  container.innerHTML = state.wizardSelectedInsumos.map((item, index) => {
    const insRef = state.insumosMap[item.insumoId];
    const unitPrice = insRef && insRef.cantidadPres > 0 ? (insRef.precioPres / insRef.cantidadPres) : 0;
    const estCost = unitPrice * (Number(item.cantidad) || 0);

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <span style="font-size:0.85rem; font-weight:600;">• ${escapeHTML(item.nombre)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${formatCurrencyMXN(estCost)})</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" step="any" min="0.01" class="input-ctrl wizard-item-qty" data-index="${index}" value="${item.cantidad}" style="width:75px; padding:4px 6px;" placeholder="Cant">
          <span style="font-size:0.8rem; color:var(--text-muted);">${item.unidad}</span>
          <button type="button" class="icon-btn btn-remove-wizard-item" data-index="${index}" style="width:26px;height:26px;font-size:0.75rem;color:var(--danger);" title="Quitar">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/* Global Event Listeners Setup */
function setupEventListeners() {
  // 1. Navigation / Router
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-view');
      switchView(target);
    });
  });

  // Settings button in header
  const headerSettingsBtn = document.getElementById('btn-header-settings');
  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => switchView('tab-ajustes'));
  }

  // Theme quick toggle in header
  const headerThemeToggleBtn = document.getElementById('btn-header-theme-toggle');
  if (headerThemeToggleBtn) {
    headerThemeToggleBtn.addEventListener('click', () => {
      const radios = Array.from(document.querySelectorAll('input[name="theme-choice"]'));
      const activeIdx = radios.findIndex(r => r.checked);
      const nextIdx = (activeIdx + 1) % radios.length;
      radios[nextIdx].checked = true;
      applyTheme(radios[nextIdx].value, true);
      showToast(`Tema cambiado a: ${radios[nextIdx].value}`, 'info', 2000);
    });
  }

  // 2. Hero Recipe Dropdown Picker
  const recipeSelect = document.getElementById('hero-recipe-select');
  if (recipeSelect) {
    recipeSelect.addEventListener('change', (e) => {
      state.activeRecipeId = e.target.value;
      updateDashboard();
    });
  }

  // 3. Simulator Controls
  const simPriceInput = document.getElementById('sim-sale-price-input');
  const simSlider = document.getElementById('sim-sale-price-slider');

  function handleSimPriceChange(newVal) {
    const num = Math.max(0.01, Number(newVal) || 0);
    const activeRecipe = state.recipes.find(r => r.id === state.activeRecipeId);
    if (activeRecipe) {
      activeRecipe.precioVenta = num;
      putItem('postres', activeRecipe).catch(() => {});
      updateDashboard();
    }
  }

  if (simPriceInput) {
    simPriceInput.addEventListener('input', (e) => {
      handleSimPriceChange(e.target.value);
      if (simSlider) simSlider.value = e.target.value;
    });
  }

  if (simSlider) {
    simSlider.addEventListener('input', (e) => {
      handleSimPriceChange(e.target.value);
      if (simPriceInput) simPriceInput.value = e.target.value;
    });
  }

  // 4. "Hornear Lote" Main Action CTA
  const btnBake = document.getElementById('btn-bake-cta');
  if (btnBake) {
    btnBake.addEventListener('click', async () => {
      const activeRecipe = state.recipes.find(r => r.id === state.activeRecipeId);
      if (!activeRecipe) {
        showToast('Selecciona una receta primero.', 'warning');
        return;
      }

      const confirmed = await openConfirmDialog(
        'Confirmar horneado de lote',
        `¿Confirmas el horneado de <strong>${activeRecipe.piezasPorLote} piezas</strong> de <em>"${escapeHTML(activeRecipe.nombre)}"</em>?<br><br>Se descontarán automáticamente los ingredientes de tu stock actual.`,
        '👨‍🍳 Hornear y descontar',
        'Cancelar'
      );

      if (!confirmed) return;

      const result = await deductInventoryForBatch(activeRecipe, activeRecipe.piezasPorLote, true);
      if (result.success) {
        await refreshAllData();
        if (result.warnings && result.warnings.length > 0) {
          showToast(`¡Lote horneado! Advertencia de stock bajo/negativo:<br>${result.warnings.join('<br>')}`, 'warning', 6000);
        } else {
          showToast(`¡Lote de ${activeRecipe.piezasPorLote} piezas horneado exitosamente! Inventario descontado.`, 'success');
        }
      }
    });
  }

  // 5. Fast Capture Row for Insumos (Stock tab)
  const fastInsumoForm = document.getElementById('fast-insumo-form');
  if (fastInsumoForm) {
    fastInsumoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('fast-ins-name');
      const qtyInput = document.getElementById('fast-ins-qty');
      const unitSelect = document.getElementById('fast-ins-unit');
      const priceInput = document.getElementById('fast-ins-price');

      const nombre = nameInput.value.trim();
      const cantidad = Number(qtyInput.value) || 0;
      const unidad = unitSelect.value;
      const precio = Number(priceInput.value) || 0;

      if (!nombre || cantidad <= 0 || precio <= 0) {
        showToast('Completa los campos con valores válidos.', 'warning');
        return;
      }

      const newInsumo = {
        id: 'ins-' + Date.now(),
        nombre,
        proveedor: 'General',
        cantidadPres: cantidad,
        unidadPres: unidad,
        precioPres: precio,
        stockActual: cantidad,
        stockMinimo: cantidad * 0.2, // 20% default critical
        updatedAt: Date.now()
      };

      await putItem('insumos', newInsumo);
      showToast(`Insumo "${nombre}" guardado con ${cantidad} ${unidad} en stock.`, 'success');

      nameInput.value = '';
      qtyInput.value = '';
      priceInput.value = '';
      nameInput.focus();

      await refreshAllData();
    });
  }

  // 6. Insumos List Actions (delegated)
  const insumosList = document.getElementById('insumos-cards-list');
  if (insumosList) {
    insumosList.addEventListener('click', async (e) => {
      const fastAddBtn = e.target.closest('.btn-add-stock-fast');
      const editBtn = e.target.closest('.btn-edit-insumo');
      const deleteBtn = e.target.closest('.btn-delete-insumo');

      if (fastAddBtn) {
        const id = fastAddBtn.getAttribute('data-id');
        const amount = Number(fastAddBtn.getAttribute('data-amount')) || 1000;
        const updated = await addStockToInsumo(id, amount);
        if (updated) {
          showToast(`+${amount} ${updated.unidadPres} agregados a ${updated.nombre}. Stock total: ${updated.stockActual.toFixed(1)} ${updated.unidadPres}`, 'success');
          await refreshAllData();
        }
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const ins = state.insumosMap[id];
        const conf = await openConfirmDialog('Eliminar Insumo', `¿Estás seguro de eliminar el insumo <em>"${escapeHTML(ins ? ins.nombre : '')}"</em>?`);
        if (conf) {
          await deleteItem('insumos', id);
          showToast('Insumo eliminado.', 'info');
          await refreshAllData();
        }
      } else if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const ins = state.insumosMap[id];
        if (ins) {
          openEditInsumoDialog(ins);
        }
      }
    });
  }

  // 7. Recipe List Actions (delegated)
  const recipesList = document.getElementById('recipes-cards-list');
  if (recipesList) {
    recipesList.addEventListener('click', async (e) => {
      const bakeBtn = e.target.closest('.btn-bake-recipe-direct');
      const dupBtn = e.target.closest('.btn-duplicate-recipe');
      const editBtn = e.target.closest('.btn-edit-recipe');
      const delBtn = e.target.closest('.btn-delete-recipe');

      if (bakeBtn) {
        const id = bakeBtn.getAttribute('data-id');
        state.activeRecipeId = id;
        switchView('tab-inicio');
        const bakeCTA = document.getElementById('btn-bake-cta');
        if (bakeCTA) bakeCTA.click();
      } else if (dupBtn) {
        const id = dupBtn.getAttribute('data-id');
        const rec = state.recipes.find(r => r.id === id);
        if (rec) {
          const clone = JSON.parse(JSON.stringify(rec));
          clone.id = 'rec-' + Date.now();
          clone.nombre = `${rec.nombre} (Copia)`;
          clone.updatedAt = Date.now();
          await putItem('postres', clone);
          showToast(`Receta duplicada como "${clone.nombre}".`, 'success');
          await refreshAllData();
        }
      } else if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        const rec = state.recipes.find(r => r.id === id);
        const conf = await openConfirmDialog('Eliminar Receta', `¿Estás seguro de eliminar la receta <em>"${escapeHTML(rec ? rec.nombre : '')}"</em>?`);
        if (conf) {
          await deleteItem('postres', id);
          showToast('Receta eliminada.', 'info');
          await refreshAllData();
        }
      } else if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const rec = state.recipes.find(r => r.id === id);
        if (rec) openRecipeWizardForEdit(rec);
      }
    });
  }

  // 8. Recipe Search Filter
  const recipeSearchInput = document.getElementById('recipe-search-input');
  if (recipeSearchInput) {
    recipeSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = state.recipes.filter(r => r.nombre.toLowerCase().includes(query));
      renderRecipesList(filtered, state.insumosMap, state.globalIndirects);
    });
  }

  // 9. Recipe Creation Wizard
  const btnOpenWizard = document.getElementById('btn-open-recipe-wizard');
  const wizardCard = document.getElementById('recipe-wizard-card');
  const btnCancelWizard = document.getElementById('btn-cancel-wizard');
  const wizardForm = document.getElementById('recipe-wizard-form');

  if (btnOpenWizard && wizardCard) {
    btnOpenWizard.addEventListener('click', () => {
      resetRecipeWizard();
      wizardCard.style.display = 'block';
      wizardCard.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnCancelWizard && wizardCard) {
    btnCancelWizard.addEventListener('click', () => {
      wizardCard.style.display = 'none';
      resetRecipeWizard();
    });
  }

  // Chips click: add ingredient in 1 tap
  const chipsWrap = document.getElementById('recipe-wizard-chips');
  if (chipsWrap) {
    chipsWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-btn');
      if (!chip) return;
      const insumoId = chip.getAttribute('data-insumo-id');
      const insumoName = chip.getAttribute('data-insumo-name');
      const insumoUnit = chip.getAttribute('data-insumo-unit');

      const existing = state.wizardSelectedInsumos.find(i => i.insumoId === insumoId);
      if (existing) {
        existing.cantidad = Number(existing.cantidad) + (insumoUnit === 'g' ? 100 : 1);
      } else {
        state.wizardSelectedInsumos.push({
          insumoId,
          nombre: insumoName,
          cantidad: insumoUnit === 'g' ? 100 : (insumoUnit === 'ml' ? 10 : 1),
          unidad: insumoUnit
        });
      }
      renderWizardSelectedItems();
    });
  }

  // Wizard items quantity input and remove
  const wizardItemsWrap = document.getElementById('wizard-selected-items-list');
  if (wizardItemsWrap) {
    wizardItemsWrap.addEventListener('input', (e) => {
      const qtyInput = e.target.closest('.wizard-item-qty');
      if (qtyInput) {
        const idx = Number(qtyInput.getAttribute('data-index'));
        if (state.wizardSelectedInsumos[idx]) {
          state.wizardSelectedInsumos[idx].cantidad = Number(qtyInput.value) || 0;
        }
      }
    });

    wizardItemsWrap.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-wizard-item');
      if (removeBtn) {
        const idx = Number(removeBtn.getAttribute('data-index'));
        state.wizardSelectedInsumos.splice(idx, 1);
        renderWizardSelectedItems();
      }
    });
  }

  // Foldable Accordion for Indirects in Wizard
  const accHeader = document.querySelector('.accordion-header');
  if (accHeader) {
    accHeader.addEventListener('click', () => {
      accHeader.closest('.accordion').classList.toggle('open');
    });
  }

  // Submit Recipe Wizard
  if (wizardForm) {
    wizardForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idInput = document.getElementById('wizard-recipe-id');
      const nameInput = document.getElementById('wizard-recipe-name');
      const yieldInput = document.getElementById('wizard-recipe-yield');
      const weightInput = document.getElementById('wizard-recipe-weight');
      const priceInput = document.getElementById('wizard-recipe-price');
      const mermaInput = document.getElementById('wizard-recipe-merma');

      const nombre = nameInput.value.trim();
      const piezasPorLote = Number(yieldInput.value) || 16;
      const pesoPieza = Number(weightInput.value) || 80;
      const precioVenta = Number(priceInput.value) || 28.50;
      const mermaPct = Number(mermaInput.value) || 0;

      if (!nombre) {
        showToast('Escribe el nombre de la receta.', 'warning');
        return;
      }

      if (state.wizardSelectedInsumos.length === 0) {
        showToast('Selecciona al menos 1 ingrediente de los botones rápidos.', 'warning');
        return;
      }

      const recipeId = idInput.value || ('rec-' + Date.now());
      const newRecipe = {
        id: recipeId,
        nombre,
        piezasPorLote,
        pesoPieza,
        precioVenta,
        mermaPct,
        indirectos: {
          gasMinutos: Number(document.getElementById('wizard-ind-gas').value) || state.globalIndirects.gasMinutos,
          tarifaHoraManoObra: Number(document.getElementById('wizard-ind-mo-tarifa').value) || state.globalIndirects.tarifaHoraManoObra,
          tiempoManoObraMin: Number(document.getElementById('wizard-ind-mo-tiempo').value) || state.globalIndirects.tiempoManoObraMin,
          empaquePorPieza: Number(document.getElementById('wizard-ind-empaque').value) || state.globalIndirects.empaquePorPieza,
          otrosIndirectos: 0
        },
        insumos: state.wizardSelectedInsumos.map(i => ({
          insumoId: i.insumoId,
          nombre: i.nombre,
          cantidad: Number(i.cantidad) || 0,
          unidad: i.unidad
        })),
        updatedAt: Date.now()
      };

      await putItem('postres', newRecipe);
      state.activeRecipeId = newRecipe.id;
      showToast(`¡Receta "${nombre}" guardada al instante!`, 'success');

      wizardCard.style.display = 'none';
      resetRecipeWizard();
      await refreshAllData();
    });
  }

  // 10. Gastos Form Save
  const gastosForm = document.getElementById('gastos-operativos-form');
  if (gastosForm) {
    gastosForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gasMin = Number(document.getElementById('gastos-gas-minutos').value) || 18;
      const gasCosto = Number(document.getElementById('gastos-gas-costo-min').value) || 0.2667;
      const moTarifa = Number(document.getElementById('gastos-mo-tarifa').value) || 80.00;
      const moTiempo = Number(document.getElementById('gastos-mo-tiempo').value) || 45;
      const empPieza = Number(document.getElementById('gastos-empaque-pieza').value) || 2.00;

      await saveGlobalIndirects({
        gasMinutos: gasMin,
        costoGasPorMinuto: gasCosto,
        tarifaHoraManoObra: moTarifa,
        tiempoManoObraMin: moTiempo,
        empaquePorPieza: empPieza,
        otrosIndirectos: 0
      });

      showToast('Parámetros de costos operativos actualizados.', 'success');
      await refreshAllData();
    });
  }

  // 11. Settings & Appearance
  document.querySelectorAll('input[name="theme-choice"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      applyTheme(e.target.value, true);
      showToast(`Tema actualizado a: ${e.target.value}`, 'info', 2000);
    });
  });

  const btnStartTour = document.getElementById('btn-start-tour-settings');
  if (btnStartTour) {
    btnStartTour.addEventListener('click', () => {
      startTour(true);
    });
  }

  // Business Name update
  const businessNameInput = document.getElementById('settings-negocio-nombre');
  if (businessNameInput) {
    businessNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const brandTitle = document.getElementById('header-brand-title');
      if (brandTitle) brandTitle.textContent = val || 'Bakery Calculator';
    });
    businessNameInput.addEventListener('change', async (e) => {
      const val = e.target.value.trim();
      state.globalIndirects.nombreNegocio = val;
      await saveGlobalIndirects(state.globalIndirects);
      const brandTitle = document.getElementById('header-brand-title');
      if (brandTitle) brandTitle.textContent = val || 'Bakery Calculator';
      showToast('Nombre del negocio actualizado.', 'success');
    });
  }

  // Export Database
  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const json = await exportDatabaseJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bakery-calc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Respaldo JSON generado y descargado.', 'success');
    });
  }

  // Import Database
  const fileImportInput = document.getElementById('file-import-json');
  const btnImport = document.getElementById('btn-import-json');
  if (btnImport && fileImportInput) {
    btnImport.addEventListener('click', () => fileImportInput.click());
    fileImportInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          await importDatabaseJSON(evt.target.result);
          showToast('Datos restaurados correctamente.', 'success');
          await refreshAllData();
        } catch (err) {
          showToast('Error al importar archivo JSON.', 'danger');
        }
      };
      reader.readAsText(file);
      fileImportInput.value = '';
    });
  }

  // Restart Onboarding Tour
  const btnRestartTour = document.getElementById('btn-restart-tour');
  if (btnRestartTour) {
    btnRestartTour.addEventListener('click', () => {
      resetTour();
    });
  }

  // Clear All Data and Start Fresh
  const btnClearAll = document.getElementById('btn-clear-all-data');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      const conf = await openConfirmDialog(
        'Borrar Todos los Datos',
        '¿Deseas vaciar la base de datos por completo y comenzar desde cero? Se borrarán todos los insumos, recetas y configuraciones.',
        'Sí, borrar todo',
        'Cancelar'
      );
      if (conf) {
        await clearAllData();
        showToast('Base de datos vaciada con éxito. Iniciando desde cero.', 'info');
        await refreshAllData();
        startTour(true);
      }
    });
  }
}

/* Reset / Prepare Wizard */
function resetRecipeWizard() {
  const form = document.getElementById('recipe-wizard-form');
  if (form) form.reset();
  document.getElementById('wizard-recipe-id').value = '';
  document.getElementById('wizard-title').textContent = 'Alta Rápida de Receta';
  state.wizardSelectedInsumos = [];
  renderWizardSelectedItems();
}

function openRecipeWizardForEdit(recipe) {
  const wizardCard = document.getElementById('recipe-wizard-card');
  if (!wizardCard) return;

  resetRecipeWizard();
  document.getElementById('wizard-title').textContent = `Editar Receta: ${recipe.nombre}`;
  document.getElementById('wizard-recipe-id').value = recipe.id;
  document.getElementById('wizard-recipe-name').value = recipe.nombre;
  document.getElementById('wizard-recipe-yield').value = recipe.piezasPorLote;
  document.getElementById('wizard-recipe-weight').value = recipe.pesoPieza || 80;
  document.getElementById('wizard-recipe-price').value = recipe.precioVenta;
  document.getElementById('wizard-recipe-merma').value = recipe.mermaPct || 0;

  if (recipe.indirectos) {
    document.getElementById('wizard-ind-gas').value = recipe.indirectos.gasMinutos || 18;
    document.getElementById('wizard-ind-mo-tarifa').value = recipe.indirectos.tarifaHoraManoObra || 80;
    document.getElementById('wizard-ind-mo-tiempo').value = recipe.indirectos.tiempoManoObraMin || 45;
    document.getElementById('wizard-ind-empaque').value = recipe.indirectos.empaquePorPieza || 2;
  }

  state.wizardSelectedInsumos = (recipe.insumos || []).map(i => ({
    insumoId: i.insumoId,
    nombre: i.nombre,
    cantidad: i.cantidad,
    unidad: i.unidad
  }));

  renderWizardSelectedItems();
  wizardCard.style.display = 'block';
  wizardCard.scrollIntoView({ behavior: 'smooth' });
}

/* Edit Insumo Modal */
function openEditInsumoDialog(insumo) {
  const dialog = document.getElementById('native-edit-insumo-dialog');
  if (!dialog) return;

  document.getElementById('edit-ins-id').value = insumo.id;
  document.getElementById('edit-ins-name').value = insumo.nombre;
  document.getElementById('edit-ins-provider').value = insumo.proveedor || '';
  document.getElementById('edit-ins-qty').value = insumo.cantidadPres;
  document.getElementById('edit-ins-unit').value = insumo.unidadPres;
  document.getElementById('edit-ins-price').value = insumo.precioPres;
  document.getElementById('edit-ins-stock').value = insumo.stockActual;
  document.getElementById('edit-ins-stockmin').value = insumo.stockMinimo || 0;

  dialog.showModal();
}

const editInsumoForm = document.getElementById('edit-insumo-form');
if (editInsumoForm) {
  editInsumoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-ins-id').value;
    const ins = state.insumosMap[id] || {};

    ins.id = id;
    ins.nombre = document.getElementById('edit-ins-name').value.trim();
    ins.proveedor = document.getElementById('edit-ins-provider').value.trim();
    ins.cantidadPres = Number(document.getElementById('edit-ins-qty').value) || 0;
    ins.unidadPres = document.getElementById('edit-ins-unit').value;
    ins.precioPres = Number(document.getElementById('edit-ins-price').value) || 0;
    ins.stockActual = Number(document.getElementById('edit-ins-stock').value) || 0;
    ins.stockMinimo = Number(document.getElementById('edit-ins-stockmin').value) || 0;
    ins.updatedAt = Date.now();

    await putItem('insumos', ins);
    document.getElementById('native-edit-insumo-dialog').close();
    showToast('Insumo actualizado.', 'success');
    await refreshAllData();
  });

  const cancelEditBtn = document.getElementById('edit-ins-cancel');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      document.getElementById('native-edit-insumo-dialog').close();
    });
  }
}

/* Service Worker Registration */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          // Listen for update found
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('Nueva versión de Service Worker instalada silenciosamente.');
                  }
                }
              });
            }
          });
        })
        .catch(err => {
          console.warn('Error al registrar Service Worker:', err);
        });
    });
  }
}

/* Initialize Application */
export async function initApp() {
  registerServiceWorker();
  await initTheme();
  await initDatabaseDefaults();
  await refreshAllData();
  setupEventListeners();

  // Onboarding tour check
  const needsTour = await shouldShowTour();
  if (needsTour) {
    setTimeout(() => {
      startTour(false);
    }, 600);
  }
}

// Start application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}



