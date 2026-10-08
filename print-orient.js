/* ═══════════════════════════════════════════════════════════════
   print-orient.js — 인쇄 시 용지 방향 자동 전환

   가로로 긴 자료(인포그래픽 등)를 세로 용지에 찍으면 폭에 맞춰 축소되어
   글자가 작아진다. 인쇄 직전 이미지의 가로/세로 비율을 보고
   @page 방향을 가로로 바꿔 지면을 꽉 채우도록 한다.

   · 인쇄 대상은 #PRINT_IMG (인쇄 전용 영역의 이미지) 하나뿐이므로
     그 자연 크기만 보면 된다.
   · beforeprint 에서 처리하므로 각 페이지의 PR_GO() 를 고칠 필요가 없고,
     브라우저 메뉴/Ctrl+P 로 인쇄해도 동일하게 동작한다.
   · @page size 를 지원하지 않는 브라우저에서는 조용히 무시되어
     기존(세로) 동작 그대로 — 기능이 깨지지 않는다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__PRINT_ORIENT__) return;
  window.__PRINT_ORIENT__ = true;

  var STYLE_ID = 'PRINT_ORIENT_CSS';
  /* 세로가 기본. 각 페이지의 @media print 안에 있는 @page{margin:10mm} 와 맞춘다 */
  var MARGIN = '10mm';

  function styleEl() {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    return el;
  }

  function apply() {
    var img = document.getElementById('PRINT_IMG');
    var landscape = false;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      /* 가로가 세로보다 길면 가로 용지 */
      landscape = img.naturalWidth > img.naturalHeight;
    }
    styleEl().textContent =
      '@page{size:A4 ' + (landscape ? 'landscape' : 'portrait') + ';margin:' + MARGIN + '}' +
      /* 가로 용지에서는 높이에 맞춰야 지면을 꽉 채운다 */
      (landscape
        ? '@media print{#PRINTAREA img{width:auto!important;max-width:100%!important;' +
          'height:auto!important;max-height:100%!important;display:block;margin:0 auto}}'
        : '');
  }

  /* 인쇄가 시작되기 직전에 방향을 결정한다 */
  if (window.matchMedia) {
    var mq = window.matchMedia('print');
    var onChange = function (e) { if (e.matches) apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  window.addEventListener('beforeprint', apply);

  /* PR_GO() 가 이미지를 바꾼 뒤 곧바로 print() 를 부르는 환경에서도
     확실히 반영되도록, 이미지 src 변경도 함께 지켜본다 */
  function watchImg() {
    var img = document.getElementById('PRINT_IMG');
    if (!img || !window.MutationObserver) return;
    new MutationObserver(function () {
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once: true });
    }).observe(img, { attributes: true, attributeFilter: ['src'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchImg);
  } else {
    watchImg();
  }
})();
