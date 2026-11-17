(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); };
  var ymd = function (d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };

  function setRange(from, to) {
    $('#from').value = from;
    $('#to').value = to;
    refresh();
  }

  function refresh() {
    var from = $('#from').value;
    var to = $('#to').value;
    var msg = $('#msg');
    if (!from || !to) return;
    if (from > to) {
      msg.hidden = false;
      msg.className = 'banner banner--err';
      msg.textContent = 'Tanggal "Dari" harus lebih awal dari "Sampai".';
      return;
    }
    msg.hidden = true;
    $('#download').href = '/api/me/report?format=csv&from=' + from + '&to=' + to;
    $('#rangeLabel').textContent = from + ' sampai ' + to;

    fetch('/api/me/report?from=' + from + '&to=' + to, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var s = d.summary || {};
        $('#rCount').textContent = (s.count || 0) + ' transaksi';
        $('#rPaid').textContent = (s.paid_count || 0) + ' transaksi';
        $('#rGross').textContent = fmt(s.gross);
        $('#rFee').textContent = fmt(s.fee);
        $('#rNet').textContent = fmt(s.net);
      })
      .catch(function () {
        msg.hidden = false;
        msg.className = 'banner banner--err';
        msg.textContent = 'Gagal memuat ringkasan.';
      });
  }

  document.querySelectorAll('[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var now = new Date();
      var p = btn.dataset.preset;
      if (p === 'month') setRange(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now));
      else if (p === 'last') setRange(ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0)));
      else {
        var days = parseInt(p, 10);
        var from = new Date(now.getTime() - (days - 1) * 86400000);
        setRange(ymd(from), ymd(now));
      }
    });
  });

  ['#from', '#to'].forEach(function (sel) {
    $(sel).addEventListener('change', refresh);
  });

  document.addEventListener('session', function (ev) {
    if (!ev.detail.user) { location.href = '/masuk/'; return; }
    var now = new Date();
    setRange(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now));
  });
})();
