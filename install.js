/* ═══════════════════════════════════════════════════════════════
   install.js — 메인 화면 '홈 화면에 추가' 버튼 (휴대폰에서만 보임)
   · 안드로이드 크롬: 버튼 → 설치 창 바로 표시
   · 아이폰/아이패드, 설치 창이 안 뜨는 브라우저: 따라 하기 안내 창
   · 카카오톡 안에서 열면: 외부 브라우저(크롬·사파리)로 자동으로 넘김 (한 번 열 때 1회)
   · 다른 앱 안 브라우저(네이버·인스타 등): 안드로이드는 크롬으로 넘기고, 아이폰은 안내
   · 이미 홈 화면 아이콘으로 연 경우·PC에서는 버튼을 숨긴다
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isKakao = /KAKAOTALK/i.test(ua);
  var isLine = /\bLine\//i.test(ua);
  var isInApp = isKakao || isLine || /NAVER\(inapp|NAVER\/|Instagram|FBAN|FBAV|DaumApps|everytimeApp|Whale\/.*inapp|; wv\)/i.test(ua);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  function here() { var u = new URL(location.href); u.searchParams.delete('openExternalBrowser'); return u.toString(); }
  function openExternal() {
    var url = here();
    if (isKakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return true; }
    if (isLine) { var u = new URL(url); u.searchParams.set('openExternalBrowser', '1'); location.href = u.toString(); return true; }
    if (isAndroid) {
      location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
      return true;
    }
    return false;  /* 아이폰의 다른 앱 안 브라우저는 직접 넘길 방법이 없어 안내 창으로 */
  }

  /* 카카오톡(안드로이드·아이폰 모두)은 열자마자 외부 브라우저로 넘긴다. 같은 창에서 반복되지 않게 1회만 */
  if (isKakao && !standalone) {
    var k = 'sdl_ext_tried';
    var tried = false; try { tried = sessionStorage.getItem(k) === '1'; sessionStorage.setItem(k, '1'); } catch (e) {}
    if (!tried) openExternal();
  }

  if (standalone || !(isIOS || isAndroid)) return;

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('a2hsBtn'); if (b) b.remove(); closeGuide(); });

  var css = '' +
    '.a2hs-btn{position:absolute;top:18px;left:18px;display:inline-flex;align-items:center;gap:6px;background:#E8651A;border:1px solid rgba(255,255,255,.35);color:#fff;font-family:inherit;font-size:13px;font-weight:800;padding:8px 14px;border-radius:999px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:5}' +
    '.a2hs-btn:active{transform:scale(.95)}.hero.has-a2hs{padding-top:72px}' +
    '.a2hs-ov{position:fixed;inset:0;background:rgba(10,16,30,.6);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:16px}' +
    '.a2hs-box{background:#fff;color:#26282C;width:100%;max-width:420px;border-radius:20px;padding:22px 20px 18px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:15.5px;line-height:1.6}' +
    '.a2hs-box h3{font-size:18px;font-weight:900;color:#1A2744;margin-bottom:12px;display:flex;align-items:center;gap:10px}' +
    '.a2hs-box h3 img{width:40px;height:40px;border-radius:10px}' +
    '.a2hs-box ol{padding-left:0;list-style:none;counter-reset:s;margin:0 0 14px}' +
    '.a2hs-box li{counter-increment:s;position:relative;padding:8px 0 8px 38px;border-bottom:1px dashed #EEE7DF}' +
    '.a2hs-box li:last-child{border-bottom:0}' +
    '.a2hs-box li:before{content:counter(s);position:absolute;left:0;top:8px;width:26px;height:26px;border-radius:50%;background:#E8651A;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center}' +
    '.a2hs-box b{color:#C94F0A}' +
    '.a2hs-ic{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:1.5px solid #2C3F6E;border-radius:6px;color:#2C3F6E;font-size:15px;vertical-align:middle;margin:0 2px}' +
    '.a2hs-row{display:flex;gap:8px}' +
    '.a2hs-row button{flex:1;font-family:inherit;font-size:15px;font-weight:800;border-radius:12px;padding:12px;border:0;cursor:pointer}' +
    '.a2hs-ok{background:#1A2744;color:#fff}.a2hs-sub{background:#FFF3EA;color:#C94F0A}' +
    '.a2hs-arrow{position:fixed;left:50%;bottom:6px;transform:translateX(-50%);font-size:34px;color:#FFB37E;z-index:2147483001;animation:a2hsb 1s infinite;pointer-events:none}' +
    '@keyframes a2hsb{50%{transform:translate(-50%,8px)}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function closeGuide() { var o = document.getElementById('a2hsOv'); if (o) o.remove(); var a = document.getElementById('a2hsArrow'); if (a) a.remove(); }
  function guide(title, steps, opt) {
    closeGuide(); opt = opt || {};
    var ov = document.createElement('div'); ov.className = 'a2hs-ov'; ov.id = 'a2hsOv';
    ov.innerHTML = '<div class="a2hs-box" role="dialog" aria-modal="true"><h3><img src="assets/icons/icon-192.png" alt="">' + title + '</h3><ol>' +
      steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><div class="a2hs-row">' +
      (opt.sub ? '<button class="a2hs-sub" id="a2hsSub">' + opt.sub.label + '</button>' : '') +
      '<button class="a2hs-ok" id="a2hsOk">확인</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeGuide(); });
    document.getElementById('a2hsOk').onclick = closeGuide;
    if (opt.sub) document.getElementById('a2hsSub').onclick = opt.sub.run;
    if (opt.arrow) { var a = document.createElement('div'); a.className = 'a2hs-arrow'; a.id = 'a2hsArrow'; a.textContent = '⬇'; document.body.appendChild(a); }
  }
  function copyLink() {
    var url = here(), b = document.getElementById('a2hsSub');
    var done = function () { if (b) b.textContent = '복사됨 ✓'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('아래 주소를 복사하세요', url); });
    else prompt('아래 주소를 복사하세요', url);
  }

  var SHARE = '<span class="a2hs-ic">⬆︎</span>';
  function onClick() {
    if (isInApp) {
      if (openExternal()) return;
      guide('사파리에서 열어 주세요', [
        '지금은 앱 안의 브라우저라 홈 화면에 추가할 수 없습니다.',
        '화면 오른쪽 아래(또는 위)의 <b>…</b> 메뉴 → <b>Safari로 열기</b>를 누르세요.',
        '메뉴가 없으면 <b>링크 복사</b> 후 사파리 주소창에 붙여넣기 하세요.'
      ], { sub: { label: '링크 복사', run: copyLink } });
      return;
    }
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; });
      return;
    }
    if (isIOS) {
      var ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      var crios = /CriOS|FxiOS|EdgiOS/i.test(ua);
      var where = crios ? '주소창 오른쪽의 공유 버튼 ' + SHARE : (ipad ? '화면 위쪽 주소창 옆의 공유 버튼 ' + SHARE : '화면 <b>아래쪽 가운데</b>의 공유 버튼 ' + SHARE);
      guide('홈 화면에 아이콘 만들기', [
        where + '을 누르세요. (사파리 최신 버전은 주소창 오른쪽 <b>···</b> → 공유)',
        '목록을 아래로 내려 <b>홈 화면에 추가</b>를 누르세요.',
        '오른쪽 위 <b>추가</b>를 누르면 홈 화면에 아이콘이 생깁니다.'
      ], { arrow: !crios && !ipad });
      return;
    }
    guide('홈 화면에 아이콘 만들기', [
      '브라우저 오른쪽 위(삼성 인터넷은 아래)의 메뉴 <b>⋮</b> 또는 <b>≡</b>를 누르세요.',
      '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.',
      '<b>추가/설치</b>를 누르면 홈 화면에 아이콘이 생깁니다.'
    ]);
  }

  function mount() {
    var hero = document.querySelector('.hero'); if (!hero || document.getElementById('a2hsBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'a2hs-btn'; b.id = 'a2hsBtn';
    b.innerHTML = '<span>📲</span><span>' + (isInApp ? '외부 브라우저로 열기' : '홈 화면 만들기') + '</span>';
    b.onclick = onClick; hero.appendChild(b); hero.classList.add('has-a2hs');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
