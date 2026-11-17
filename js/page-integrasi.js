(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  function loadKey() {
    fetch('/api/me/apikey', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { $('#apiKeyBox').textContent = d.api_key || 'Belum ada. Klik ganti key.'; })
      .catch(function () { $('#apiKeyBox').textContent = 'Gagal memuat API key.'; });
  }

  $('#copyKey').addEventListener('click', function () {
    var txt = $('#apiKeyBox').textContent || '';
    if (txt.indexOf('qsk_') !== 0) { toast('Belum ada API key.'); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('API key disalin.'); });
    else window.prompt('Salin:', txt);
  });

  $('#rotateKey').addEventListener('click', function () {
    if (!confirm('Ganti API key? Key lama langsung tidak berlaku.')) return;
    fetch('/api/me/apikey', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.api_key) { $('#apiKeyBox').textContent = d.api_key; toast('Key baru dibuat.'); } })
      .catch(function () { toast('Gagal membuat key.'); });
  });

  fetch('/api/health').then(function (r) { return r.json(); }).then(function (h) {
    $('#hApi').textContent = h.ok ? 'Normal' : 'Gangguan';
    $('#hDb').textContent = h.db === 'ok' ? 'Terhubung' : 'Error';
    $('#hMode').textContent = h.mode === 'live' ? 'Live' : 'Percobaan';
  }).catch(function () { $('#hApi').textContent = 'Tidak terjangkau'; });

  document.addEventListener('session', function (ev) { if (ev.detail.user) loadKey(); else location.href = 'dashboard.html'; });
})();
