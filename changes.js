/* ═══════════════════════════════════════════════════════════════
   changes.js — '어디가 바뀌었나' 표시
   · changelog.json 에 적힌 항목 중, 이 기기에서 아직 '확인'하지 않은 버전의 것을
     바뀐 자리에 주황 점선 상자 + '✔ 수정 vX.XX' 칩으로 표시한다.
   · 히어로의 버전 배지를 누르면 수정 내역 목록이 열리고, 항목을 누르면 그 자리로 이동한다.
     [모두 확인] 을 누르면 현재 버전까지 확인한 것으로 기억해 표시가 사라진다.
   · 처음 방문한 기기는 최신 버전 1회분만 보인다.
   · 배포 때마다 changelog.json 에 항목을 추가한다: {id, v, at, page, sel, text?, note}
     (sel 을 비우면 자리 표시 없이 목록에만 나온다)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__CHANGES_READY__) return;
  window.__CHANGES_READY__ = true;

  var SEEN_KEY = 'changes_seen';
  var PAGE = (location.pathname.split('/').pop() || 'index.html');
  if (PAGE === '') PAGE = 'index.html';
  var CUR = (window.SITE_VERSION && window.SITE_VERSION.v) || 'v0.00';

  function vnum(v) { var m = /v?(\d+)\.(\d+)/.exec(v || ''); return m ? (+m[1]) * 1000 + (+m[2]) : 0; }
  function prevOf(v) { var n = vnum(v); return n > 0 ? 'v' + Math.floor((n - 1) / 1000) + '.' + String((n - 1) % 1000).padStart(2, '0') : 'v0.00'; }
  function seen() { try { return localStorage.getItem(SEEN_KEY) || ''; } catch (_) { return ''; } }
  function setSeen(v) { try { localStorage.setItem(SEEN_KEY, v); } catch (_) {} }

  var CSS =
    '.chg-box{outline:2px dashed #E8651A;outline-offset:6px;border-radius:16px}' +
    '.chg-rel{position:relative}' +
    '.chg-chip{position:absolute;top:8px;right:8px;z-index:5;background:#E8651A;color:#fff;font-size:12px;font-weight:800;' +
      'line-height:1;padding:5px 10px;border-radius:999px;box-shadow:0 3px 10px rgba(0,0,0,.18);white-space:nowrap;pointer-events:none;font-family:inherit}' +
    '.card > .chg-chip{top:14px;right:52px}' +
    '.chg-chip.sec{position:static;display:inline-block;margin-left:10px;vertical-align:middle}' +
    '.chg-flash{animation:chgflash 1.2s ease-out 2}' +
    '@keyframes chgflash{0%{box-shadow:0 0 0 0 rgba(232,101,26,.9)}100%{box-shadow:0 0 0 18px rgba(232,101,26,0)}}' +
    '.ver-badge.has-chg,#verTag.has-chg{cursor:pointer;pointer-events:auto;background:rgba(232,101,26,.28);border-color:#FFB37E;color:#fff}' +
    '.ver-badge,#verTag{cursor:pointer;pointer-events:auto}' +
    '#CHGP{position:fixed;right:16px;bottom:84px;z-index:9000;width:min(380px,calc(100vw - 32px));max-height:min(70vh,560px);' +
      'display:none;flex-direction:column;background:#fff;color:#1A2744;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.3);' +
      'border:1px solid #EEE7DF;font-family:inherit;overflow:hidden}' +
    '#CHGP.open{display:flex}' +
    '#CHGP .h{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:linear-gradient(135deg,#E8651A,#C94F0A);color:#fff;font-weight:900;font-size:15px}' +
    '#CHGP .h button{border:none;background:rgba(255,255,255,.25);color:#fff;width:28px;height:28px;border-radius:50%;font-size:16px;cursor:pointer}' +
    '#CHGP .l{overflow:auto;padding:8px 0;flex:1 1 auto}' +
    '#CHGP .pg{font-size:12px;font-weight:800;color:#6B7078;padding:8px 14px 2px;letter-spacing:.3px}' +
    '#CHGP .it{display:block;width:100%;text-align:left;border:none;background:none;padding:10px 14px;cursor:pointer;font-family:inherit;color:#1A2744;border-bottom:1px solid #F3EEE8}' +
    '#CHGP .it:hover{background:#FFF3EA}' +
    '#CHGP .it .v{display:inline-block;font-size:11px;font-weight:800;color:#C94F0A;background:#FFF3EA;border-radius:999px;padding:2px 8px;margin-right:6px}' +
    '#CHGP .it .d{font-size:11.5px;color:#6B7078}' +
    '#CHGP .it .n{display:block;font-size:14px;line-height:1.5;margin-top:4px}' +
    '#CHGP .f{padding:10px 14px;border-top:1px solid #EEE7DF;display:flex;gap:8px;justify-content:flex-end;background:#FBF8F5}' +
    '#CHGP .f button{font-family:inherit;font-size:13.5px;font-weight:800;border-radius:10px;padding:9px 14px;cursor:pointer;border:1px solid #EEE7DF;background:#fff;color:#1A2744}' +
    '#CHGP .f button.ok{background:#1A2744;color:#fff;border-color:#1A2744}' +
    '#CHGP .empty{padding:22px 14px;color:#6B7078;font-size:14px;text-align:center}' +
    '@media print{.chg-box{outline:none}.chg-chip,#CHGP{display:none !important}}';

  var all = [], mine = [], marked = {};

  function isNew(e) { return vnum(e.v) > vnum(baseline()); }
  function baseline() { var s = seen(); return s ? s : prevOf(CUR); }

  function findTarget(e) {
    var list;
    if (!e.sel) return null;          /* sel 이 없으면 목록에만 보이는 항목 */
    try { list = document.querySelectorAll(e.sel); } catch (_) { return null; }
    if (!list.length) return null;
    if (!e.text) return list[0];
    for (var i = 0; i < list.length; i++) if ((list[i].textContent || '').indexOf(e.text) >= 0) return list[i];
    return null;
  }
  function mark(e, el) {
    if (marked[e.id]) return;
    marked[e.id] = el;
    el.setAttribute('data-chg', e.id);
    var chip = document.createElement('span');
    chip.className = 'chg-chip'; chip.textContent = '✔ 수정 ' + e.v;
    if (el.tagName === 'SECTION') {
      var h2 = el.querySelector('h2'); chip.className += ' sec';
      (h2 || el).appendChild(chip);
    } else {
      el.classList.add('chg-box');
      if (getComputedStyle(el).position === 'static') el.classList.add('chg-rel');
      el.appendChild(chip);
    }
  }
  function unmarkAll() {
    Object.keys(marked).forEach(function (id) {
      var el = marked[id];
      el.classList.remove('chg-box', 'chg-rel'); el.removeAttribute('data-chg');
      var c = el.querySelector('.chg-chip'); if (c) c.remove();
    });
    marked = {};
  }
  /* 렌더러 페이지는 내용이 나중에 그려지므로 대상이 나타날 때까지 기다린다 */
  function markAll() {
    var pend = mine.filter(function (e) { return !marked[e.id]; });
    pend.forEach(function (e) { var el = findTarget(e); if (el) mark(e, el); });
    return mine.every(function (e) { return marked[e.id] || !e.sel; });
  }
  function waitAndMark() {
    if (markAll() || !window.MutationObserver) return;
    var mo = new MutationObserver(function () { if (markAll()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 6000);
  }

  function goTo(e) {
    var el = marked[e.id] || findTarget(e);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('chg-flash'); void el.offsetWidth; el.classList.add('chg-flash');
    setTimeout(function () { el.classList.remove('chg-flash'); }, 2600);
  }

  /* ── 패널 ── */
  var panel;
  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div'); panel.id = 'CHGP';
    document.body.appendChild(panel);
    document.addEventListener('click', function (ev) {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(ev.target) || ev.target.closest('.ver-badge,#verTag')) return;
      panel.classList.remove('open');
    }, true);
    return panel;
  }
  function renderPanel() {
    var p = buildPanel();
    var items = all.filter(isNew);
    if (PAGE !== 'index.html') items = items.filter(function (e) { return e.page === PAGE; });
    var h = '<div class="h"><span>📝 수정 내역' + (items.length ? ' · ' + items.length + '곳' : '') + '</span><button type="button" aria-label="닫기" id="CHGX">✕</button></div><div class="l">';
    if (!items.length) {
      h += '<div class="empty">아직 확인하지 않은 수정이 없습니다.<br><span style="font-size:12.5px">현재 ' + CUR + '</span></div>';
    } else if (PAGE === 'index.html') {
      var byPage = {};
      items.forEach(function (e) { (byPage[e.page] = byPage[e.page] || []).push(e); });
      Object.keys(byPage).forEach(function (pg) {
        h += '<div class="pg">' + pageName(pg) + '</div>';
        byPage[pg].forEach(function (e) { h += item(e); });
      });
    } else {
      items.forEach(function (e) { h += item(e); });
    }
    h += '</div><div class="f">' +
      (items.length ? '<button type="button" class="ok" id="CHGOK">모두 확인 (표시 지우기)</button>' : '') +
      '</div>';
    p.innerHTML = h;
    p.querySelector('#CHGX').onclick = function () { p.classList.remove('open'); };
    var ok = p.querySelector('#CHGOK');
    if (ok) ok.onclick = function () { setSeen(CUR); unmarkAll(); updateBadge(); renderPanel(); };
    Array.prototype.forEach.call(p.querySelectorAll('.it'), function (b) {
      b.onclick = function () {
        var e = all.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
        if (!e) return;
        if (e.page !== PAGE) { location.href = e.page + '#chg=' + e.id; return; }
        p.classList.remove('open'); goTo(e);
      };
    });
  }
  function item(e) {
    return '<button type="button" class="it" data-id="' + e.id + '"><span class="v">' + esc(e.v) + '</span><span class="d">' + esc(e.at) + '</span><span class="n">' + esc(e.note) + '</span></button>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NAMES = { 'index.html': '메인', 'strategy.html': '이달의 이슈 · 영업전략', 'sales-guide.html': '특약나열식 제안의 문제점', 'receipt-guide.html': '상담 1일차 · 의료비 영수증', 'priority-guide.html': '상담 2일차 · 중증질환과 보험', 'bias-guide.html': '고객이 범하는 인지적 오류', 'design-guide.html': '상담 4일차 · 보험설계의 기술', 'practical-guide.html': '상담 실전설계', 'lung-cancer-guide.html': '폐암 가이드', 'breast-cancer-guide.html': '유방암 가이드', 'cancer-guide.html': '항암치료 가이드', 'corporate-guide.html': '법인컨설팅 가이드' };
  function pageName(pg) { return NAMES[pg] || pg; }

  /* ── 버전 배지 연결 ── */
  function badge() { return document.getElementById('verTag') || document.querySelector('.ver-badge'); }
  function updateBadge() {
    var b = badge(); if (!b) return;
    var n = all.filter(isNew).filter(function (e) { return PAGE === 'index.html' || e.page === PAGE; }).length;
    var base = (window.SITE_VERSION ? window.SITE_VERSION.v + ' · ' + window.SITE_VERSION.at : CUR);
    var dot = b.querySelector('.dot');
    b.textContent = base + (n ? ' · 수정 ' + n + '곳' : '');
    if (dot) b.insertBefore(dot, b.firstChild);
    b.classList.toggle('has-chg', n > 0);
    b.setAttribute('role', 'button'); b.title = '수정 내역 보기';
    if (!b.__chgBound) {
      b.__chgBound = true;
      b.addEventListener('click', function (ev) {
        ev.stopPropagation(); renderPanel(); buildPanel().classList.toggle('open');
      });
    }
  }

  function start() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    fetch('changelog.json?_=' + Date.now()).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      all = Array.isArray(list) ? list : [];
      mine = all.filter(function (e) { return e.page === PAGE && isNew(e); });
      updateBadge();
      waitAndMark();
      /* 메인 목록에서 넘어온 경우(#chg=id) 해당 자리로 이동 */
      var m = /[#&]chg=([\w-]+)/.exec(location.hash);
      if (m) {
        var e = all.filter(function (x) { return x.id === m[1] && x.page === PAGE; })[0];
        if (e) { var tries = 0; (function tick() { var el = findTarget(e); if (el) { goTo(e); } else if (++tries < 30) setTimeout(tick, 200); })(); }
      }
    }).catch(function () { updateBadge(); });
    /* 버전 배지가 version.js 에서 나중에 붙는 경우를 대비 */
    if (!badge()) { var n = 0; var t = setInterval(function () { if (badge() || ++n > 20) { clearInterval(t); updateBadge(); } }, 100); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
