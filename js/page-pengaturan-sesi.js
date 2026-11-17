(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  document.addEventListener('session', function (ev) {
    var u = ev.detail.user;
    if (!u) { location.href = '/masuk/'; return; }
    $('#sesEmail').textContent = u.email || '—';
    $('#sesName').textContent = u.business_name || '—';
    var ua = navigator.userAgent;
    var device = /iPhone|iPad|Android/i.test(ua) ? 'Perangkat seluler' : 'Komputer';
    var browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Peramban';
    $('#sessionLine').textContent = device + ' · ' + browser;
  });

  $('#logout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {})
      .finally(function () { location.href = '/masuk/'; });
  });
})();
