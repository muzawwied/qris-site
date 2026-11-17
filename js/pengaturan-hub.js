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
  });
})();
