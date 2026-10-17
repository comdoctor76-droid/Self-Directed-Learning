/* ═══════════════════════════════════════════════════════════════
   version.js — 사이트 버전 표시 (한 곳에서 관리)
   · 배포 때 아래 v(버전)와 at(수정 연월일시, 한국시간) 두 값만 올린다.
   · 메인(#verTag)과 각 학습 페이지 히어로(.hero) 우측 하단에 같은 값을 표시한다.
   ═══════════════════════════════════════════════════════════════ */
window.SITE_VERSION = { v: 'v1.111', at: '2026-10-17 12:10' };
(function () {
  'use strict';
  var V = window.SITE_VERSION, text = V.v + ' \u00b7 ' + V.at;
  function apply() {
    var tag = document.getElementById('verTag');
    if (tag) {
      var dot = tag.querySelector('.dot');
      tag.textContent = text;
      if (dot) tag.insertBefore(dot, tag.firstChild);
    }
    /* 메인은 히어로 안에 이미 버전 태그(#verTag)가 있으므로 배지를 덧붙이지 않는다 */
    var hero = tag ? null : document.querySelector('.hero');
    if (hero && !hero.querySelector('.ver-badge')) {
      var st = document.createElement('style');
      st.textContent =
        '.hero{position:relative}' +
        '.ver-badge{position:absolute;right:18px;bottom:14px;font-size:12.5px;font-weight:700;' +
          'color:rgba(255,255,255,.8);background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);' +
          'border-radius:999px;padding:5px 12px;letter-spacing:.3px;pointer-events:none;white-space:nowrap;line-height:1.2}' +
        '@media(max-width:600px){.ver-badge{right:12px;bottom:10px;font-size:11px;padding:4px 10px}}' +
        '@media print{.ver-badge{display:none}}';
      document.head.appendChild(st);
      var b = document.createElement('span');
      b.className = 'ver-badge'; b.textContent = text;
      hero.appendChild(b);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
