(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var tab = 'login';

  /* Sudah login? langsung ke dashboard */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.user) location.replace('/app/'); })
    .catch(function () {});

  function setTab(t) {
    tab = t;
    $('#tabLogin').classList.toggle('is-on', t === 'login');
    $('#tabRegister').classList.toggle('is-on', t === 'register');
    $('#bizField').hidden = t !== 'register';
    $('#authBtn').textContent = t === 'register' ? 'Daftar' : 'Masuk';
    $('#authMsg').hidden = true;
  }

  $('#tabLogin').addEventListener('click', function () { setTab('login'); });
  $('#tabRegister').addEventListener('click', function () { setTab('register'); });

  $('#authForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var payload = { email: $('#email').value, password: $('#password').value };
    if (tab === 'register') payload.business_name = $('#business').value;

    var btn = $('#authBtn');
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    $('#authMsg').hidden = true;

    fetch(tab === 'register' ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Gagal memproses.');
        location.replace('/app/');
      })
      .catch(function (err) {
        var m = $('#authMsg');
        m.hidden = false;
        m.textContent = err.message;
        btn.disabled = false;
        btn.textContent = tab === 'register' ? 'Daftar' : 'Masuk';
      });
  });
})();
