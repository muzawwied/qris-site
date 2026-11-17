// Render halaman toko untuk satu slug (dipakai /toko/<slug> dan /<slug>).

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export async function renderStore(request, env, slugRaw) {
  const slug = String(slugRaw || '').toLowerCase();

  const templateUrl = new URL('/toko/template.html', request.url);
  const res = await env.ASSETS.fetch(templateUrl);
  if (!res.ok) return new Response('Halaman tidak tersedia.', { status: 500 });

  let html = await res.text();

  let name = 'Toko';
  let logo = '';
  try {
    const row = await env.DB.prepare(
      'SELECT business_name, logo FROM users WHERE store_slug = ? LIMIT 1'
    ).bind(slug).first();
    if (row && row.business_name) name = row.business_name;
    if (row && row.logo) logo = row.logo;
  } catch (e) {
    /* biarkan nama default */
  }

  html = html
    .replace(/__NAME__/g, esc(name))
    .replace(/__LOGO__/g, logo && /^data:image\//.test(logo)
      ? '<img alt="" src="' + esc(logo) + '">'
      : esc(name.trim().charAt(0).toUpperCase() || 'T'))
    .replace(/__SLUG__/g, esc(slug));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function notFound(request, env) {
  try {
    const res = await env.ASSETS.fetch(new URL('/404.html', request.url));
    if (res.ok) {
      return new Response(await res.text(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
  } catch (e) { /* abaikan */ }
  return new Response('Halaman tidak ditemukan.', { status: 404 });
}
