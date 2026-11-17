export async function onRequestGet({ request, env, params }) {
  const slug = String(params.slug || '').toLowerCase();

  const templateUrl = new URL('/toko/template.html', request.url);
  const res = await env.ASSETS.fetch(templateUrl);
  if (!res.ok) return new Response('Halaman tidak tersedia.', { status: 500 });

  let html = await res.text();

  let name = 'Toko';
  try {
    const row = await env.DB.prepare(
      'SELECT business_name FROM users WHERE store_slug = ? LIMIT 1'
    ).bind(slug).first();
    if (row && row.business_name) name = row.business_name;
  } catch (e) {
    /* biarkan nama default */
  }

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  html = html
    .replace(/__NAME__/g, esc(name))
    .replace(/__INITIAL__/g, esc(name.trim().charAt(0).toUpperCase() || 'T'))
    .replace(/__SLUG__/g, esc(slug));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
