import { ensureSchema, json, mode } from './_lib.js';

export async function onRequestGet({ env }) {
  const out = { ok: true, service: 'qris-site', mode: mode(env), time: new Date().toISOString() };
  try {
    await ensureSchema(env);
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM payments').first();
    out.db = 'ok';
    out.payments = r ? r.n : 0;
  } catch (e) {
    out.ok = false;
    out.db = 'error: ' + (e && e.message ? e.message : String(e));
  }
  return json(out, out.ok ? 200 : 500);
}
