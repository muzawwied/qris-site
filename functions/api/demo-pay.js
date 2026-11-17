import { ensureSchema, json, cors, readJson, mode, isAdmin, markPaid } from './_lib.js';

export async function onRequestOptions() {
  return cors();
}

// POST /api/demo-pay { id } — menandai tagihan demo sebagai lunas (hanya mode demo,
// atau admin token di mode live). Dipakai tombol "Simulasikan pembayaran".
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  const body = await readJson(request);
  const id = String((body && body.id) || '').trim();
  if (!id) return json({ error: 'id wajib.' }, 400);

  const live = mode(env) === 'live';
  if (live && !isAdmin(request, env)) {
    return json({ error: 'Mode live: simulasi dinonaktifkan.' }, 403);
  }

  const row = await env.DB.prepare('SELECT * FROM payments WHERE id = ? OR reference = ? LIMIT 1')
    .bind(id, id)
    .first();
  if (!row) return json({ error: 'Tagihan tidak ditemukan.' }, 404);
  if (row.status === 'paid') return json({ ok: true, status: 'paid', already: true });

  await markPaid(env, row, { issuer: 'demo', demo: true });
  return json({ ok: true, id: row.id, status: 'paid', demo: true });
}
