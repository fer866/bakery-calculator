/**
 * Cloudflare Pages Function: /api/insumos
 * CRUD de Insumos y Materias Primas con Cloudflare D1
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

export async function onRequestOptions() {
  return jsonResponse({ ok: true }, 200);
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return jsonResponse({
      error: 'D1 database binding "DB" no configurado en Cloudflare Pages. Vincula "bakery-db" como "DB" en Settings > Functions.'
    }, 500);
  }

  const url = new URL(request.url);
  const idParam = url.searchParams.get('id');

  try {
    // 1. GET (Listar todos o uno por ID)
    if (request.method === 'GET') {
      if (idParam) {
        const item = await db.prepare('SELECT * FROM insumos WHERE id = ?').bind(idParam).first();
        if (!item) return jsonResponse(null, 404);
        return jsonResponse(item);
      }
      const { results } = await db.prepare('SELECT * FROM insumos ORDER BY nombre ASC').all();
      return jsonResponse(results || []);
    }

    // 2. POST / PUT (Upsert o Añadir Stock)
    if (request.method === 'POST' || request.method === 'PUT') {
      const body = await request.json();

      // Acción rápida: Añadir stock directamente
      if (body.action === 'add_stock') {
        const { id, cantidadAñadida } = body;
        const now = Date.now();
        await db.prepare(
          'UPDATE insumos SET stockActual = stockActual + ?, updatedAt = ? WHERE id = ?'
        ).bind(Number(cantidadAñadida) || 0, now, id).run();

        const updated = await db.prepare('SELECT * FROM insumos WHERE id = ?').bind(id).first();
        return jsonResponse({ success: true, item: updated });
      }

      // Upsert estándar de insumo
      const {
        id,
        nombre,
        proveedor = '',
        cantidadPres = 1,
        unidadPres = 'kg',
        precioPres = 0,
        stockActual = 0,
        stockMinimo = 0,
        updatedAt = Date.now()
      } = body;

      if (!id || !nombre) {
        return jsonResponse({ error: 'Faltan campos obligatorios: id, nombre' }, 400);
      }

      await db.prepare(`
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
        id,
        nombre,
        proveedor,
        Number(cantidadPres) || 1,
        unidadPres,
        Number(precioPres) || 0,
        Number(stockActual) || 0,
        Number(stockMinimo) || 0,
        updatedAt
      ).run();

      const item = await db.prepare('SELECT * FROM insumos WHERE id = ?').bind(id).first();
      return jsonResponse({ success: true, item });
    }

    // 3. DELETE (Eliminar insumo)
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

      await db.prepare('DELETE FROM insumos WHERE id = ?').bind(targetId).run();
      return jsonResponse({ success: true, deletedId: targetId });
    }

    return jsonResponse({ error: 'Método no soportado' }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error interno de base de datos' }, 500);
  }
}
