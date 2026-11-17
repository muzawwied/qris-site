(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var id = new URLSearchParams(location.search).get('id') || '';
  if (!id) {
    var seg = location.pathname.replace(/\/+$/, '').split('/');
    if (seg.length && /^pay_/.test(seg[seg.length - 1])) id = seg[seg.length - 1];
  }
  var current = null;
  var timer = null;

  function toast(m) {
    var el = $('#toast'); if (!el) return;
    el.textContent = m; el.classList.add('is-on');
    setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }
  function fmt(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }

  function statusUi(status) {
    var el = $('#status');
    var map = {
      paid: ['Sudah dibayar', ''],
      pending: ['Menunggu pembayaran', ''],
      expired: ['Kedaluwarsa', 'color:var(--danger)'],
      failed: ['Gagal', 'color:var(--danger)']
    };
    var cfg = map[status] || map.pending;
    el.innerHTML = '<i></i> ' + cfg[0];
    el.setAttribute('style', cfg[1] || '');
    if (status === 'paid') $('#paidNote').hidden = false;
  }

  function render(p) {
    current = p;
    $('#card').hidden = false;
    $('#merchant').textContent = p.merchant_name || 'QRIS';
    $('#amount').textContent = fmt(p.amount);
    $('#desc').textContent = p.description || '';
    $('#qrImg').src = p.qr_image || '';
    $('#checkoutLink').href = '/bayar/' + encodeURIComponent(p.id);
    statusUi(p.status);
    tick();
  }

  function tick() {
    var el = $('#timer');
    if (!current) return;
    if (current.status !== 'pending') {
      el.textContent = current.status === 'paid' ? 'Pembayaran selesai' : 'Tagihan tidak aktif';
      return;
    }
    var ms = Date.parse(current.expires_at || '') - Date.now();
    if (!isFinite(ms) || ms <= 0) { el.textContent = 'Tagihan kedaluwarsa'; return; }
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    el.textContent = 'Berlaku ' + m + ':' + String(s).padStart(2, '0');
  }

  function load() {
    fetch('/api/pay/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'not found');
        render(res.d);
        setInterval(function () {
          if (!current || current.status !== 'pending') return;
          fetch('/api/pay/' + encodeURIComponent(id)).then(function (r) { return r.json(); })
            .then(function (d) { if (d && d.id) render(d); }).catch(function () {});
        }, 6000);
      })
      .catch(function () {
        $('#card').hidden = true;
        $('#errorCard').hidden = false;
      });
  }

  if (!id) {
    $('#errorCard').hidden = false;
  } else {
    load();
    timer = setInterval(tick, 1000);
  }

  $('#shareBtn').addEventListener('click', function () {
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: 'Pembayaran QRIS', text: current ? ('Bayar ' + fmt(current.amount)) : 'Pembayaran QRIS', url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Tautan disalin.'); });
    } else {
      window.prompt('Salin tautan ini:', url);
    }
  });

  $('#downloadBtn').addEventListener('click', function () {
    if (!current || !current.qr_image) { toast('QR belum siap.'); return; }
    var a = document.createElement('a');
    a.href = current.qr_image;
    a.download = 'qris-' + (current.reference || current.id) + '.png';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
})();
