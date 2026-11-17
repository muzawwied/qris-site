import { ensureSchema, ensurePaymentsUserId, json, cors, currentUser, publicUser } from '../_lib.js';

export async function onRequestOptions() { return cors(); }

export async function onRequestGet({ request, env }) {
  await ensureSchema(env);
  await ensurePaymentsUserId(env);
  const user = await currentUser(request, env);
  if (!user) return json({ ok: false, user: null }, 200);
  return json({ ok: true, user: publicUser(user) });
}
