/**
 * Cloudflare Pages Function: /api/lotes
 * Historial de Producción y Deducción Transaccional de Stock con Cloudflare D1
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true }, 200);
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return jsonResponse({
      error: 'D1 database binding "DB" no configurado en Cloudflare Pages.'
    }, 500);
  }

  try {
    // 1. GET (Historial de lotes)
    if (request.method === 'GET') {
      const { results } = await db.prepare(
        'SELECT * FROM lotes_horneados ORDER BY id DESC LIMIT 100'
      ).all();

      const list = (results || []).map((row) => {
        let insumosDescontados = [];
        try {
          insumosDescontados = row.insumos_descontados_json ? JSON.parse(row.insumos_descontados_json) : [];
        } catch (_) {}

        return {
          id: row.id,
          postreId: row.postreId,
          postreNombre: row.postreNombre,
          fecha: row.fecha,
          piezasReales: row.piezasReales,
          costoTotalHistorico: row.costoTotalHistorico,
          insumosDescontados,
          createdAt: row.createdAt
        };
      });

      return jsonResponse(list);
    }

    // 2. POST (Deducción atómica de lote de horneado)
    if (request.method === 'POST') {
      const body = await request.json();
      const { recipe, batchPieces = null, allowNegative = true } = body;

      if (!recipe || !recipe.id) {
        return jsonResponse({ error: 'Receta no especificada' }, 400);
      }

      const ratio = batchPieces ? (Number(batchPieces) / (Number(recipe.piezasPorLote) || 1)) : 1;
      const insumosDeducted = [];
      const warnings = [];
      const batchStatements = [];
      const now = Date.now();

      // Consultar stock actual de los insumos involucrados
      const recipeInsumos = Array.isArray(recipe.insumos) ? recipe.insumos : [];
      
      for (const item of recipeInsumos) {
        const insumoId = item.insumoId;
        if (!insumoId) continue;

        const currentInsumo = await db.prepare('SELECT * FROM insumos WHERE id = ?').bind(insumoId).first();
        if (currentInsumo) {
          const cantidadADescontar = Number(item.cantidad) * ratio;
          const stockAnterior = Number(currentInsumo.stockActual) || 0;
          const nuevoStock = stockAnterior - cantidadADescontar;

          if (nuevoStock < 0) {
            warnings.push(`${currentInsumo.nombre}: Faltaron ${(Math.abs(nuevoStock)).toFixed(1)} ${currentInsumo.unidadPres}`);
          }

          // Preparar UPDATE para el batch atómico
          batchStatements.push(
            db.prepare('UPDATE insumos SET stockActual = ?, updatedAt = ? WHERE id = ?')
              .bind(nuevoStock, now, insumoId)
          );

          insumosDeducted.push({
            id: currentInsumo.id,
            nombre: currentInsumo.nombre,
            descontado: cantidadADescontar,
            stockRestante: nuevoStock,
            unidad: currentInsumo.unidadPres
          });
        }
      }

      // Preparar INSERT del lote
      const piezasReales = batchPieces || recipe.piezasPorLote || 1;
      const costoTotalHistorico = recipe.costoTotalCalculado || 0;
      const fecha = new Date().toISOString();
      const insumosJson = JSON.stringify(insumosDeducted);

      batchStatements.push(
        db.prepare(`
          INSERT INTO lotes_horneados (postreId, postreNombre, fecha, piezasReales, costoTotalHistorico, insumos_descontados_json, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(recipe.id, recipe.nombre, fecha, piezasReales, costoTotalHistorico, insumosJson, now)
      );

      // Ejecución atómica en D1
      if (batchStatements.length > 0) {
        await db.batch(batchStatements);
      }

      return jsonResponse({
        success: true,
        warnings,
        insumosDeducted
      });
    }

    return jsonResponse({ error: 'Método no soportado' }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error al procesar lote' }, 500);
  }
}
