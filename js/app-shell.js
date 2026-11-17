/* Shell aplikasi: sidebar, cek sesi, logout, toggle mobile. */
(function () {
  'use strict';

  var NAV = [
    { href: '/app/', label: 'Ringkasan', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
    { href: '/app/transaksi/', label: 'Transaksi', icon: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' },
    { href: '/app/statistik/', label: 'Statistik', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
    { href: '/app/transaksi/laporan/', label: 'Laporan', icon: 'M12 3v11M8 11l4 4 4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2' },
    { href: '/app/penarikan/', label: 'Penarikan', icon: 'M12 3v13M7 11l5 5 5-5M4 21h16' },
    { href: '/app/integrasi/', label: 'Integrasi & API', icon: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1' },
    { href: '/app/pengaturan/', label: 'Pengaturan', icon: '<svg width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'currentColor\' fill-rule=\'evenodd\' aria-hidden=\'true\'><path d=\'M10.61 4.83 L10.21 2.77 L13.79 2.77 L13.39 4.83 L16.08 5.95 L17.26 4.21 L19.79 6.74 L18.05 7.92 L19.17 10.61 L21.23 10.21 L21.23 13.79 L19.17 13.39 L18.05 16.08 L19.79 17.26 L17.26 19.79 L16.08 18.05 L13.39 19.17 L13.79 21.23 L10.21 21.23 L10.61 19.17 L7.92 18.05 L6.74 19.79 L4.21 17.26 L5.95 16.08 L4.83 13.39 L2.77 13.79 L2.77 10.21 L4.83 10.61 L5.95 7.92 L4.21 6.74 L6.74 4.21 L7.92 5.95 Z M15.5 12 A3.5 3.5 0 1 0 8.5 12 A3.5 3.5 0 1 0 15.5 12 Z\'/></svg>' }
  ];

  var path = location.pathname.replace(/\/index\.html$/, '/');
  if (path.charAt(path.length - 1) !== '/') path += '/';
  var current = path;
  if (path.indexOf('/app/transaksi/laporan/') === 0) current = '/app/transaksi/laporan/';
  if (path.indexOf('/app/penarikan/') === 0) current = '/app/penarikan/';
  if (path.indexOf('/app/pengaturan/') === 0) current = '/app/pengaturan/';

  function icon(path) {
    if (path.indexOf('<svg') === 0) return path;
    var inner = path.charAt(0) === '<' ? path : '<path d="' + path + '"/>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  function render(user) {
    var host = document.getElementById('shell');
    if (!host) return;

    if (!document.getElementById('side')) {
      var side = document.createElement('aside');
      side.className = 'side';
      side.id = 'side';
      side.innerHTML =
        '<div class="side__top">' +
        '<a class="side__brand" href="/"><img class="brand__logo" src="/assets/brand/icon-48.png" srcset="/assets/brand/icon-48.png 1x, /assets/brand/icon-192.png 4x" width="30" height="30" alt=""> <span class="brand__name">Clinqoo</span></a>' +
        '<button class="side__close" id="sideClose" aria-label="Tutup menu">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        '</button></div>' +
        '<div class="side__label">Menu</div>' +
        '<nav class="side__nav">' +
        NAV.map(function (n) {
          return '<a class="side__link' + (n.href === current ? ' is-active' : '') + '" href="' + n.href + '">' +
            icon(n.icon) + '<span>' + n.label + '</span></a>';
        }).join('') +
        '</nav>' +
        '<div class="side__label" style="margin-top:10px">Publik</div>' +
        '<nav class="side__nav">' +
        '<a class="side__link" href="/">' + icon('M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z') + '<span>Halaman utama</span></a>' +
        '<a class="side__link" href="/docs/">' + icon('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4') + '<span>Dokumentasi</span></a>' +
        '</nav>' +
        '<div class="side__foot">' +
        '<div class="side__user"><span class="side__avatar" id="sideAvatar"></span><div class="side__meta"><b id="sideName">—</b><span id="sideEmail">—</span></div></div>' +
        '<button class="side__logout" id="sideLogout">' + icon('M15 17l5-5-5-5M20 12H9M12 4H5v16h7') + '<span>Keluar</span></button>' +
        '</div>';
      host.insertBefore(side, host.firstChild);

      var backdrop = document.createElement('div');
      backdrop.className = 'side__backdrop';
      backdrop.id = 'sideBackdrop';
      host.appendChild(backdrop);

      var toggle = document.createElement('button');
      toggle.className = 'side__toggle';
      toggle.setAttribute('aria-label', 'Buka menu');
      toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      host.appendChild(toggle);
      function openSide() {
        side.classList.add('is-open');
        backdrop.classList.add('is-on');
        document.body.style.overflow = 'hidden';
      }
      function closeSide() {
        side.classList.remove('is-open');
        backdrop.classList.remove('is-on');
        document.body.style.overflow = '';
      }
      toggle.addEventListener('click', function () {
        if (side.classList.contains('is-open')) closeSide(); else openSide();
      });
      backdrop.addEventListener('click', closeSide);
      var closeBtn = document.getElementById('sideClose');
      if (closeBtn) closeBtn.addEventListener('click', closeSide);
      side.addEventListener('click', function (ev) {
        if (ev.target.closest('.side__link')) closeSide();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') closeSide();
      });

      document.getElementById('sideLogout').addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
          .catch(function () {})
          .finally(function () { location.href = '/masuk/'; });
      });
    }

    if (user) {
      var name = document.getElementById('sideName');
      var mail = document.getElementById('sideEmail');
      if (name) name.textContent = user.business_name || 'Usaha';
      var av = document.getElementById('sideAvatar');
      if (av) {
        var initial = ((user.business_name || 'U').trim().charAt(0) || 'U').toUpperCase();
        av.innerHTML = user.logo ? '<img alt="" src="' + user.logo + '">' : initial;
        av.classList.toggle('has-photo', !!user.logo);
      }
      if (mail) { mail.textContent = user.email || ''; mail.title = user.email || ''; }
      if (name) name.title = user.business_name || '';
    }
  }

  /* Sesi: kalau belum login, tampilkan gerbang login di halaman ini */
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var user = d && d.user;
      render(user);
      document.dispatchEvent(new CustomEvent('session', { detail: { user: user } }));
    })
    .catch(function () {
      render(null);
      document.dispatchEvent(new CustomEvent('session', { detail: { user: null } }));
    });
})();
