/**
 * Cloudflare Pages Function: /api/clear
 * Reinicio y limpieza de datos de la empresa en Cloudflare D1
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no soportado' }, 405);
  }

  try {
    await db.batch([
      db.prepare('DELETE FROM insumos'),
      db.prepare('DELETE FROM postres'),
      db.prepare('DELETE FROM lotes_horneados'),
      db.prepare('DELETE FROM gastos_generales')
    ]);

    return jsonResponse({ success: true, message: 'Base de datos D1 vaciada exitosamente' });
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error al vaciar base de datos' }, 500);
  }
}
