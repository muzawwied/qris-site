// Tautan pendek publik: /q/<id> -> halaman QRIS
export async function onRequestGet({ request, params }) {
  const id = String(params.id || '').trim();
  const url = new URL(request.url);
  return Response.redirect(url.origin + '/qris.html?id=' + encodeURIComponent(id), 302);
}
