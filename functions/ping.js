/**
 * Cloudflare Pages Function - Endpoint de prueba (/ping)
 * Habilita la compilación de Pages Functions y la configuración de Bindings (KV, D1, R2, AI, etc.) en Cloudflare Pages.
 */
export async function onRequest(context) {
  const { request, env } = context;

  // Lista de bindings disponibles configurados en Cloudflare Pages
  const bindingKeys = env ? Object.keys(env) : [];

  const payload = {
    status: 'ok',
    message: 'pong',
    timestamp: new Date().toISOString(),
    url: request.url,
    bindings: bindingKeys
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
