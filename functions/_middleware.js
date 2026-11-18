import { sameOrigin, hasSessionCookie, rateLimit, clientIp } from './api/_lib.js';

// Middleware global: cek asal permintaan, batasi laju kasar, dan pasang header keamanan.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (isApi) {
    const method = request.method.toUpperCase();
    const unsafe = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

    if (unsafe && hasSessionCookie(request) && !sameOrigin(request)) {
      return new Response(JSON.stringify({ error: 'Permintaan ditolak.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Batas kasar untuk menahan banjir permintaan ke API.
    if (unsafe) {
      const ip = clientIp(request);
      const lim = await rateLimit(env, 'api:ip:' + ip, 240, 60);
      if (!lim.ok) {
        return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(lim.retry_after) },
        });
      }
    }
  }

  const res = await next();

  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  return out;
}
