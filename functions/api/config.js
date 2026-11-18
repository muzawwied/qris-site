import { json, mode } from './_lib.js';

export async function onRequestGet({ env }) {
  return json({
    mode: mode(env),
    fee_rate: Number(env.FEE_RATE || 0.02),
    currency: 'IDR',
    provider: 'clinqoo',
    max_amount: 100000000,
    min_amount: 1000,
    expires_minutes: 30,
  });
}
