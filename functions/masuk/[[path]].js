// Halaman masuk: sisipkan widget Turnstile dari konfigurasi server.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new URL('/masuk/index.html', url.origin));
  if (!res.ok) return res;

  let html = await res.text();
  const key = env.TURNSTILE_SITE_KEY || '';

  if (key) {
    const widget = '<div id="turnstileSlot" style="margin:0 0 14px"><div class="cf-turnstile" data-sitekey="' +
      key + '" data-theme="light"></div></div>';
    html = html
      .replace(/<div id="turnstileSlot"[^>]*><\/div>/, widget)
      .replace('</body>', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>\n</body>');
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
