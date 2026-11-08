/**
 * Cloudflare Pages Function: /api/empresa
 * Configuración de Empresa y Gastos Indirectos Globales con Cloudflare D1
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

const DEFAULTS = {
  id: 'global_indirects',
  nombreNegocio: '',
  gasMinutos: 18,
  costoGasPorMinuto: 0.2667,
  tarifaHoraManoObra: 80.00,
  tiempoManoObraMin: 45,
  empaquePorPieza: 2.00,
  otrosIndirectos: 0.00
};

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
    // 1. GET (Obtener configuración global)
    if (request.method === 'GET') {
      const stored = await db.prepare(
        'SELECT * FROM gastos_generales WHERE id = ?'
      ).bind('global_indirects').first();

      if (!stored) {
        return jsonResponse(DEFAULTS);
      }

      return jsonResponse({
        id: stored.id,
        nombreNegocio: stored.nombreNegocio || '',
        gasMinutos: Number(stored.gasMinutos) ?? DEFAULTS.gasMinutos,
        costoGasPorMinuto: Number(stored.costoGasPorMinuto) ?? DEFAULTS.costoGasPorMinuto,
        tarifaHoraManoObra: Number(stored.tarifaHoraManoObra) ?? DEFAULTS.tarifaHoraManoObra,
        tiempoManoObraMin: Number(stored.tiempoManoObraMin) ?? DEFAULTS.tiempoManoObraMin,
        empaquePorPieza: Number(stored.empaquePorPieza) ?? DEFAULTS.empaquePorPieza,
        otrosIndirectos: Number(stored.otrosIndirectos) ?? DEFAULTS.otrosIndirectos,
        updatedAt: stored.updatedAt
      });
    }

    // 2. POST / PUT (Guardar configuración)
    if (request.method === 'POST' || request.method === 'PUT') {
      const body = await request.json();
      const payload = {
        ...DEFAULTS,
        ...body,
        id: 'global_indirects',
        updatedAt: Date.now()
      };

      await db.prepare(`
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
        payload.id,
        payload.nombreNegocio,
        Number(payload.gasMinutos) || 0,
        Number(payload.costoGasPorMinuto) || 0,
        Number(payload.tarifaHoraManoObra) || 0,
        Number(payload.tiempoManoObraMin) || 0,
        Number(payload.empaquePorPieza) || 0,
        Number(payload.otrosIndirectos) || 0,
        payload.updatedAt
      ).run();

      return jsonResponse({ success: true, item: payload });
    }

    return jsonResponse({ error: 'Método no soportado' }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error interno de base de datos' }, 500);
  }
}
