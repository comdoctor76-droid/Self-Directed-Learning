/* ═══════════════════════════════════════════════════════════════
   pen.js — 강의용 판서(펜) 오버레이
   · 스타일러스(pointerType='pen')와 마우스로만 그린다. 손가락은 항상 스크롤.
   · 필기는 '내용 좌표'로 저장하고 화면에는 스크롤 위치만큼 옮겨 그리므로
     본문/팝업을 스크롤하면 글씨도 함께 따라 올라간다.
   · 팝업(#MB)·확대창(#IMB)·PDF 뷰어(#PDFB)는 각각 별도 레이어를 쓰고,
     그 창을 닫거나 다른 카드로 바꾸면 해당 필기는 자동으로 지워진다.
   · 저장하지 않으므로 페이지를 벗어나면 모든 필기가 사라진다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__PEN_READY__) return;
  window.__PEN_READY__ = true;

  /* 위에 뜨는 창일수록 앞에 둔다 (먼저 발견된 것이 현재 레이어) */
  var OVERLAYS = ['PDFB', 'IMB', 'MB'];
  var COLORS = [
    { c: '#000000', n: '검은색' },
    { c: '#E8201A', n: '붉은색' },
    { c: '#1A5FE8', n: '파란색' },
    { c: '#FFFFFF', n: '하얀색' }
  ];
  var LINE = 3.2;      /* 선 굵기 */
  var ERASE_R = 16;    /* 지우개 반경(px) */

  var penOn = false, erasing = false, color = COLORS[1].c;
  var ink = {};        /* 레이어id -> [{c,w,p:[[x,y],…]}] */
  var cur = null, curSurf = null, swallow = false;
  var cv, ctx, dpr = 1, pending = 0;

  /* ── 스타일 ───────────────────────────────────────────────── */
  var CSS =
    '#PEN_CV{position:fixed;inset:0;z-index:2147482000;pointer-events:none;display:block}' +
    '#PENBAR{position:fixed;right:16px;bottom:16px;z-index:2147482001;display:flex;' +
      'flex-direction:column;align-items:flex-end;gap:8px;font-family:inherit;' +
      '-webkit-user-select:none;user-select:none;touch-action:manipulation}' +
    '#PEN_X{display:none;flex-direction:column;gap:8px;align-items:center;' +
      'background:rgba(26,39,68,.94);border:1px solid rgba(255,255,255,.22);' +
      'border-radius:16px;padding:10px 9px;box-shadow:0 8px 26px rgba(0,0,0,.34)}' +
    '#PENBAR.open #PEN_X{display:flex}' +
    '.pen-sw{width:34px;height:34px;border-radius:50%;border:2.5px solid rgba(255,255,255,.45);' +
      'cursor:pointer;padding:0;display:block}' +
    '.pen-sw.on{border-color:#FFB37E;box-shadow:0 0 0 3px rgba(232,101,26,.55)}' +
    '.pen-b{width:34px;height:34px;border-radius:11px;border:1px solid rgba(255,255,255,.28);' +
      'background:rgba(255,255,255,.12);color:#fff;font-family:inherit;font-size:15px;' +
      'line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}' +
    '.pen-b.on{background:#E8651A;border-color:#E8651A}' +
    '.pen-hr{width:26px;height:1px;background:rgba(255,255,255,.22)}' +
    '#PEN_T{width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.26);' +
      'background:linear-gradient(135deg,#2C3F6E,#1A2744);color:#fff;font-size:22px;line-height:1;' +
      'cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.32);padding:0;' +
      'display:flex;align-items:center;justify-content:center}' +
    '#PEN_T.on{background:linear-gradient(135deg,#E8651A,#C94F0A)}' +
    '#PEN_T:active,.pen-b:active,.pen-sw:active{transform:scale(.94)}' +
    '@media print{#PEN_CV,#PENBAR{display:none !important}}';

  /* ── 레이어 판별 ──────────────────────────────────────────── */
  function shown(el) {
    if (!el) return false;
    var s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }
  function surface() {
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = document.getElementById(OVERLAYS[i]);
      if (shown(el)) return { id: el.id, el: el };
    }
    return { id: 'doc', el: null };
  }
  function geom(s) {
    if (s.el) {
      var r = s.el.getBoundingClientRect();
      return { x: s.el.scrollLeft, y: s.el.scrollTop,
               l: r.left, t: r.top, w: r.width, h: r.height };
    }
    return { x: window.pageXOffset || 0, y: window.pageYOffset || 0,
             l: 0, t: 0, w: window.innerWidth, h: window.innerHeight };
  }
  function store(id) { return ink[id] || (ink[id] = []); }
  /* 화면 좌표 → 내용 좌표 (스크롤해도 변하지 않는 값) */
  function toContent(s, cx, cy) {
    var g = geom(s);
    return [cx - g.l + g.x, cy - g.t + g.y];
  }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
  }
  function paint() {
    pending = 0;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    var s = surface(), arr = ink[s.id];
    if (!arr || !arr.length) return;
    var g = geom(s);
    ctx.save();
    if (s.el) { ctx.beginPath(); ctx.rect(g.l, g.t, g.w, g.h); ctx.clip(); }
    ctx.translate(g.l - g.x, g.t - g.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < arr.length; i++) {
      var st = arr[i], p = st.p;
      if (!p.length) continue;
      ctx.strokeStyle = st.c; ctx.lineWidth = st.w;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.1, p[0][1]);
      else for (var j = 1; j < p.length; j++) ctx.lineTo(p[j][0], p[j][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  function schedule() {
    if (pending) return;
    pending = window.requestAnimationFrame ? requestAnimationFrame(paint) : setTimeout(paint, 16);
  }
  function eraseAt(s, p) {
    var arr = store(s.id), r2 = ERASE_R * ERASE_R;
    for (var i = arr.length - 1; i >= 0; i--) {
      var pts = arr[i].p;
      for (var j = 0; j < pts.length; j++) {
        var dx = pts[j][0] - p[0], dy = pts[j][1] - p[1];
        if (dx * dx + dy * dy <= r2) { arr.splice(i, 1); break; }
      }
    }
  }
  function clearAll() { ink = {}; schedule(); }

  /* ── 입력 (손가락은 제외 → 항상 스크롤) ──────────────────── */
  function drawable(e) {
    return penOn && e.pointerType !== 'touch';
  }
  function inBar(t) {
    while (t && t !== document) {
      if (t.id === 'PENBAR') return true;
      t = t.parentNode;
    }
    return false;
  }
  function onDown(e) {
    if (!drawable(e) || inBar(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    swallow = true;
    curSurf = surface();
    var p = toContent(curSurf, e.clientX, e.clientY);
    if (erasing) { cur = 'E'; eraseAt(curSurf, p); }
    else { cur = { c: color, w: LINE, p: [p] }; store(curSurf.id).push(cur); }
    schedule();
  }
  function onMove(e) {
    if (!cur || e.pointerType === 'touch') return;
    e.preventDefault();
    var p = toContent(curSurf, e.clientX, e.clientY);
    if (cur === 'E') eraseAt(curSurf, p);
    else cur.p.push(p);
    schedule();
  }
  function onUp() {
    if (!cur) return;
    cur = null; curSurf = null;
    setTimeout(function () { swallow = false; }, 0);
    schedule();
  }
  function onClick(e) {
    if (!swallow) return;
    swallow = false;
    e.preventDefault(); e.stopPropagation();
  }

  /* ── 툴바 ─────────────────────────────────────────────────── */
  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    cv = document.createElement('canvas');
    cv.id = 'PEN_CV';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    sizeCanvas();

    var bar = document.createElement('div');
    bar.id = 'PENBAR';
    var sw = '';
    for (var i = 0; i < COLORS.length; i++) {
      sw += '<button type="button" class="pen-sw" data-c="' + COLORS[i].c + '" ' +
            'style="background:' + COLORS[i].c + '" title="' + COLORS[i].n + '" ' +
            'aria-label="' + COLORS[i].n + '"></button>';
    }
    bar.innerHTML =
      '<div id="PEN_X" role="group" aria-label="판서 도구">' + sw +
        '<span class="pen-hr"></span>' +
        '<button type="button" class="pen-b" id="PEN_E" title="지우개" aria-label="지우개">🧽</button>' +
        '<button type="button" class="pen-b" id="PEN_C" title="전체 지우기" aria-label="전체 지우기">🗑</button>' +
      '</div>' +
      '<button type="button" id="PEN_T" title="판서 켜기/끄기" aria-label="판서 켜기/끄기">✏️</button>';
    document.body.appendChild(bar);

    var tog = bar.querySelector('#PEN_T');
    tog.addEventListener('click', function () {
      penOn = !penOn;
      bar.classList.toggle('open', penOn);
      tog.classList.toggle('on', penOn);
      if (!penOn) { erasing = false; sync(); }
    });
    bar.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('pen-sw')) {
        color = t.getAttribute('data-c'); erasing = false; sync();
      } else if (t.id === 'PEN_E') {
        erasing = !erasing; sync();
      } else if (t.id === 'PEN_C') {
        clearAll();
      }
    });
    function sync() {
      var sws = bar.querySelectorAll('.pen-sw');
      for (var i = 0; i < sws.length; i++) {
        sws[i].classList.toggle('on', !erasing && sws[i].getAttribute('data-c') === color);
      }
      bar.querySelector('#PEN_E').classList.toggle('on', erasing);
    }
    sync();
  }

  /* ── 창이 닫히거나 내용이 바뀌면 그 레이어의 필기를 비운다 ── */
  function watch() {
    OVERLAYS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !window.MutationObserver) return;
      var was = shown(el);
      new MutationObserver(function () {
        var now = shown(el);
        if (was && !now) { ink[id] = []; }
        was = now;
        schedule();
      }).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    });
    /* 팝업 안에서 다른 카드로 넘어가도 '다른 창'이므로 비운다 */
    if (window.MutationObserver) {
      var mc = document.getElementById('MC');
      if (mc) new MutationObserver(function () { ink['MB'] = []; schedule(); })
        .observe(mc, { childList: true });
      var im = document.getElementById('IMG_IMG');
      if (im) new MutationObserver(function () { ink['IMB'] = []; schedule(); })
        .observe(im, { attributes: true, attributeFilter: ['src'] });
    }
  }

  function start() {
    build();
    watch();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', function () {
      /* 가로폭이 바뀌면 본문이 재배치되므로 필기 위치가 어긋난다 → 비운다 */
      if (Math.abs(window.innerWidth - start._w) > 1) { ink = {}; start._w = window.innerWidth; }
      sizeCanvas(); schedule();
    });
    start._w = window.innerWidth;
  }

  if (!window.PointerEvent) return;   /* 포인터 이벤트 미지원 환경은 조용히 비활성화 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
