import { ensureSchema, json, cors, readJson, currentUser, verifyPassword, hashPassword } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

// POST /api/me/password { current_password, new_password }
export async function onRequestPost({ request, env }) {
  await ensureSchema(env);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Silakan masuk dulu.' }, 401);

  const body = await readJson(request);
  const cur = String((body && body.current_password) || '');
  const next = String((body && body.new_password) || '');
  if (next.length < 8) return json({ error: 'Password baru minimal 8 karakter.' }, 400);

  const ok = await verifyPassword(cur, user.password_hash);
  if (!ok) return json({ error: 'Password saat ini salah.' }, 401);

  const hash = await hashPassword(next);
  await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(hash, new Date().toISOString(), user.id).run();

  return json({ ok: true });
}
