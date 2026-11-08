/**
 * Cloudflare Pages Function: /api/postres
 * CRUD de Recetas (Postres) con Cloudflare D1
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function mapRowToRecipe(row) {
  if (!row) return null;
  let indirectos = {};
  let insumos = [];
  try {
    indirectos = row.indirectos_json ? JSON.parse(row.indirectos_json) : {};
  } catch (_) {}
  try {
    insumos = row.insumos_json ? JSON.parse(row.insumos_json) : [];
  } catch (_) {}

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

  const url = new URL(request.url);
  const idParam = url.searchParams.get('id');

  try {
    // 1. GET (Listar todas o una por ID)
    if (request.method === 'GET') {
      if (idParam) {
        const row = await db.prepare('SELECT * FROM postres WHERE id = ?').bind(idParam).first();
        if (!row) return jsonResponse(null, 404);
        return jsonResponse(mapRowToRecipe(row));
      }
      const { results } = await db.prepare('SELECT * FROM postres ORDER BY nombre ASC').all();
      const list = (results || []).map(mapRowToRecipe);
      return jsonResponse(list);
    }

    // 2. POST / PUT (Upsert de receta)
    if (request.method === 'POST' || request.method === 'PUT') {
      const body = await request.json();
      const {
        id,
        nombre,
        piezasPorLote = 1,
        pesoPieza = 0,
        precioVenta = 0,
        mermaPct = 0,
        indirectos = {},
        insumos = [],
        updatedAt = Date.now()
      } = body;

      if (!id || !nombre) {
        return jsonResponse({ error: 'Faltan campos obligatorios: id, nombre' }, 400);
      }

      const indirectosJson = JSON.stringify(indirectos || {});
      const insumosJson = JSON.stringify(insumos || []);

      await db.prepare(`
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
        id,
        nombre,
        Number(piezasPorLote) || 1,
        Number(pesoPieza) || 0,
        Number(precioVenta) || 0,
        Number(mermaPct) || 0,
        indirectosJson,
        insumosJson,
        updatedAt
      ).run();

      const row = await db.prepare('SELECT * FROM postres WHERE id = ?').bind(id).first();
      return jsonResponse({ success: true, item: mapRowToRecipe(row) });
    }

    // 3. DELETE (Eliminar receta)
    if (request.method === 'DELETE') {
      let targetId = idParam;
      if (!targetId) {
        try {
          const body = await request.json();
          targetId = body.id;
        } catch (_) {}
      }

      if (!targetId) {
        return jsonResponse({ error: 'Falta parámetro id para eliminar' }, 400);
      }

      await db.prepare('DELETE FROM postres WHERE id = ?').bind(targetId).run();
      return jsonResponse({ success: true, deletedId: targetId });
    }

    return jsonResponse({ error: 'Método no soportado' }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error interno de base de datos' }, 500);
  }
}
