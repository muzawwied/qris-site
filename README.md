# Clinqoo

Web + backend penerima pembayaran QRIS. Berjalan di Cloudflare Pages (Functions + D1).

## Halaman
- `/` landing
- `/dashboard` ringkasan (butuh login)
- `/tagihan` buat tagihan
- `/transaksi` riwayat transaksi
- `/integrasi` API key & webhook
- `/pengaturan` profil & password
- `/bayar?id=...` checkout pembeli
- `/q/<id>` tautan pendek QRIS publik (bisa dibagikan/dicetak)
- `/api.html` dokumentasi API
- `/legal.html` syarat & privasi

## API
| Endpoint | Fungsi |
|---|---|
| `POST /api/pay` | buat tagihan (publik, atau dengan sesi/API key) |
| `GET /api/pay/{id}` | status tagihan |
| `POST /api/webhook` | callback provider (HMAC SHA-256) |
| `POST /api/auth/register` | daftar akun |
| `POST /api/auth/login` | masuk |
| `POST /api/auth/logout` | keluar |
| `GET /api/auth/me` | sesi aktif |
| `GET /api/me/payments` | transaksi milik user |
| `GET/POST /api/me/apikey` | lihat/ganti API key |
| `POST /api/me/profile` | ubah nama usaha |
| `POST /api/me/password` | ubah password |
| `GET /api/payments` | semua transaksi (admin) |
| `GET /api/health` | status layanan |

## Environment (Cloudflare Pages)
- `ADMIN_TOKEN` — akses endpoint admin
- `WEBHOOK_SECRET` — verifikasi tanda tangan webhook
- `PAYMENT_MODE` — `demo` atau `live`
- `QRIS_API_KEY`, `QRIS_MERCHANT_ID`, `QRIS_API_BASE`, `QRIS_CREATE_PATH` — kredensial provider (mode live)
- `FEE_RATE` — default `0.007`

## Deploy
```
npx wrangler pages deploy . --project-name=qris-site --branch=main
```
Database D1: `qris-db` (binding `DB`, lihat `wrangler.toml`).
