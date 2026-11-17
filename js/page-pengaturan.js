(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) { location.href = '/app/'; return; }
    $('#business').value = u.business_name || '';
    $('#email').value = u.email || '';
  });

  $('#profileForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#profileMsg');
    fetch('/api/me/profile', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: $('#business').value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        msg.hidden = false;
        msg.className = 'banner' + (res.ok ? '' : ' banner--err');
        msg.textContent = res.ok ? 'Profil tersimpan.' : (res.d.error || 'Gagal menyimpan.');
        if (res.ok) location.reload();
      })
      .catch(function () { msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = 'Gagal menyimpan.'; });
  });

  $('#passForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#passMsg');
    fetch('/api/me/password', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: $('#cur').value, new_password: $('#next').value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        msg.hidden = false;
        msg.className = 'banner' + (res.ok ? '' : ' banner--err');
        msg.textContent = res.ok ? 'Password diperbarui.' : (res.d.error || 'Gagal memperbarui.');
        if (res.ok) { $('#cur').value = ''; $('#next').value = ''; }
      })
      .catch(function () { msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = 'Gagal memperbarui.'; });
  });

  $('#logout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {})
      .finally(function () { location.href = '/app/'; });
  });
})();
