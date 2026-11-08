/**
 * Cloudflare Pages Function: /api/backup
 * Exportación e Importación de Respaldo JSON completo en Cloudflare D1
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
    // 1. GET (Exportar respaldo JSON)
    if (request.method === 'GET') {
      const insumosRes = await db.prepare('SELECT * FROM insumos ORDER BY nombre ASC').all();
      const postresRes = await db.prepare('SELECT * FROM postres ORDER BY nombre ASC').all();
      const lotesRes = await db.prepare('SELECT * FROM lotes_horneados ORDER BY id DESC').all();
      const gastosRes = await db.prepare('SELECT * FROM gastos_generales WHERE id = ?').bind('global_indirects').first();

      const postres = (postresRes.results || []).map((row) => {
        let indirectos = {};
        let insumos = [];
        try { indirectos = JSON.parse(row.indirectos_json); } catch (_) {}
        try { insumos = JSON.parse(row.insumos_json); } catch (_) {}
        return {
          id: row.id,
          nombre: row.nombre,
          piezasPorLote: row.piezasPorLote,
          pesoPieza: row.pesoPieza,
          precioVenta: row.precioVenta,
          mermaPct: row.mermaPct,
          indirectos,
          insumos,
          updatedAt: row.updatedAt
        };
      });

      const lotes = (lotesRes.results || []).map((row) => {
        let insumosDescontados = [];
        try { insumosDescontados = JSON.parse(row.insumos_descontados_json); } catch (_) {}
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

      const gastosGenerales = gastosRes || {
        id: 'global_indirects',
        nombreNegocio: '',
        gasMinutos: 18,
        costoGasPorMinuto: 0.2667,
        tarifaHoraManoObra: 80.00,
        tiempoManoObraMin: 45,
        empaquePorPieza: 2.00,
        otrosIndirectos: 0.00
      };

      const backup = {
        version: '2.2.0-d1',
        exportDate: new Date().toISOString(),
        business: gastosGenerales.nombreNegocio || 'Bakery Calculator',
        insumos: insumosRes.results || [],
        postres,
        lotesHorneados: lotes,
        gastosGenerales
      };

      return jsonResponse(backup);
    }

    // 2. POST (Importar respaldo JSON)
    if (request.method === 'POST') {
      const data = await request.json();
      const batchStatements = [];

      // Importar Insumos
      if (Array.isArray(data.insumos)) {
        for (const item of data.insumos) {
          batchStatements.push(
            db.prepare(`
              INSERT INTO insumos (id, nombre, proveedor, cantidadPres, unidadPres, precioPres, stockActual, stockMinimo, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nombre = excluded.nombre,
                proveedor = excluded.proveedor,
                cantidadPres = excluded.cantidadPres,
                unidadPres = excluded.unidadPres,
                precioPres = excluded.precioPres,
                stockActual = excluded.stockActual,
                stockMinimo = excluded.stockMinimo,
                updatedAt = excluded.updatedAt
            `).bind(
              item.id,
              item.nombre,
              item.proveedor || '',
              Number(item.cantidadPres) || 1,
              item.unidadPres || 'kg',
              Number(item.precioPres) || 0,
              Number(item.stockActual) || 0,
              Number(item.stockMinimo) || 0,
              item.updatedAt || Date.now()
            )
          );
        }
      }

      // Importar Postres
      if (Array.isArray(data.postres)) {
        for (const item of data.postres) {
          batchStatements.push(
            db.prepare(`
              INSERT INTO postres (id, nombre, piezasPorLote, pesoPieza, precioVenta, mermaPct, indirectos_json, insumos_json, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nombre = excluded.nombre,
                piezasPorLote = excluded.piezasPorLote,
                pesoPieza = excluded.pesoPieza,
                precioVenta = excluded.precioVenta,
                mermaPct = excluded.mermaPct,
                indirectos_json = excluded.indirectos_json,
                insumos_json = excluded.insumos_json,
                updatedAt = excluded.updatedAt
            `).bind(
              item.id,
              item.nombre,
              Number(item.piezasPorLote) || 1,
              Number(item.pesoPieza) || 0,
              Number(item.precioVenta) || 0,
              Number(item.mermaPct) || 0,
              JSON.stringify(item.indirectos || {}),
              JSON.stringify(item.insumos || []),
              item.updatedAt || Date.now()
            )
          );
        }
      }

      // Importar Gastos Generales
      if (data.gastosGenerales) {
        const g = data.gastosGenerales;
        batchStatements.push(
          db.prepare(`
            INSERT INTO gastos_generales (
              id, nombreNegocio, gasMinutos, costoGasPorMinuto,
              tarifaHoraManoObra, tiempoManoObraMin, empaquePorPieza,
              otrosIndirectos, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              nombreNegocio = excluded.nombreNegocio,
              gasMinutos = excluded.gasMinutos,
              costoGasPorMinuto = excluded.costoGasPorMinuto,
              tarifaHoraManoObra = excluded.tarifaHoraManoObra,
              tiempoManoObraMin = excluded.tiempoManoObraMin,
              empaquePorPieza = excluded.empaquePorPieza,
              otrosIndirectos = excluded.otrosIndirectos,
              updatedAt = excluded.updatedAt
          `).bind(
            'global_indirects',
            g.nombreNegocio || '',
            Number(g.gasMinutos) || 18,
            Number(g.costoGasPorMinuto) || 0.2667,
            Number(g.tarifaHoraManoObra) || 80.0,
            Number(g.tiempoManoObraMin) || 45,
            Number(g.empaquePorPieza) || 2.0,
            Number(g.otrosIndirectos) || 0,
            Date.now()
          )
        );
      }

      // Ejecutar en chunks si supera el límite de statements por batch
      const CHUNK_SIZE = 50;
      for (let i = 0; i < batchStatements.length; i += CHUNK_SIZE) {
        const chunk = batchStatements.slice(i, i + CHUNK_SIZE);
        await db.batch(chunk);
      }

      return jsonResponse({ success: true, count: batchStatements.length });
    }

    return jsonResponse({ error: 'Método no soportado' }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error al procesar respaldo' }, 500);
  }
}
