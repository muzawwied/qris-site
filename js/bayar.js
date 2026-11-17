/* Halaman pembayaran publik: muat tagihan, tampilkan QR, pantau status. */
(function () {
  'use strict';

  var fmt = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); };
  var fmtDate = function (iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  };

  var id = new URLSearchParams(location.search).get('id') || '';
  if (!id) {
    var seg = location.pathname.replace(/\/+$/, '').split('/');
    if (seg.length && /^pay_|^usr_/.test(seg[seg.length - 1])) id = seg[seg.length - 1];
  }

  var $ = function (s) { return document.querySelector(s); };
  var loading = $('#loading');
  var content = $('#content');
  var errorBox = $('#errorBox');
  var statusLabel = $('#statusLabel');
  var qrImg = $('#qrImg');
  var qrBox = $('#qrBox');
  var qrFallback = $('#qrFallback');
  var qrLink = $('#qrLink');
  var demoArea = $('#demoArea');
  var paidBox = $('#paidBox');
  var simulateBtn = $('#simulateBtn');
  var countdownEl = $('#countdown');
  var bar = $('#bar');

  var current = null;
  var pollTimer = null;
  var tickTimer = null;

  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  function fail(msg) {
    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (errorBox) { errorBox.hidden = false; errorBox.textContent = msg; }
  }

  function setStatus(status) {
    if (!statusLabel) return;
    var map = {
      paid: ['Sudah dibayar', 'status-label status-label--paid'],
      pending: ['Menunggu', 'status-label status-label--wait'],
      expired: ['Kedaluwarsa', 'status-label status-label--dead'],
      failed: ['Gagal', 'status-label status-label--dead']
    };
    var cfg = map[status] || map.pending;
    statusLabel.className = cfg[1];
    statusLabel.innerHTML = '<i></i> ' + cfg[0];
    document.body.classList.toggle('is-done', status !== 'pending');
  }

  function renderCountdown() {
    if (!current) return;
    if (current.status !== 'pending') {
      if (countdownEl) countdownEl.textContent = current.status === 'paid' ? 'Pembayaran selesai' : 'Tagihan tidak aktif';
      return;
    }
    var end = Date.parse(current.expires_at || '');
    var start = Date.parse(current.created_at || current.created_date || '') || (end - 15 * 60000);
    var ms = end - Date.now();
    var total = Math.max(end - start, 1);
    var left = Math.max(ms, 0);
    if (bar) bar.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + '%';
    if (!isFinite(ms) || ms <= 0) {
      if (countdownEl) countdownEl.textContent = 'Tagihan kedaluwarsa';
      return;
    }
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    if (countdownEl) countdownEl.textContent = 'Berlaku ' + m + ':' + String(s).padStart(2, '0') + ' lagi';
  }

  function render(p) {
    current = p;
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;

    var merchant = p.merchant_name || 'Penjual';
    $('#merchantName').textContent = merchant;
    $('#merchantMark').textContent = merchant.trim().charAt(0).toUpperCase() || 'Q';
    $('#title').textContent = p.description || 'Pembayaran QRIS';
    $('#amount').textContent = fmt(p.amount);
    $('#payId').firstChild.nodeValue = p.id;
    $('#payFee').textContent = p.fee ? fmt(p.fee) : 'Gratis';
    $('#payExp').textContent = fmtDate(p.expires_at);

    setStatus(p.status);
    renderCountdown();

    var big = $('#bigQrLink');
    if (big) big.href = '/qris/' + encodeURIComponent(p.id);
    var save = $('#saveQr');
    if (save) save.href = p.qr_image || ('/qris/' + encodeURIComponent(p.id));

    if (p.qr_image) {
      qrImg.src = p.qr_image;
      qrImg.hidden = false;
      if (qrFallback) qrFallback.hidden = true;
      qrImg.onerror = function () {
        if (qrBox) qrBox.hidden = true;
        if (qrFallback) qrFallback.hidden = false;
        if (qrLink) qrLink.href = p.qr_image;
      };
    } else {
      if (qrBox) qrBox.hidden = true;
      if (qrFallback) qrFallback.hidden = false;
    }

    if (paidBox) paidBox.hidden = p.status !== 'paid';
    if (demoArea) demoArea.hidden = p.status !== 'pending' || demoArea.dataset.ready !== '1';
    if (p.status !== 'pending') stopPolling();
  }

  function load(allowDemo) {
    return fetch('/api/pay/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Tagihan tidak ditemukan.');
        render(res.d);
        if (allowDemo) {
          fetch('/api/config')
            .then(function (r) { return r.json(); })
            .then(function (cfg) {
              if (cfg && cfg.mode !== 'live' && demoArea) {
                demoArea.dataset.ready = '1';
                demoArea.hidden = res.d.status !== 'pending';
              }
            })
            .catch(function () {});
        }
      })
      .catch(function (err) { fail(err && err.message ? err.message : 'Gagal memuat tagihan.'); });
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  if (!id) {
    fail('ID tagihan tidak ada di tautan. Contoh: /bayar/pay_xxxx');
  } else {
    load(true);
    pollTimer = setInterval(function () {
      if (!current || current.status !== 'pending') { stopPolling(); return; }
      fetch('/api/pay/' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.id) render(d); })
        .catch(function () {});
    }, 4000);
    tickTimer = setInterval(renderCountdown, 1000);
  }

  var copyBtn = $('#copyId');
  if (copyBtn) {
    copyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!current) return;
      if (navigator.clipboard) navigator.clipboard.writeText(current.id).then(function () { toast('Nomor tagihan disalin.'); });
      else window.prompt('Salin nomor tagihan:', current.id);
    });
  }

  var sharePay = $('#sharePay');
  if (sharePay) {
    sharePay.addEventListener('click', function () {
      var url = location.origin + '/q/' + encodeURIComponent(id);
      if (navigator.share) {
        navigator.share({ title: 'Pembayaran QRIS', text: current ? ('Bayar ' + fmt(current.amount)) : 'Pembayaran QRIS', url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('Tautan QRIS disalin.'); });
      } else {
        window.prompt('Salin tautan:', url);
      }
    });
  }

  if (simulateBtn) {
    simulateBtn.addEventListener('click', function () {
      simulateBtn.disabled = true;
      simulateBtn.textContent = 'Memproses…';
      fetch('/api/demo-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Simulasi gagal.');
          load(false);
        })
        .catch(function (err) {
          simulateBtn.disabled = false;
          simulateBtn.textContent = 'Simulasikan pembayaran lunas';
          if (errorBox) { errorBox.hidden = false; errorBox.textContent = err.message; }
        });
    });
  }
})();
