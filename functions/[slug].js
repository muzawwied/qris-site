import { renderStore } from './_store.js';

// Alamat toko satu tingkat tanpa awalan: /<nama-toko>
// Path lain diteruskan ke aset statis supaya halaman biasa tidak tertimpa.
const RESERVED = new Set([
  'masuk', 'daftar', 'verifikasi', 'onboarding', 'app', 'bayar', 'q', 'qris',
  'toko', 'docs', 'legal', 'produk', 'harga', 'faq', 'cara-kerja',
  'lupa-password', 'atur-ulang-password', 'assets', 'css', 'js', 'functions', 'api',
]);

async function passthrough(request, env) {
  return env.ASSETS.fetch(request);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = String(params.slug || '');

  if (!slug || slug.includes('.') || slug.startsWith('_') || RESERVED.has(slug)) {
    return passthrough(request, env);
  }

  try {
    const row = await env.DB.prepare('SELECT id FROM users WHERE store_slug = ? LIMIT 1')
      .bind(slug.toLowerCase()).first();
    if (row) return renderStore(request, env, slug);
  } catch (e) {
    /* lanjut ke aset statis */
  }

  return passthrough(request, env);
}
