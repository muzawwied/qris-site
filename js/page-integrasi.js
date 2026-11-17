(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  var state = { key: '', merchant: '', visible: false };
  var EYE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 12S5.4 5.4 12 5.4 22.2 12 22.2 12 18.6 18.6 12 18.6 1.8 12 1.8 12Z"/><circle cx="12" cy="12" r="3.1"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.6 0 10.2 6 10.2 6a17 17 0 0 1-3.3 3.9"/><path d="M6.4 7.7A17 17 0 0 0 1.8 12S5.4 18 12 18a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3"/></svg>';

  function mask(v) {
    var len = Math.max(18, Math.min(34, (v || '').length));
    return new Array(len + 1).join('\u2022');
  }

  function renderKey() {
    var box = $('#apiKeyBox');
    if (!state.key) { box.textContent = 'Belum ada. Klik ganti API key.'; return; }
    box.textContent = state.visible ? state.key : mask(state.key);
    var btn = $('#toggleKey');
    if (btn) {
      btn.innerHTML = state.visible ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', state.visible ? 'Sembunyikan API key' : 'Tampilkan API key');
      btn.setAttribute('title', state.visible ? 'Sembunyikan API key' : 'Tampilkan API key');
    }
  }

  function loadKey() {
    fetch('/api/me/apikey', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.key = d.api_key || '';
        state.merchant = d.merchant_id || '';
        $('#merchantBox').textContent = state.merchant || '—';
        renderKey();
      })
      .catch(function () {
        $('#apiKeyBox').textContent = 'Gagal memuat API key.';
        $('#merchantBox').textContent = 'Gagal memuat Merchant ID.';
      });
  }

  function copy(text, label) {
    if (!text) { toast(label + ' belum ada.'); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(label + ' disalin.'); });
    else window.prompt('Salin:', text);
  }

  $('#toggleKey').addEventListener('click', function () {
    if (!state.key) return;
    state.visible = !state.visible;
    renderKey();
  });

  $('#copyKey').addEventListener('click', function () { copy(state.key, 'API key'); });
  $('#copyMerchant').addEventListener('click', function () { copy(state.merchant, 'Merchant ID'); });

  $('#rotateKey').addEventListener('click', function () {
    if (!confirm('Ganti API key? Key lama langsung tidak berlaku.')) return;
    fetch('/api/me/apikey', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.api_key) {
          state.key = d.api_key;
          if (d.merchant_id) { state.merchant = d.merchant_id; $('#merchantBox').textContent = d.merchant_id; }
          state.visible = true;
          renderKey();
          toast('Key baru dibuat.');
        }
      })
      .catch(function () { toast('Gagal membuat key.'); });
  });


  /* Playground: buat tagihan uji lalu pantau statusnya */
  var pgTimer = null, pgId = null;
  function rupiah(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }

  function pgRender(d) {
    var box = $('#pgResult');
    if (!d) { box.innerHTML = '<p class="muted" style="margin:0;font-size:13px">Belum ada tagihan uji.</p>'; return; }
    var paid = d.status === 'paid';
    var img = d.qr_image || d.qr_url || '';
    box.innerHTML =
      (paid ? '' : (img ? '<img class="play__qr" src="' + img + '" alt="QRIS tagihan uji">' : '')) +
      '<div class="play__amount">' + rupiah(d.amount) + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<span class="chip ' + (paid ? 'chip--paid' : '') + '">' + String(d.status || 'pending').toUpperCase() + '</span>' +
        '<span class="play__meta">fee ' + rupiah(d.fee) + '</span>' +
      '</div>' +
      '<div class="play__meta" style="margin-top:8px">' + (d.id || '') + '</div>' +
      (paid ? '' :
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
          '<a class="btn btn--ghost btn--sm" href="' + (d.checkout_url || ('/bayar/' + d.id)) + '" target="_blank" rel="noopener">Buka halaman bayar</a>' +
          '<button class="btn btn--ghost btn--sm" id="pgSim">Simulasikan lunas</button>' +
        '</div>') +
      (paid ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Lunas. Saldo akun ikut bertambah.</p>' : '');
    var sim = $('#pgSim');
    if (sim) sim.addEventListener('click', function () {
      sim.disabled = true;
      fetch('/api/demo-pay', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
        .then(function (r) { return r.json(); })
        .then(function () { pgPoll(); })
        .catch(function () { sim.disabled = false; });
    });
  }

  function pgPoll() {
    if (!pgId) return;
    fetch('/api/pay/' + encodeURIComponent(pgId))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.error) return;
        pgRender(d);
        if (d.status === 'paid' || d.status === 'expired' || d.status === 'failed') {
          if (pgTimer) { clearInterval(pgTimer); pgTimer = null; }
        }
      })
      .catch(function () {});
  }

  function pgBuat() {
    var btn = $('#pgRun');
    var amount = parseInt(($('#pgAmount').value || '').replace(/[^0-9]/g, ''), 10);
    var desc = ($('#pgDesc').value || '').trim();
    if (!amount || amount < 1000) { toast('Nominal minimal Rp 1.000.'); return; }
    btn.disabled = true;
    btn.textContent = 'Membuat…';
    fetch('/api/pay', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, description: desc || null })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false;
        btn.textContent = 'Buat tagihan uji';
        if (d.error) { toast(d.error); return; }
        pgId = d.id;
        pgRender(d);
        if (pgTimer) clearInterval(pgTimer);
        pgTimer = setInterval(pgPoll, 3000);
        toast('Tagihan uji dibuat.');
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'Buat tagihan uji'; toast('Gagal membuat tagihan.'); });
  }

  if ($('#pgRun')) $('#pgRun').addEventListener('click', pgBuat);

  fetch('/api/health').then(function (r) { return r.json(); }).then(function (h) {
    $('#hApi').textContent = h.ok ? 'Normal' : 'Gangguan';
    $('#hDb').textContent = h.db === 'ok' ? 'Terhubung' : 'Error';
  }).catch(function () { $('#hApi').textContent = 'Tidak terjangkau'; });

  document.addEventListener('session', function (ev) { if (ev.detail.user) loadKey(); else location.href = '/app/'; });

  /* muat langsung tanpa menunggu event sesi */
  loadKey();
})();
