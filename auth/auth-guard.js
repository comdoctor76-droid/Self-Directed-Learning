/* ═══════════════════════════════════════════════════════════════
   auth-guard.js — 학습 페이지에 심는 로그인 모듈 (탑재할 때 각 페이지 <head> 맨 앞에 넣는다)
     <script src="auth/auth-config.js"></script>
     <script src="auth/auth-guard.js"></script>
   · 이 기기에 24시간 이내 로그인 기록이 없으면 로그인 화면으로 보내고, 로그인 후 원래 주소(카드 링크 포함)로 돌아온다.
   · 로그인 상태면 학습 기록(페이지 진입·섹션 보기·카드 열기·그림 확대)을 자동으로 남긴다.
     기존 페이지 코드는 고치지 않고 OM/OI/OMSIB 함수를 바깥에서 감싸 기록한다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__AUTH_GUARD__) return;
  window.__AUTH_GUARD__ = true;

  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/auth-guard\.js(\?.*)?$/, '') : 'auth/';
  var C = window.AUTH_CONFIG || {};
  var SESS_KEY = 'sdl_auth_session';
  var PAGE = location.pathname.split('/').pop() || 'index.html';

  function sess() {
    try {
      var s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
      if (!s || !s.emp || !s.exp || Date.now() > s.exp) return null;
      return s;
    } catch (_) { return null; }
  }
  function toLogin(reason) {
    var next = location.href;
    location.replace(BASE + 'login.html?next=' + encodeURIComponent(next) + (reason ? '&why=' + reason : ''));
  }

  /* 1) 동기 확인 — 화면이 그려지기 전에 판단한다 */
  var s = sess();
  if (!s) { document.documentElement.style.visibility = 'hidden'; toLogin(); return; }
  if (s.mustChange || !s.consent) { document.documentElement.style.visibility = 'hidden'; toLogin('setup'); return; }

  /* 2) 엔진 불러오기 (운영 모드는 supabase 라이브러리 먼저) */
  function load(src) { return new Promise(function (ok, no) { var x = document.createElement('script'); x.src = src; x.onload = ok; x.onerror = no; document.head.appendChild(x); }); }
  var ready = (C.mode === 'supabase' ? load(BASE + 'vendor/supabase.js') : Promise.resolve())
    .then(function () { return window.AUTH ? null : load(BASE + 'auth-core.js'); });

  /* 서버 쪽 확인: 계정이 삭제됐거나 초기화됐으면 다시 로그인 */
  ready.then(function () { return window.AUTH.refresh(); }).then(function (r) {
    if (!r) { window.AUTH.clearSession(); toLogin('expired'); }
    else if (r.mustChange) toLogin('setup');
  }).catch(function () { /* 네트워크 오류 시에는 이 기기 기록을 믿고 계속 */ });

  /* 3) 학습 기록 */
  var queue = [];
  function log(kind, target, title) {
    var ev = { page: PAGE, kind: kind, target: String(target || '').slice(0, 200), title: String(title || '').replace(/<[^>]+>/g, '').trim().slice(0, 200) };
    if (window.AUTH) window.AUTH.log(ev); else queue.push(ev);
  }
  ready.then(function () { queue.splice(0).forEach(function (ev) { window.AUTH.log(ev); }); });

  function title(key) {
    try { if (window.MD && window.MD[key]) return window.MD[key].t; } catch (_) {}
    try { if (window.IMGDATA && window.IMGDATA[key]) return window.IMGDATA[key].name; } catch (_) {}
    return '';
  }
  function wrap(name, kind) {
    var f = window[name];
    if (typeof f !== 'function' || f.__logged) return;
    var g = function (a, b) {
      try { var k = (name === 'OMSIB') ? b : a; log(kind, k, title(k)); } catch (_) {}
      return f.apply(this, arguments);
    };
    g.__logged = true; window[name] = g;
  }
  function badge() {
    var hero = document.querySelector('.hero'); if (!hero || hero.querySelector('.auth-chip')) return;
    var st = document.createElement('style');
    st.textContent = '.hero{position:relative}.auth-chip{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:8px;' +
      'font-size:12.5px;font-weight:700;color:rgba(255,255,255,.88);background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);' +
      'border-radius:999px;padding:5px 6px 5px 12px;white-space:nowrap;z-index:3}.auth-chip button{font:inherit;font-size:12px;font-weight:800;border:none;' +
      'border-radius:999px;padding:4px 10px;background:rgba(255,255,255,.9);color:#1A2744;cursor:pointer}.auth-chip a{color:#FFB37E;text-decoration:none}' +
      '@media print{.auth-chip{display:none}}';
    document.head.appendChild(st);
    var c = document.createElement('span'); c.className = 'auth-chip';
    c.innerHTML = '👤 <span>' + (s.name || s.emp) + '님</span>' + (s.role === 'admin' ? ' · <a href="' + BASE + 'admin.html">관리자</a>' : '') +
      '<button type="button">로그아웃</button>';
    c.querySelector('button').onclick = function () {
      ready.then(function () { return window.AUTH.logout(); }).finally(function () { location.href = BASE + 'login.html?next=' + encodeURIComponent(location.href); });
    };
    hero.appendChild(c);
  }
  function start() {
    log('page', location.hash || '', document.title);
    wrap('OM', 'card'); wrap('OMSIB', 'card'); wrap('OI', 'image');
    badge();
    if (window.IntersectionObserver) {
      var seen = {};
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting || seen[e.target.id]) return;
          seen[e.target.id] = 1;
          var h = e.target.querySelector('h2');
          log('section', '#' + e.target.id, h ? h.textContent : '');
        });
      }, { threshold: 0.35 });
      var watch = function () { Array.prototype.forEach.call(document.querySelectorAll('section[id]'), function (x) { if (!x.__io) { x.__io = 1; io.observe(x); } }); };
      watch();
      /* 렌더러 페이지는 섹션을 나중에 그리므로 잠시 지켜본다 */
      if (window.MutationObserver) { var mo = new MutationObserver(watch); mo.observe(document.body, { childList: true, subtree: true }); setTimeout(function () { mo.disconnect(); }, 8000); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
