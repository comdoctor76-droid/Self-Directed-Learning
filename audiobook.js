/* ═══════════════════════════════════════════════════════════════
   audiobook.js — 오디오북 플레이어 (메인 화면·전용 페이지 공용)
   · 목록: data/audiobook.json  { title, author, tracks:[{title, src}] }
   · mp3 는 처음 재생을 누를 때 스트리밍(필요한 만큼만 받으며 재생, 탐색 가능). 저장 파일은 만들지 않는다.
   · 휴대폰: <audio> 로 재생하므로 화면을 꺼도 계속 재생되고, 잠금화면·알림창에 제목/재생/되감기가 나온다(Media Session)
   · 이어듣기: 마지막으로 듣던 위치를 이 기기에 기억한다
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DATA = 'data/audiobook.json';
  var CSS =
    '.ab{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);border-radius:16px;padding:10px 12px 8px;color:#fff;max-width:620px;font-family:inherit;-webkit-user-select:none;user-select:none}' +
    '.ab *{box-sizing:border-box}' +
    '.ab-top{display:flex;align-items:center;gap:10px}' +
    '.ab-pl{flex:0 0 auto;width:46px;height:46px;border-radius:50%;border:0;background:linear-gradient(135deg,#E8651A,#C94F0A);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 14px rgba(0,0,0,.3);-webkit-tap-highlight-color:transparent;padding:0}' +
    '.ab-pl:active{transform:scale(.94)}' +
    '.ab-pl svg{width:22px;height:22px;fill:#fff}' +
    '.ab-tt{min-width:0;flex:1 1 auto;line-height:1.3}' +
    '.ab-tt small{display:block;font-size:12px;font-weight:800;color:#FFB37E;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ab-tt b{display:block;font-size:16px;font-weight:900;word-break:keep-all}' +
    /* 제목 줄 오른쪽 빈칸의 작은 버튼 묶음: 넓은 화면은 한 줄, 좁은 화면은 2×2 */
    '.ab-cl{flex:0 0 auto;display:flex;align-items:center;gap:4px}' +
    '.ab-s{flex:0 0 auto;min-width:36px;height:28px;padding:0 8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-family:inherit;font-size:12px;font-weight:800;border-radius:999px;cursor:pointer;white-space:nowrap;line-height:1;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}' +
    '.ab-s:active{transform:scale(.93)}' +
    '.ab-s[disabled]{opacity:.35;cursor:default}' +
    '.ab-s.ic{width:28px;min-width:28px;padding:0;font-size:14px}' +
    '@media(max-width:520px){.ab-cl{display:grid;grid-template-columns:repeat(2,40px);gap:4px}.ab-s{min-width:0;width:40px;padding:0}.ab-s.ic{width:40px}}' +
    '.ab-row{display:flex;align-items:center;gap:8px;margin-top:6px}' +
    '.ab-time{flex:0 0 auto;font-size:12px;font-weight:700;min-width:38px;text-align:center;opacity:.9;font-variant-numeric:tabular-nums}' +
    '.ab-seek{flex:1 1 auto;min-width:0;height:24px;margin:0;-webkit-appearance:none;appearance:none;background:transparent;touch-action:none}' +
    '.ab-seek::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:linear-gradient(to right,#FFB37E var(--p,0%),rgba(255,255,255,.28) var(--p,0%))}' +
    '.ab-seek::-moz-range-track{height:5px;border-radius:3px;background:rgba(255,255,255,.28)}' +
    '.ab-seek::-moz-range-progress{height:5px;border-radius:3px;background:#FFB37E}' +
    '.ab-seek::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;margin-top:-5.5px;box-shadow:0 1px 4px rgba(0,0,0,.4)}' +
    '.ab-seek::-moz-range-thumb{width:16px;height:16px;border:0;border-radius:50%;background:#fff}' +
    '.ab-pn{display:flex;gap:6px;margin-top:4px}' +
    '.ab-msg{font-size:12.5px;font-weight:700;color:#FFD9BF;margin-top:4px}' +
    '.ab-msg:empty{display:none}' +
    '.ab-list{margin-top:6px;border-top:1px solid rgba(255,255,255,.2);padding-top:4px;max-height:210px;overflow:auto}' +
    '.ab-li{display:flex;align-items:center;gap:8px;padding:7px 4px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700}' +
    '.ab-li i{flex:0 0 22px;font-style:normal;text-align:center;opacity:.8;font-size:12.5px}' +
    '.ab-li.on{background:rgba(255,255,255,.16);color:#FFD9BF}' +
    '.ab-li span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ab-li button{flex:0 0 auto;border:0;background:rgba(255,255,255,.14);color:#FFD9BF;border-radius:8px;font-size:12px;font-weight:800;padding:4px 8px;cursor:pointer;font-family:inherit}' +
    '.ab-empty{font-size:13.5px;opacity:.9;margin-top:6px}';

  var A = null, root = null, data = null, tracks = [], cur = -1, saveAt = 0, opts = {};
  function $(sel) { return root.querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function fmt(t) { if (!isFinite(t)) return '0:00'; t = Math.max(0, Math.floor(t)); var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function pageUrl() { return abs('audiobook.html'); }
  function posKey(src) { return 'ab_pos:' + src; }
  function getPos(src) { try { return parseFloat(localStorage.getItem(posKey(src))) || 0; } catch (e) { return 0; } }
  function setPos(src, t) { try { localStorage.setItem(posKey(src), String(Math.floor(t))); } catch (e) {} }
  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

  function msg(t) { var e = $('.ab-msg'); if (e) e.textContent = t || ''; }

  /* 카카오톡·네이버·인스타 등 '앱 안 브라우저'는 화면을 끄면 소리가 멈춘다 → 크롬/사파리로 열도록 안내 */
  var UA = navigator.userAgent || '', IOS = /iPhone|iPad|iPod/i.test(UA), AND = /Android/i.test(UA);
  var KAKAO = /KAKAOTALK/i.test(UA), LINE = /\bLine\//i.test(UA);
  var INAPP = KAKAO || LINE || /NAVER\(inapp|NAVER\/|Instagram|FBAN|FBAV|DaumApps|everytimeApp|; wv\)/i.test(UA);
  function openExternal() {
    var url = abs(location.pathname.split('/').pop() || 'audiobook.html');
    if (KAKAO) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return true; }
    if (LINE) { var u = new URL(url); u.searchParams.set('openExternalBrowser', '1'); location.href = u.toString(); return true; }
    if (AND) { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'; return true; }
    return false;
  }
  function inAppNotice() {
    var e = $('.ab-msg'); if (!e || !INAPP) return;
    e.innerHTML = '⚠ 앱 안 브라우저에서는 <b>화면을 끄면 소리가 멈춥니다.</b> ' + (IOS && !KAKAO && !LINE ? '우측 메뉴(···)에서 <b>Safari로 열기</b>를 눌러 주세요.' : '<button type="button" class="ab-s" style="width:auto;padding:0 10px;margin-left:4px" id="abExt">외부 브라우저로 열기</button>');
    var b = $('#abExt'); if (b) b.onclick = function () { if (!openExternal()) msg('우측 메뉴(···)에서 Safari로 열어 주세요.'); };
  }

  function render() {
    var n = tracks.length, title = (data && data.title) || '농부의 마음으로 고객을 짓다', author = (data && data.author) || '이승학';
    root.className = 'ab';
    var cl = n ?
      '<div class="ab-cl"><button class="ab-s ab-b15" type="button" aria-label="15초 뒤로" title="15초 뒤로">−15</button>' +
      '<button class="ab-s ab-f15" type="button" aria-label="15초 앞으로" title="15초 앞으로">+15</button>' +
      '<button class="ab-s ab-sp-b" type="button" aria-label="재생 속도" title="재생 속도">1.0×</button>' +
      '<button class="ab-s ic ab-cp" type="button" aria-label="링크 복사" title="링크 복사">🔗</button></div>' :
      '<div class="ab-cl"><button class="ab-s ic ab-cp" type="button" aria-label="링크 복사" title="링크 복사">🔗</button></div>';
    root.innerHTML =
      '<div class="ab-top"><button class="ab-pl" type="button" aria-label="재생"' + (n ? '' : ' disabled') + '>' + ICON_PLAY + '</button>' +
        '<div class="ab-tt"><small>🎧 오디오북 · ' + esc(author) + ' 저' + (n > 1 ? ' · 총 ' + n + '개' : '') + '</small><b>' + esc(title) + '</b></div>' + cl + '</div>' +
      (n ?
        '<div class="ab-row"><span class="ab-time ab-cur">0:00</span><input class="ab-seek" type="range" min="0" max="1000" value="0" aria-label="재생 위치"><span class="ab-time ab-dur">--:--</span></div>' +
        (n > 1 ? '<div class="ab-pn"><button class="ab-s ab-pv" type="button">⏮ 이전</button><button class="ab-s ab-nx" type="button">다음 ⏭</button></div>' : '') +
        '<div class="ab-msg"></div>' +
        (n > 1 ? '<div class="ab-list">' + tracks.map(function (t, i) { return '<div class="ab-li" data-i="' + i + '"><i>' + (i + 1) + '</i><span>' + esc(t.title || ('파트 ' + (i + 1))) + '</span>' + (opts.admin ? '<button type="button" data-del="' + i + '">삭제</button>' : '') + '</div>'; }).join('') + '</div>' : '') +
          (n === 1 && opts.admin ? '<div class="ab-list"><div class="ab-li"><span>' + esc(tracks[0].title || '파트 1') + '</span><button type="button" data-del="0">삭제</button></div></div>' : '')
        : '<div class="ab-empty">오디오북을 준비하고 있습니다. 곧 들으실 수 있어요.</div><div class="ab-msg"></div>');
    wire();
    inAppNotice();
    if (A) syncUI();
  }

  function ensureAudio() {
    if (A) return A;
    A = new Audio(); try { var r0 = parseFloat(localStorage.getItem('ab_rate')); if (r0) A.defaultPlaybackRate = r0; } catch (e) {} A.preload = 'none'; A.setAttribute('playsinline', ''); A.setAttribute('webkit-playsinline', ''); A.controlsList = 'nodownload'; A.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'; try { document.body.appendChild(A); } catch (e) {}   /* display:none 이 아닌 '화면 밖' 요소로 둔다 — 일부 모바일 브라우저는 display:none 오디오를 화면 꺼질 때 멈춘다 */
    A.addEventListener('timeupdate', onTime); A.addEventListener('durationchange', syncUI); A.addEventListener('loadedmetadata', onMeta);
    A.addEventListener('play', syncUI); A.addEventListener('pause', function () { if (cur >= 0) setPos(tracks[cur].src, A.currentTime); syncUI(); });
    A.addEventListener('ended', function () { if (cur >= 0) setPos(tracks[cur].src, 0); if (cur + 1 < tracks.length) load(cur + 1, true); else syncUI(); });
    A.addEventListener('waiting', function () { msg('불러오는 중…'); });
    A.addEventListener('playing', function () { msg(''); });
    A.addEventListener('error', function () { msg('재생할 수 없습니다. 잠시 후 다시 시도해 주세요. (파일이 아직 올라가는 중일 수 있습니다)'); syncUI(); });
    return A;
  }
  function onMeta() {
    if (cur < 0) return;
    var p = getPos(tracks[cur].src);
    if (p > 3 && A.duration && p < A.duration - 5 && !A.__resumed) { try { A.currentTime = p; msg('지난번에 듣던 ' + fmt(p) + ' 부터 이어서 재생합니다'); } catch (e) {} }
    A.__resumed = true; syncUI();
  }
  function onTime() {
    syncUI();
    var now = Date.now();
    if (cur >= 0 && now - saveAt > 5000) { saveAt = now; setPos(tracks[cur].src, A.currentTime); }
    if (navigator.mediaSession && navigator.mediaSession.setPositionState && A.duration && isFinite(A.duration)) {
      try { navigator.mediaSession.setPositionState({ duration: A.duration, playbackRate: A.playbackRate, position: Math.min(A.currentTime, A.duration) }); } catch (e) {}
    }
  }
  function syncUI() {
    if (!root || !tracks.length) return;
    var pl = $('.ab-pl'), playing = A && !A.paused && !A.ended;
    if (pl) { pl.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; pl.setAttribute('aria-label', playing ? '일시정지' : '재생'); }
    var d = A && A.duration && isFinite(A.duration) ? A.duration : 0, c = A ? A.currentTime : 0;
    var cu = $('.ab-cur'), du = $('.ab-dur'), sk = $('.ab-seek');
    if (cu) cu.textContent = fmt(c);
    if (du) du.textContent = d ? fmt(d) : '--:--';
    if (sk && !sk.__drag) { var v = d ? Math.round(c / d * 1000) : 0; sk.value = v; sk.style.setProperty('--p', (v / 10) + '%'); }
    var lis = root.querySelectorAll('.ab-li');
    for (var i = 0; i < lis.length; i++) lis[i].classList.toggle('on', +lis[i].getAttribute('data-i') === cur);
    var pv = $('.ab-pv'), nx = $('.ab-nx'); if (pv) pv.disabled = cur <= 0; if (nx) nx.disabled = cur >= tracks.length - 1;
  }
  function setSession() {
    if (!('mediaSession' in navigator) || cur < 0) return;
    var t = tracks[cur], book = (data && data.title) || '농부의 마음으로 고객을 짓다', au = (data && data.author) || '이승학';
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: tracks.length > 1 ? (t.title || book) : book, artist: au + ' 저', album: '오디오북 · ' + book,
        artwork: [{ src: abs('assets/icons/icon-512.png'), sizes: '512x512', type: 'image/png' }, { src: abs('assets/icons/icon-192.png'), sizes: '192x192', type: 'image/png' }] });
      var ms = navigator.mediaSession;
      ms.setActionHandler('play', function () { toggle(true); });
      ms.setActionHandler('pause', function () { toggle(false); });
      ms.setActionHandler('seekbackward', function (e) { skip(-(e && e.seekOffset || 15)); });
      ms.setActionHandler('seekforward', function (e) { skip(e && e.seekOffset || 15); });
      ms.setActionHandler('seekto', function (e) { if (e && typeof e.seekTime === 'number') A.currentTime = e.seekTime; });
      ms.setActionHandler('previoustrack', tracks.length > 1 ? function () { go(-1); } : null);
      ms.setActionHandler('nexttrack', tracks.length > 1 ? function () { go(1); } : null);
    } catch (e) {}
  }
  function load(i, autoplay) {
    if (i < 0 || i >= tracks.length) return;
    ensureAudio(); var wasRate = A.playbackRate; try { var rr = parseFloat(localStorage.getItem('ab_rate')); if (rr) wasRate = rr; } catch (e) {}
    cur = i; A.__resumed = false; A.src = abs(tracks[i].src); A.playbackRate = wasRate || 1; A.preload = 'metadata';
    msg(''); setSession(); syncUI();
    if (autoplay) { var pr = A.play(); if (pr && pr.catch) pr.catch(function () { msg('재생 버튼을 눌러 주세요'); }); }
  }
  function toggle(want) {
    if (!tracks.length) return;
    ensureAudio();
    if (cur < 0) { load(0, true); return; }
    var playing = !A.paused && !A.ended;
    if (want === true || (want === undefined && !playing)) { var pr = A.play(); if (pr && pr.catch) pr.catch(function () { msg('재생 버튼을 눌러 주세요'); }); }
    else A.pause();
  }
  function skip(d) { if (!A || cur < 0) return; try { A.currentTime = Math.max(0, Math.min((A.duration || 1e9), A.currentTime + d)); } catch (e) {} }
  function go(d) { var k = cur + d; if (k >= 0 && k < tracks.length) load(k, true); }

  function wire() {
    var pl = $('.ab-pl'); if (pl) pl.onclick = function () { toggle(); };
    var b = $('.ab-b15'); if (b) b.onclick = function () { skip(-15); };
    b = $('.ab-f15'); if (b) b.onclick = function () { skip(15); };
    b = $('.ab-pv'); if (b) b.onclick = function () { go(-1); };
    b = $('.ab-nx'); if (b) b.onclick = function () { go(1); };
    var spb = $('.ab-sp-b'); if (spb) spb.onclick = function () {
      var rates = [1, 1.25, 1.5, 1.75, 2, 0.8], r = A ? A.playbackRate : 1, k = rates.indexOf(r); r = rates[(k + 1) % rates.length];
      ensureAudio(); A.playbackRate = r; spb.textContent = (r === 1 ? '1.0' : r === 2 ? '2.0' : String(r)) + '×'; try { localStorage.setItem('ab_rate', String(r)); } catch (e) {}
    };
    var cp = $('.ab-cp'); if (cp) cp.onclick = function () {
      var u = pageUrl(), done = function () { cp.textContent = '✓'; setTimeout(function () { cp.textContent = '🔗'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('아래 링크를 복사하세요', u); });
      else prompt('아래 링크를 복사하세요', u);
    };
    var sk = $('.ab-seek');
    if (sk) {
      var apply = function () { if (A && A.duration) { A.currentTime = sk.value / 1000 * A.duration; } };
      sk.addEventListener('input', function () { sk.__drag = true; sk.style.setProperty('--p', (sk.value / 10) + '%'); var cu = $('.ab-cur'); if (cu && A && A.duration) cu.textContent = fmt(sk.value / 1000 * A.duration); });
      sk.addEventListener('change', function () { apply(); sk.__drag = false; });
      sk.addEventListener('pointerup', function () { setTimeout(function () { sk.__drag = false; }, 50); });
    }
    root.querySelectorAll('.ab-li').forEach(function (li) { li.onclick = function (e) { if (e.target.getAttribute('data-del') != null) return; load(+li.getAttribute('data-i'), true); }; });
    root.querySelectorAll('[data-del]').forEach(function (bt) { bt.onclick = function (e) { e.stopPropagation(); if (opts.onDelete) opts.onDelete(+bt.getAttribute('data-del')); }; });
    try { var r = parseFloat(localStorage.getItem('ab_rate')); if (r && A) A.playbackRate = r; var sb = $('.ab-sp-b'); if (sb && r) sb.textContent = (r === 1 ? '1.0' : r === 2 ? '2.0' : String(r)) + '×'; } catch (e) {}
  }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && A) syncUI(); });

  window.AudioBook = {
    mount: function (el, o) {
      opts = o || {}; root = el;
      try {
        if (KAKAO) { var k = 'ab_ext_tried', t = false; try { t = sessionStorage.getItem(k) === '1'; sessionStorage.setItem(k, '1'); } catch (e) {} if (!t) openExternal(); }
        if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.update(); }); });
      } catch (e) {}
      if (!document.getElementById('abCss')) { var st = document.createElement('style'); st.id = 'abCss'; st.textContent = CSS; document.head.appendChild(st); }
      return fetch(DATA + '?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return { tracks: [] }; })
        .then(function (d) { data = d || {}; tracks = (data.tracks || []).filter(function (t) { return t && t.src; }); render(); return data; });
    },
    reload: function () { return this.mount(root, opts); },
    setAdmin: function (v) { opts.admin = !!v; if (root) render(); },
    onDelete: function (fn) { opts.onDelete = fn; },
    data: function () { return data; },
    play: function () { toggle(true); },
    pauseAll: function () { if (A) A.pause(); }
  };
})();
