(function () {
  'use strict';
  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) return;
    var profil = document.getElementById('rowProfil');
    var sesi = document.getElementById('rowSesi');
    var toko = document.getElementById('rowToko');
    if (profil) profil.textContent = u.business_name || u.email || '—';
    if (sesi) sesi.textContent = u.email || '—';
    if (toko) toko.textContent = u.store_slug ? '/' + u.store_slug : '—';
    var merek = document.getElementById('rowMerek');
    if (merek) {
      var label = { coklat: 'Coklat', biru: 'Biru', hitam: 'Hitam' };
      merek.textContent = label[u.brand_accent] || 'Ikut tema';
    }
    var notif = document.getElementById('rowNotif');
    if (notif) {
      fetch('/api/me/telegram', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) { notif.textContent = d && d.linked ? 'Aktif' : 'Belum aktif'; })
        .catch(function () { notif.textContent = '—'; });
    }
  });
})();
