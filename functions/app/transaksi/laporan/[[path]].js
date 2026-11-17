// Halaman laporan terpisah sudah tidak dipakai; unduhan ada di halaman statistik.
export async function onRequest({ request }) {
  return Response.redirect(new URL('/app/statistik/', request.url).toString(), 302);
}
