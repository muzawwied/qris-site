import { ensureSchema, json, cors, currentUser, sha256Hex, clearCookie } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  const user = await currentUser(request, env);
  if (user) {
    const raw = request.headers.get('cookie') || '';
    const m = raw.match(/qris_session=([^;]+)/);
    if (m) {
      const hash = await sha256Hex(decodeURIComponent(m[1]));
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    }
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
