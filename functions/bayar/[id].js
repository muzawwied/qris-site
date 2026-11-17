// Tampilkan halaman tanpa mengubah URL (rewrite ke aset statis).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const assetUrl = new URL('/bayar/', url.origin);
  const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), { headers: request.headers }));
  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
