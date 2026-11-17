(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2400); }
  function say(m, err) { var b = $('#tgMsg'); b.hidden = !m; b.className = 'banner' + (err ? ' banner--err' : ''); b.textContent = m || ''; }

  function render(d) {
    var badge = $('#tgBadge');
    var on = !!(d && d.linked);
    badge.className = 'status-label status-label--' + (on ? 'paid' : 'wait');
    badge.textContent = on ? 'Aktif' : 'Belum aktif';
    $('#tgState').textContent = on ? 'Pembayaran masuk dikirim ke chat Telegram kamu.' : 'Hubungkan sekali, lalu notifikasi berjalan sendiri.';
    $('#tgOn').hidden = !on;
    $('#tgOff').hidden = on;
    if (on && d.linked_at) {
      try {
        $('#tgSince').textContent = 'Terhubung sejak ' + new Date(d.linked_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) + '.';
      } catch (e) {}
    }
    if (!d.ready) say('Bot belum dipasang di server. Hubungi admin untuk mengaktifkan.', true);
  }

  function load() {
    fetch('/api/me/telegram', { credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { location.href = '/masuk/'; return; }
        render(res.d);
      })
      .catch(function () { say('Gagal memuat status.', true); });
  }

  document.addEventListener('session', function (ev) { if (!ev.detail.user) location.href = '/masuk/'; });
  load();

  $('#tgLink').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    fetch('/api/me/telegram', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      btn.disabled = false;
      if (d.deep_link) {
        window.open(d.deep_link, '_blank', 'noopener');
        say('Tekan Start di Telegram untuk menyelesaikan tautan.');
      } else {
        $('#tgManual').hidden = false;
        $('#tgCmd').textContent = '/start ' + (d.code || '');
        say('Buka bot lalu kirim perintah di bawah.', false);
      }
    }).catch(function () { btn.disabled = false; say('Gagal membuat kode tautan.', true); });
  });

  $('#tgTest').addEventListener('click', function () {
    fetch('/api/me/telegram', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) toast('Pesan uji dikirim.');
      else say(d.error || 'Gagal mengirim pesan.', true);
    }).catch(function () { say('Gagal mengirim pesan.', true); });
  });

  $('#tgUnlink').addEventListener('click', function () {
    fetch('/api/me/telegram', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unlink' })
    }).then(function (r) { return r.json(); }).then(function () {
      toast('Telegram diputuskan.');
      load();
    });
  });
})();
