/* adminonly.js — '관리자 모드에서만 보이는' 자료·기능의 공통 판별 (admin.js 와 같은 기준: 암호 통과(세션) + 토큰 보유)
   · 이 사이트는 정적 사이트라 화면 가림(소프트 게이트)일 뿐, 파일 주소를 아는 사람의 직접 접근까지 막지는 못합니다. */
(function () {
  function on() { try { return sessionStorage.getItem('ad_pw_ok') === '1' && !!localStorage.getItem('gh_admin_token'); } catch (e) { return false; } }
  window.AdminOnly = { on: on };
  /* 관리자 전용 페이지 가림막: <html class="ao-gate"> 로 시작 → 관리자면 해제, 아니면 안내 + 로그인 버튼 */
  function gate() {
    var h = document.documentElement;
    if (!h.classList.contains('ao-gate')) return;
    var st = document.createElement('style');
    st.textContent = 'html.ao-gate body>*:not(#aoGate):not(script):not(link):not(style){display:none!important}' +
      '#aoGate{display:none;min-height:100vh;align-items:center;justify-content:center;flex-direction:column;gap:14px;text-align:center;padding:24px;font-family:"Noto Sans KR",sans-serif;color:#1A2744;background:#FBF8F5}' +
      'html.ao-gate #aoGate{display:flex}#aoGate b{font-size:20px;font-weight:900}#aoGate p{color:#6B7078;font-size:15px}' +
      '#aoGate button,#aoGate a{font-family:inherit;font-size:15px;font-weight:800;border-radius:999px;padding:11px 22px;border:0;cursor:pointer;text-decoration:none}' +
      '#aoGate button{background:#E8651A;color:#fff}#aoGate a{background:#fff;color:#1A2744;border:1.5px solid #EEE7DF}';
    document.head.appendChild(st);
    var g = document.createElement('div'); g.id = 'aoGate';
    g.innerHTML = '<b>🔒 관리자 전용 자료입니다</b><p>관리자 모드로 로그인하면 볼 수 있습니다.</p><button type="button" id="aoLogin">🔧 관리자 로그인</button><a href="index.html">메인으로</a>';
    document.body.insertBefore(g, document.body.firstChild);
    function update() { if (on()) h.classList.remove('ao-gate'); else h.classList.add('ao-gate'); }
    document.getElementById('aoLogin').onclick = function () { if (window.AdminEditor) AdminEditor.openLogin(); };
    document.addEventListener('admin-login', update); document.addEventListener('admin-logout', update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gate); else gate();
})();
