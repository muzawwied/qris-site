(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var MAP = { hitam: '#1a1a18', coklat: '#8a5a2b', biru: '#2b4a6f', '': '#1a1a18' };
  var user = null;

  function toast(m) { var el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('is-on'); setTimeout(function () { el.classList.remove('is-on'); }, 2200); }

  function paint(accent) {
    var c = MAP[accent || ''] || '#1a1a18';
    $('#pvMark').style.background = c;
    var btns = document.querySelectorAll('.brand__sw');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-on', (btns[i].getAttribute('data-accent') || '') === (accent || ''));
    }
  }

  document.addEventListener('session', function (ev) {
    user = ev.detail.user;
    if (!user) { location.href = '/masuk/'; return; }
    $('#pvName').textContent = user.business_name || 'Nama toko';
    var mark = $('#pvMark');
    if (user.logo) {
      mark.textContent = '';
      var img = document.createElement('img');
      img.src = user.logo; img.alt = '';
      mark.appendChild(img);
    } else {
      mark.textContent = (user.business_name || 'K').trim().charAt(0).toUpperCase();
    }
    paint(user.brand_accent || '');
  });

  document.querySelectorAll('.brand__sw').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var accent = btn.getAttribute('data-accent') || '';
      paint(accent);
      fetch('/api/me/profile', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_accent: accent })
      }).then(function (r) { return r.json(); }).then(function (d) {
        var msg = $('#brandMsg');
        if (d && d.user) { msg.hidden = true; toast('Warna aksen disimpan.'); }
        else { msg.hidden = false; msg.className = 'banner banner--err'; msg.textContent = (d && d.error) || 'Gagal menyimpan.'; }
      }).catch(function () { toast('Gagal menyimpan.'); });
    });
  });
})();
