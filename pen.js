/* ═══════════════════════════════════════════════════════════════
   pen.js — 강의용 판서(펜) 오버레이
   · 스타일러스(pointerType='pen')와 마우스로만 그린다. 손가락은 항상 스크롤.
   · 필기는 레이어마다 정한 '기준 요소'(본문 body, 팝업 #MC, 확대창 그림 #IMG_IMG …)에 대한
     상대 좌표(기준 요소 폭으로 나눈 값)로 저장한다. 그릴 때는 그 순간의 기준 요소 위치와
     캔버스 자신의 위치를 둘 다 측정해 변환하므로, 스크롤·핀치 확대(특히 iOS Safari 의
     fixed 요소 어긋남)와 무관하게 글씨가 내용에 붙어 있다.
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
  /* 입력 방식 — 'pen': 스타일러스·마우스만 그리고 손가락은 스크롤(기본)
                 'touch': 손가락·정전식 펜도 그린다(브라우저 스크롤 제스처 차단) */
  var MODE_KEY = 'pen_input_mode';
  var inputMode = 'pen';
  try { if (localStorage.getItem(MODE_KEY) === 'touch') inputMode = 'touch'; } catch (_) {}
  var ink = {};        /* 레이어id -> [{c,w,p:[[x,y],…]}] */
  var cur = null, curSurf = null, swallow = false;
  var cv, ctx, dpr = 1, pending = 0;
  var touches = 0, multi = false;   /* 눌린 손가락 수 / 두 손가락 제스처(확대·이동) 진행 중 */

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
      'display:flex;align-items:center;justify-content:center;touch-action:none}' +
    '#PEN_T.on{background:linear-gradient(135deg,#E8651A,#C94F0A)}' +
    '#PEN_T:active,.pen-b:active,.pen-sw:active{transform:scale(.94)}' +
    '@media print{#PEN_CV,#PENBAR{display:none !important}}' +
    /* 손가락 모드: 한 손가락 스크롤 차단(→ 그리기). 팝업·확대창·PDF 뷰어는 각자 스크롤되는 요소라
       html 의 touch-action 이 닿지 않으므로 그 요소들에도 같은 규칙을 건다. (OM 이 cssText 를 통째로 다시 쓰므로
       인라인 스타일이 아니라 클래스 규칙으로) */
    'html.pen-touch,html.pen-touch #MB,html.pen-touch #IMB,html.pen-touch #PDFB,' +
    'html.pen-touch #MB *,html.pen-touch #IMB *,html.pen-touch #PDFB *{touch-action:pinch-zoom !important}' +
    'html.pen-touch-none,html.pen-touch-none #MB,html.pen-touch-none #IMB,html.pen-touch-none #PDFB,' +
    'html.pen-touch-none #MB *,html.pen-touch-none #IMB *,html.pen-touch-none #PDFB *{touch-action:none !important}';

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
  /* 레이어별 기준 요소 — 필기를 이 요소에 붙여 둔다 */
  function anchor(s) {
    var a = null;
    if (s.id === 'IMB') a = document.getElementById('IMG_IMG');
    else if (s.id === 'MB') a = document.getElementById('MC');
    else if (s.id === 'PDFB') a = s.el.firstElementChild;
    else a = document.body;
    if (!a || !a.getBoundingClientRect) a = s.el || document.documentElement;
    var r = a.getBoundingClientRect();
    if (!(r.width > 0)) r = { left: r.left, top: r.top, width: 1 };
    return r;
  }
  function store(id) { return ink[id] || (ink[id] = []); }
  /* 화면 좌표 → 기준 요소 상대 좌표 (폭 1 기준으로 정규화) */
  function toContent(s, cx, cy) {
    var a = anchor(s);
    return [(cx - a.left) / a.width, (cy - a.top) / a.width];
  }
  function vpW() { return document.documentElement.clientWidth || window.innerWidth; }
  function vpH() { return document.documentElement.clientHeight || window.innerHeight; }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function sizeCanvas() {
    /* innerWidth/innerHeight 는 iOS 에서 확대 중 '보이는 영역' 크기를 돌려주므로 레이아웃 뷰포트를 쓴다 */
    var w = vpW(), h = vpH();
    /* 확대(핀치) 중에도 해상도를 올리지 않는다. 확대 배율만큼 캔버스를 키우면 태블릿 브라우저가
       너무 큰 캔버스를 화면에 그리지 못해 "확대 중엔 안 보이고 축소하면 보이는" 현상이 생긴다 */
    dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    var a = anchor(s), c = cv.getBoundingClientRect();
    ctx.save();
    if (s.el) {
      var r = s.el.getBoundingClientRect();
      ctx.beginPath(); ctx.rect(r.left - c.left, r.top - c.top, r.width, r.height); ctx.clip();
    }
    /* 기준 요소 상대 좌표 → 캔버스 좌표. 두 rect 를 같은 순간에 재므로 뷰포트 기준이 어긋나도 상쇄된다 */
    ctx.translate(a.left - c.left, a.top - c.top);
    ctx.scale(a.width, a.width);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 0; i < arr.length; i++) {
      var st = arr[i], p = st.p;
      if (!p.length) continue;
      ctx.strokeStyle = st.c; ctx.lineWidth = st.w;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + st.w * 0.03, p[0][1]);
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
    var er = ERASE_R / anchor(s).width;
    var arr = store(s.id), r2 = er * er;
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
    if (!penOn) return false;
    if (inputMode === 'touch') return true;          /* 손가락·정전식 펜 포함 전부 */
    return e.pointerType !== 'touch';                /* 펜 모드: 손가락은 스크롤 */
  }
  /* 손가락 모드에서는 손가락이 선을 그어야 하므로 브라우저의 스크롤·확대 제스처를 막는다.
     (preventDefault 만으로는 터치 스크롤이 막히지 않는다 — touch-action 이 결정한다) */
  function applyTouchAction() {
    /* 손가락 모드: 한 손가락 스크롤만 막고(→ 그리기), 두 손가락 확대·이동은 브라우저에 맡긴다 */
    var ta = 'pinch-zoom';
    try { if (window.CSS && CSS.supports && !CSS.supports('touch-action', 'pinch-zoom')) ta = 'none'; } catch (_) {}
    var on = penOn && inputMode === 'touch';
    document.documentElement.style.touchAction = on ? ta : '';
    var cl = document.documentElement.classList;
    cl.toggle('pen-touch', on && ta === 'pinch-zoom');
    cl.toggle('pen-touch-none', on && ta === 'none');
  }
  /* 진행 중이던 획을 없던 일로 — 두 손가락 제스처(확대·이동)가 시작됐을 때 */
  function dropStroke() {
    if (cur && cur !== 'E' && curSurf) {
      var arr = store(curSurf.id), i = arr.indexOf(cur);
      if (i >= 0) arr.splice(i, 1);
    }
    cur = null; curSurf = null;
    schedule();
  }
  function inBar(t) {
    while (t && t !== document) {
      if (t.id === 'PENBAR') return true;
      t = t.parentNode;
    }
    return false;
  }
  function onDown(e) {
    if (e.pointerType === 'touch') {
      if (e.isPrimary) { touches = 0; multi = false; }   /* 새 터치 시퀀스 — 집계 초기화 */
      touches++;
      if (touches >= 2) {            /* 두 번째 손가락 → 확대·이동 제스처: 그리던 획은 버린다 */
        multi = true; dropStroke(); swallow = false;
        return;
      }
    }
    if (multi || !drawable(e) || inBar(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    swallow = true;
    curSurf = surface();
    var p = toContent(curSurf, e.clientX, e.clientY);
    if (erasing) { cur = 'E'; eraseAt(curSurf, p); }
    else { cur = { c: color, w: LINE / anchor(curSurf).width, p: [p] }; store(curSurf.id).push(cur); }
    schedule();
  }
  function onMove(e) {
    if (!cur) return;
    if (e.pointerType === 'touch' && inputMode !== 'touch') return;
    e.preventDefault();
    var p = toContent(curSurf, e.clientX, e.clientY);
    if (cur === 'E') eraseAt(curSurf, p);
    else cur.p.push(p);
    schedule();
  }
  function onUp(e) {
    if (e && e.pointerType === 'touch') {
      touches = Math.max(0, touches - 1);
      if (touches === 0) multi = false;
    }
    if (!cur) return;
    /* pointercancel: 브라우저가 입력을 가져간 경우.
       · 두 번째 손가락이 닿아 확대·이동이 시작됐거나(multi) 점 2개 이하의 찍힌 점이면 지운다
       · 그 외(한 손가락·펜 획 도중 스크롤 등으로 취소)에는 그린 데까지 남기고 끊기만 한다
         — 취소 때마다 획을 통째로 지우면 "그려졌다가 바로 사라지는" 현상이 된다 */
    if (e && e.type === 'pointercancel') {
      var stub = cur !== 'E' && cur.p && cur.p.length < 3;
      if (multi || stub) { dropStroke(); swallow = false; return; }
    }
    cur = null; curSurf = null;
    setTimeout(function () { swallow = false; }, 0);
    schedule();
  }
  function onClick(e) {
    if (!swallow) return;
    swallow = false;
    e.preventDefault(); e.stopPropagation();
  }

  /* 확대 상태에서도 도구 막대가 화면 오른쪽 아래(보이는 영역 기준)에 같은 크기로 보이게 */
  var BAR_KEY = 'pen_bar_pos', BAR_M = 16;
  var barPos = { r: 0, b: 0 };   /* 기본 위치(오른쪽 아래 16px)에서 더 안쪽으로 옮긴 거리(화면 px) */
  try { var bp = JSON.parse(localStorage.getItem(BAR_KEY) || 'null'); if (bp && isFinite(bp.r) && isFinite(bp.b)) barPos = bp; } catch (_) {}
  function clampBar(bar) {
    var r = bar.getBoundingClientRect(), z = zoomNow();
    var w = r.width * z || 60, h = r.height * z || 60;   /* 화면상 크기 */
    var vw = (window.visualViewport ? window.visualViewport.width * z : vpW());
    var vh = (window.visualViewport ? window.visualViewport.height * z : vpH());
    barPos.r = Math.max(0, Math.min(barPos.r, vw - w - BAR_M * 2));
    barPos.b = Math.max(0, Math.min(barPos.b, vh - h - BAR_M * 2));
  }
  function zoomNow() { var vv = window.visualViewport; return (vv && vv.scale) || 1; }
  /* 도구 막대를 '보이는 영역'의 오른쪽 아래(옮긴 위치 반영)에, 확대해도 같은 크기로 둔다.
     transform 을 지운 상태의 실제 위치를 재서 맞추므로 iOS 의 fixed 요소 어긋남에도 맞는다 */
  function followBar() {
    var bar = document.getElementById('PENBAR'), vv = window.visualViewport;
    if (!bar) return;
    var z = zoomNow();
    bar.style.transform = '';
    bar.style.right = BAR_M + 'px'; bar.style.bottom = BAR_M + 'px';
    if (!vv || (Math.abs(z - 1) < 0.01 && vv.offsetLeft < 1 && vv.offsetTop < 1)) {
      bar.style.right = (BAR_M + barPos.r) + 'px'; bar.style.bottom = (BAR_M + barPos.b) + 'px';
      return;
    }
    var r = bar.getBoundingClientRect();
    var wantR = vv.offsetLeft + vv.width - (BAR_M + barPos.r) / z;
    var wantB = vv.offsetTop + vv.height - (BAR_M + barPos.b) / z;
    bar.style.transformOrigin = '100% 100%';
    bar.style.transform = 'translate(' + (wantR - r.right) + 'px,' + (wantB - r.bottom) + 'px) scale(' + (1 / z) + ')';
  }
  /* ✏️ 버튼을 누른 채 끌면 도구 막대 이동 (짧게 누르면 기존처럼 켜기/끄기) */
  function dragBar(bar, tog) {
    var d = null, moved = false;
    tog.addEventListener('pointerdown', function (e) {
      d = { x: e.clientX, y: e.clientY, r: barPos.r, b: barPos.b, id: e.pointerId };
      moved = false;
      try { tog.setPointerCapture(e.pointerId); } catch (_) {}
    });
    tog.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      var z = zoomNow();
      var dx = (e.clientX - d.x) * z, dy = (e.clientY - d.y) * z;   /* 화면 px */
      if (!moved && dx * dx + dy * dy < 36) return;
      moved = true;
      barPos.r = d.r - dx; barPos.b = d.b - dy;
      clampBar(bar); followBar();
      e.preventDefault();
    });
    function end(e) {
      if (!d || (e && e.pointerId !== d.id)) return;
      d = null;
      if (moved) {
        try { localStorage.setItem(BAR_KEY, JSON.stringify(barPos)); } catch (_) {}
        tog.__dragged = true;   /* 바로 뒤따르는 click 은 무시 */
        setTimeout(function () { tog.__dragged = false; }, 350);
      }
    }
    tog.addEventListener('pointerup', end);
    tog.addEventListener('pointercancel', end);
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
      '<div id="PEN_X" role="group" aria-label="판서 도구">' +
        '<button type="button" class="pen-b" id="PEN_M" title="입력 방식 전환" aria-label="입력 방식 전환"></button>' +
        '<span class="pen-hr"></span>' + sw +
        '<span class="pen-hr"></span>' +
        '<button type="button" class="pen-b" id="PEN_E" title="지우개" aria-label="지우개">🧽</button>' +
        '<button type="button" class="pen-b" id="PEN_C" title="전체 지우기" aria-label="전체 지우기">🗑</button>' +
      '</div>' +
      '<button type="button" id="PEN_T" title="판서 켜기/끄기" aria-label="판서 켜기/끄기">✏️</button>';
    document.body.appendChild(bar);

    var tog = bar.querySelector('#PEN_T');
    dragBar(bar, tog);
    tog.addEventListener('click', function (e) {
      if (tog.__dragged) { e.preventDefault(); return; }
      penOn = !penOn;
      bar.classList.toggle('open', penOn);
      tog.classList.toggle('on', penOn);
      if (!penOn) { erasing = false; sync(); }
      applyTouchAction();
    });
    function setMode(m) {
      inputMode = m;
      try { localStorage.setItem(MODE_KEY, m); } catch (_) {}
      cur = null; curSurf = null;            /* 진행 중이던 획은 끊는다 */
      applyTouchAction();
      sync();
    }
    bar.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('pen-sw')) {
        color = t.getAttribute('data-c'); erasing = false; sync();
      } else if (t.id === 'PEN_M') {
        setMode(inputMode === 'touch' ? 'pen' : 'touch');
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
      var mb = bar.querySelector('#PEN_M'), touch = inputMode === 'touch';
      mb.textContent = touch ? '👆' : '✍️';
      mb.title = touch
        ? '손가락(정전식) 모드 — 한 손가락은 그리기, 두 손가락은 확대·이동. 누르면 펜 전용 모드로'
        : '펜(스타일러스) 모드 — 손가락은 스크롤, 펜만 그립니다. 누르면 손가락 모드로';
      mb.setAttribute('aria-label', mb.title);
      mb.classList.toggle('on', touch);
    }
    sync();
    applyTouchAction();
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
    followBar();            /* 저장해 둔 도구 막대 위치 적용 */
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    /* 획이 진행 중이면 브라우저 스크롤을 막는다. pointerdown/pointermove 의 preventDefault 는 스크롤을 못 막고
       non-passive touchmove 의 preventDefault 만 막을 수 있다. 포인터 이벤트가 터치 이벤트보다 먼저 오므로
       획을 시작한 입력(펜 모드의 스타일러스, 손가락 모드의 한 손가락)만 정확히 걸린다.
       두 손가락은 막지 않아 확대·이동은 그대로 된다. */
    window.addEventListener('touchmove', function (e) {
      if (cur && e.touches && e.touches.length === 1 && e.cancelable) e.preventDefault();
    }, { passive: false, capture: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', schedule, true);
    /* 레이아웃 폭(확대해도 변하지 않는 값)이 바뀌면 본문이 재배치되어 필기 위치가 어긋난다 → 비운다 */
    function layoutW() { return vpW(); }
    window.addEventListener('resize', function () {
      if (Math.abs(layoutW() - start._w) > 1) {
        /* 본문·팝업은 글이 다시 흘러 위치가 어긋나므로 비우고, 확대창 그림·PDF 위 필기는 그림 비율로 저장돼 있어 유지 */
        ink.doc = []; ink.MB = []; start._w = layoutW();
      }
      sizeCanvas(); schedule(); followBar();
    });
    start._w = layoutW();
    /* 두 손가락 확대·이동 중: 해상도 재조정(끝난 뒤 한 번) + 도구 막대를 보이는 영역에 붙여 둔다 */
    var vv = window.visualViewport;
    if (vv) {
      var tmr = 0;
      var onVV = function () {
        followBar();
        if (tmr) clearTimeout(tmr);
        tmr = setTimeout(function () { tmr = 0; schedule(); }, 60);
      };
      vv.addEventListener('resize', onVV);
      vv.addEventListener('scroll', onVV);
    }
  }

  if (!window.PointerEvent) return;   /* 포인터 이벤트 미지원 환경은 조용히 비활성화 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
