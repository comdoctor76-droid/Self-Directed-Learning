/* ===== 관리자 편집 엔진 (GitHub API 기반) =====
   - 토큰은 이 브라우저 localStorage 에만 저장됩니다.
   - 저장 = data/<guide>.json 전체를 저장소에 커밋 → 약 1~2분 뒤 Pages 재배포로 모두에게 반영.
*/
(function(){
"use strict";

var GH={owner:"comdoctor76-droid",repo:"Self-Directed-Learning",branch:"main"};
var TOKEN_KEY="gh_admin_token";
var PW_KEY="ad_pw_ok";
/* 관리자 암호(편의용 게이트). 실제 보안 경계는 각 브라우저에만 저장되는 GitHub 토큰입니다. */
var ADMIN_PW="1234";

function getToken(){try{return localStorage.getItem(TOKEN_KEY)||"";}catch(e){return "";}}
function pwOk(){try{return sessionStorage.getItem(PW_KEY)==="1";}catch(e){return false;}}
function setPwOk(){try{sessionStorage.setItem(PW_KEY,"1");}catch(e){}}
function clearPwOk(){try{sessionStorage.removeItem(PW_KEY);}catch(e){}}
/* 편집 활성 = 암호 통과(세션) AND 토큰 보유 */
function isEditing(){return pwOk()&&!!getToken();}
function isLoggedIn(){return isEditing();}
function dataPath(){return window.GUIDE_DATA_PATH||"data/lung.json";}
function _t(s){return s==null?"":String(s);}
function clone(o){return JSON.parse(JSON.stringify(o));}

/* ---------- base64 (UTF-8 안전) ---------- */
function b64enc(str){return btoa(unescape(encodeURIComponent(str)));}
function b64dec(b64){return decodeURIComponent(escape(atob(String(b64).replace(/\s/g,""))));}

/* ---------- GitHub API ---------- */
function api(path){return "https://api.github.com/repos/"+GH.owner+"/"+GH.repo+"/contents/"+path;}
function hdr(){return {"Authorization":"Bearer "+getToken(),"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};}
function ghGet(path){
  return fetch(api(path)+"?ref="+GH.branch+"&_="+new Date().getTime(),{headers:hdr(),cache:"no-store"}).then(function(r){
    if(r.status===404)return {sha:null,text:null};
    if(!r.ok){var e=new Error("get failed");e.status=r.status;throw e;}
    return r.json().then(function(j){return {sha:j.sha,text:j.content?b64dec(j.content):null};});
  });
}
function ghPut(path,contentB64,sha,message){
  var body={message:message,content:contentB64,branch:GH.branch};
  if(sha)body.sha=sha;
  return fetch(api(path),{method:"PUT",headers:Object.assign({"Content-Type":"application/json"},hdr()),body:JSON.stringify(body)}).then(function(r){
    if(!r.ok){return r.json().catch(function(){return {};}).then(function(j){var e=new Error((j&&j.message)||"put failed");e.status=r.status;throw e;});}
    return r.json();
  });
}
function ghErr(status){
  if(status===401)return "토큰이 올바르지 않습니다 (401). 로그아웃 후 다시 로그인하세요.";
  if(status===403)return "권한이 없습니다 (403). 토큰 권한(Contents: Read and write)을 확인하세요.";
  if(status===404)return "파일을 찾을 수 없습니다 (404).";
  if(status===409)return "다른 곳에서 먼저 수정됐습니다 (409). 새로고침 후 다시 시도하세요.";
  return "HTTP "+(status||"?");
}
function fileToBase64(file){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(){var s=String(fr.result);res(s.substring(s.indexOf(",")+1));};
    fr.onerror=rej;fr.readAsDataURL(file);
  });
}

/* ---------- 저장 ---------- */
function saveGuide(msg){
  var json=JSON.stringify(window.GUIDE,null,2);
  toast("저장 중…");
  return ghGet(dataPath()).then(function(cur){
    return ghPut(dataPath(),b64enc(json),cur.sha,msg||"Update guide via admin editor");
  }).then(function(){
    closeOverlay();
    if(window.renderGuide)renderGuide(window.GUIDE);
    toast("저장됨! 1~2분 뒤 사이트에 반영됩니다 ✅");
  }).catch(function(e){toast("저장 실패: "+ghErr(e&&e.status),true);throw e;});
}

/* ---------- 공통 크롬(바/오버레이/토스트) ---------- */
function ensureOverlay(){
  if(!document.getElementById("adOverlay")){
    var ov=document.createElement("div");ov.id="adOverlay";ov.className="ad-overlay";
    ov.addEventListener("click",function(e){if(e.target===ov)closeOverlay();});
    document.body.appendChild(ov);
  }
  if(!document.getElementById("adToast")){
    var t=document.createElement("div");t.id="adToast";document.body.appendChild(t);
  }
}
function ensureBar(){
  if(!isLoggedIn())return;
  if(document.getElementById("adBar"))return;
  var bar=document.createElement("div");bar.id="adBar";
  bar.innerHTML='<span class="ad-dot"></span><b>관리자 모드</b>'+
    '<span class="ad-hint">각 학습자료에서 ✏️ 버튼으로 수정할 수 있습니다</span>'+
    '<span class="ad-spacer"></span>'+
    '<button class="ad-btn-logout" type="button">로그아웃</button>';
  bar.querySelector(".ad-btn-logout").onclick=logout;
  document.body.appendChild(bar);
  document.body.style.paddingBottom="58px";
}
function removeBar(){
  var b=document.getElementById("adBar");if(b)b.remove();
  document.body.style.paddingBottom="";
}
var toastTimer=null;
function toast(msg,isErr){
  ensureOverlay();
  var t=document.getElementById("adToast");
  t.textContent=msg;t.className=isErr?"err on":"on";
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.className="";},isErr?5200:3500);
}

/* ---------- 오버레이 패널 ---------- */
function openPanel(title,bodyHtml,onSave,saveLabel){
  ensureOverlay();
  var ov=document.getElementById("adOverlay");
  ov.innerHTML='<div class="ad-panel">'+
    '<div class="ad-phead"><h3>'+_t(title)+'</h3><button class="ad-pclose" type="button">✕</button></div>'+
    '<div class="ad-pbody">'+bodyHtml+'</div>'+
    '<div class="ad-pfoot"><button class="ad-cancel" type="button">취소</button>'+
    '<button class="ad-save" type="button">'+_t(saveLabel||"저장")+'</button></div></div>';
  ov.classList.add("on");
  ov.querySelector(".ad-pclose").onclick=closeOverlay;
  ov.querySelector(".ad-cancel").onclick=closeOverlay;
  var sb=ov.querySelector(".ad-save");
  sb.onclick=function(){
    sb.disabled=true;
    Promise.resolve().then(onSave).catch(function(){}).then(function(){if(sb)sb.disabled=false;});
  };
  ov.scrollTop=0;
}
function closeOverlay(){var ov=document.getElementById("adOverlay");if(ov){ov.classList.remove("on");ov.innerHTML="";}}

/* ---------- 폼 헬퍼 ---------- */
function field(name,label,type){return '<div class="ad-field"><label>'+_t(label)+'</label><input type="'+(type||"text")+'" id="ad_'+name+'" autocomplete="off"></div>';}
function fieldArea(name,label){return '<div class="ad-field"><label>'+_t(label)+'</label><textarea id="ad_'+name+'"></textarea></div>';}
function val(name){var e=document.getElementById("ad_"+name);return e?e.value:"";}
function setVal(name,v){var e=document.getElementById("ad_"+name);if(e)e.value=(v==null?"":v);}
function opt(v,label,cur){return '<option value="'+v+'"'+(v===cur?" selected":"")+'>'+label+'</option>';}

/* ---------- 로그인 (1단계: 암호 → 2단계: 최초 1회 토큰 등록) ---------- */
function loginDone(){
  closeOverlay();ensureBar();updateIndexButton();
  if(window.GUIDE&&window.renderGuide)renderGuide(window.GUIDE);
  toast("관리자 모드 ✅ ✏️ 편집 버튼이 나타납니다");
}
function openTokenStep(){
  var body=
    '<div class="ad-help" style="margin-bottom:12px">처음 한 번만 GitHub 토큰을 등록하면 이 브라우저에 기억되어, 다음부터는 <b>암호(1234)만</b>으로 로그인됩니다.</div>'+
    '<div class="ad-field"><label>GitHub 토큰 (최초 1회)</label>'+
    '<input type="text" id="ad_token" placeholder="github_pat_..." autocomplete="off"></div>'+
    '<div class="ad-help">토큰은 <b>이 브라우저에만</b> 저장되며 서버로 전송되지 않습니다.<br>'+
    '발급: GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → '+
    'Repository access는 저장소 <b>Self-Directed-Learning</b> 하나만, 권한 <b>Contents: Read and write</b>.</div>';
  openPanel("최초 1회 · 토큰 등록",body,function(){
    var t=val("token").trim();
    if(!t){toast("토큰을 입력하세요",true);return;}
    try{localStorage.setItem(TOKEN_KEY,t);}catch(e){}
    loginDone();
  },"등록하고 시작");
  setVal("token",getToken());
}
function openLogin(){
  var body=
    '<div class="ad-field"><label>관리자 암호</label>'+
    '<input type="password" id="ad_pw" placeholder="암호를 입력하세요" autocomplete="off"></div>'+
    '<div class="ad-help">관리자 암호로 로그인하면 각 학습자료를 직접 수정할 수 있습니다.'+
    (getToken()?'':' <br>(이 기기에서는 최초 1회 GitHub 토큰 등록이 필요합니다.)')+'</div>'+
    (getToken()?'<button class="ad-mini ad-del" id="ad_forget" type="button" style="margin-top:4px">이 기기에서 토큰 삭제</button>':'');
  openPanel("관리자 로그인",body,function(){
    var p=val("pw");
    if(p!==ADMIN_PW){toast("암호가 올바르지 않습니다",true);return;}
    setPwOk();
    if(getToken()){loginDone();}
    else{openTokenStep();}
  },"로그인");
  setTimeout(function(){var e=document.getElementById("ad_pw");if(e)e.focus();},50);
  var fg=document.getElementById("ad_forget");
  if(fg)fg.onclick=function(){
    if(!confirm("이 기기에 저장된 GitHub 토큰을 삭제할까요? 다음에 다시 등록해야 합니다."))return;
    try{localStorage.removeItem(TOKEN_KEY);}catch(e){}
    clearPwOk();removeBar();updateIndexButton();
    if(window.GUIDE&&window.renderGuide)renderGuide(window.GUIDE);
    closeOverlay();toast("토큰이 삭제되었습니다");
  };
}
function logout(){
  clearPwOk();
  removeBar();updateIndexButton();
  if(window.GUIDE&&window.renderGuide)renderGuide(window.GUIDE);
  toast("로그아웃되었습니다");
}
function updateIndexButton(){
  var b=document.getElementById("adminBtn");if(!b)return;
  b.textContent=isLoggedIn()?"🔧 관리자 모드 ON":"🔧 관리자";
}

/* ---------- 가이드 페이지 편집 버튼 주입 ---------- */
function decorate(){
  if(!isLoggedIn())return;
  ensureOverlay();ensureBar();
  var hero=document.getElementById("heroIn");
  if(hero&&!hero.querySelector(".ad-hero-tools")){
    var tools=document.createElement("div");tools.className="ad-hero-tools";
    tools.innerHTML='<button class="ad-edit ad-ghost" type="button" data-a="hero">✏️ 제목/소개 수정</button>'+
                    '<button class="ad-edit ad-ghost" type="button" data-a="ig">🖼️ 인포그래픽 교체</button>';
    hero.appendChild(tools);
    tools.querySelector('[data-a=hero]').onclick=openHeroEditor;
    tools.querySelector('[data-a=ig]').onclick=openInfographicEditor;
  }
  var secs=document.querySelectorAll("#wrap > section");
  Array.prototype.forEach.call(secs,function(secEl,i){
    var sh=secEl.querySelector(".sh");
    if(sh&&!sh.querySelector(".ad-sec-edit")){
      var b=document.createElement("button");b.type="button";b.className="ad-edit ad-sec-edit";
      b.textContent="✏️ 이 섹션 수정";b.onclick=function(){openSectionEditor(i);};
      sh.appendChild(b);
    }
    Array.prototype.forEach.call(secEl.querySelectorAll(".card"),function(cardEl){
      if(cardEl.querySelector(".ad-card-edit"))return;
      var si=parseInt(cardEl.getAttribute("data-sec"),10);
      var ci=parseInt(cardEl.getAttribute("data-card"),10);
      var cb=document.createElement("button");cb.type="button";cb.className="ad-edit ad-card-edit";
      cb.textContent="✏️ 수정";
      cb.onclick=function(ev){ev.stopPropagation();openCardEditor(si,ci);};
      cardEl.appendChild(cb);
    });
  });
}

/* ---------- 히어로 편집 ---------- */
function openHeroEditor(){
  var h=window.GUIDE.hero||{},ig=window.GUIDE.infographic||{};
  var body=field("badge","배지 문구")+field("title","제목")+field("titleSpan","부제(강조색)")+
    fieldArea("subtitle","소개 문단")+fieldArea("tip","안내 팁 (HTML 사용 가능)")+
    field("igbtn","인포그래픽 버튼 문구");
  openPanel("제목 · 소개 수정",body,function(){
    window.GUIDE.hero=window.GUIDE.hero||{};
    window.GUIDE.hero.badge=val("badge");window.GUIDE.hero.title=val("title");
    window.GUIDE.hero.titleSpan=val("titleSpan");window.GUIDE.hero.subtitle=val("subtitle");
    window.GUIDE.hero.tip=val("tip");
    window.GUIDE.infographic=window.GUIDE.infographic||{};
    window.GUIDE.infographic.buttonLabel=val("igbtn");
    return saveGuide("Update hero (admin)");
  });
  setVal("badge",h.badge);setVal("title",h.title);setVal("titleSpan",h.titleSpan);
  setVal("subtitle",h.subtitle);setVal("tip",h.tip);setVal("igbtn",ig.buttonLabel);
}

/* ---------- 인포그래픽 교체 ---------- */
function openInfographicEditor(){
  var ig=window.GUIDE.infographic||{};
  var body=
    '<div class="ad-field"><label>현재 인포그래픽</label>'+
    '<img class="ad-preview'+(ig.src?" on":"")+'" id="ad_prev" src="'+_t(ig.src)+'?_='+new Date().getTime()+'" alt=""></div>'+
    '<div class="ad-field"><label>새 이미지 선택 (PNG/JPG)</label><input type="file" id="ad_file" accept="image/*"></div>'+
    field("igname","다운로드 파일명")+
    '<div class="ad-help">이미지를 선택하고 저장하면 저장소의 <b>'+_t(ig.src)+'</b> 파일을 교체합니다. 1~2분 뒤 반영됩니다.</div>';
  openPanel("인포그래픽 교체",body,function(){
    window.GUIDE.infographic=window.GUIDE.infographic||{};
    window.GUIDE.infographic.name=val("igname");
    var fi=document.getElementById("ad_file");
    var f=fi&&fi.files&&fi.files[0];
    if(!f)return saveGuide("Update infographic meta (admin)");
    var path=window.GUIDE.infographic.src;
    if(!path){toast("인포그래픽 경로가 없습니다",true);return;}
    toast("이미지 업로드 중…");
    return fileToBase64(f).then(function(b64){
      return ghGet(path).then(function(cur){return ghPut(path,b64,cur.sha,"Update infographic image (admin)");});
    }).then(function(){return saveGuide("Update infographic (admin)");});
  });
  setVal("igname",ig.name);
  setTimeout(function(){
    var fi=document.getElementById("ad_file");
    if(fi)fi.onchange=function(){
      var f=fi.files&&fi.files[0];if(!f)return;
      var pv=document.getElementById("ad_prev");if(pv){pv.src=URL.createObjectURL(f);pv.classList.add("on");}
    };
  },0);
}

/* ---------- 섹션 편집 ---------- */
function openSectionEditor(i){
  var work=clone(window.GUIDE.sections[i]);
  var body=field("no","섹션 번호 (예: SECTION 03)")+field("title","섹션 제목")+fieldArea("desc","섹션 설명")+
    (work.type==="cards"?field("hint","힌트 문구 (선택)"):"")+'<div id="ad_sub"></div>';
  openPanel("섹션 수정 — "+_t(work.no),body,function(){
    work.no=val("no");work.title=val("title");work.desc=val("desc");
    if(work.type==="cards")work.hint=val("hint");
    collectSub(work);
    window.GUIDE.sections[i]=work;
    return saveGuide("Update section (admin)");
  });
  setVal("no",work.no);setVal("title",work.title);setVal("desc",work.desc);
  if(work.type==="cards")setVal("hint",work.hint);
  buildSub(work);
}
function buildSub(work){
  var host=document.getElementById("ad_sub");if(!host)return;
  if(work.type==="cards"){host.innerHTML=cardsSubHtml(work);wireCardsSub(host,work);}
  else if(work.type==="table"){host.innerHTML=tableSubHtml(work);wireTableSub(host,work);}
  else if(work.type==="boxes"){host.innerHTML=boxesSubHtml(work);wireBoxesSub(host,work);}
  else host.innerHTML="";
}
function collectSub(work){
  var host=document.getElementById("ad_sub");if(!host)return;
  if(work.type==="table")syncTableFromDOM(work,host);
  else if(work.type==="boxes")syncBoxesFromDOM(work,host);
}

/* cards 하위편집 */
function cardsSubHtml(work){
  var rows=(work.cards||[]).map(function(c,ci){
    return '<div class="ad-item"><span class="ad-item-t">'+(ci+1)+". "+_t(c.title)+'</span>'+
      '<div class="ad-row-btns">'+
      '<button class="ad-mini" type="button" data-up="'+ci+'">▲</button>'+
      '<button class="ad-mini" type="button" data-down="'+ci+'">▼</button>'+
      '<button class="ad-mini ad-del" type="button" data-del="'+ci+'">삭제</button></div></div>';
  }).join("");
  return '<div class="ad-field"><label>카드(단계) 목록</label><div class="ad-list">'+rows+'</div>'+
    '<button class="ad-add" type="button" data-add="1">+ 카드 추가</button>'+
    '<div class="ad-help">카드 내용(제목·아이콘·단계 상세)은 페이지에서 각 카드의 <b>✏️ 수정</b> 버튼으로 편집하세요.</div></div>';
}
function wireCardsSub(host,work){
  host.querySelectorAll("[data-up]").forEach(function(b){b.onclick=function(){var i=+b.getAttribute("data-up");if(i>0){var a=work.cards;var tmp=a[i-1];a[i-1]=a[i];a[i]=tmp;buildSub(work);}};});
  host.querySelectorAll("[data-down]").forEach(function(b){b.onclick=function(){var i=+b.getAttribute("data-down");var a=work.cards;if(i<a.length-1){var tmp=a[i+1];a[i+1]=a[i];a[i]=tmp;buildSub(work);}};});
  host.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){var i=+b.getAttribute("data-del");if(confirm("이 카드를 삭제할까요?")){work.cards.splice(i,1);buildSub(work);}};});
  var add=host.querySelector("[data-add]");if(add)add.onclick=function(){
    work.cards.push({tag:"항목",tagClass:"tn",ico:"📌",title:"새 카드",desc:"",modalTitle:"새 카드",modalBody:"<p>내용을 입력하세요.</p>"});
    buildSub(work);
  };
}

/* table 하위편집 */
function tableSubHtml(work){
  var t=work.table||(work.table={headers:[],rows:[]});
  var cols=t.headers.length,h,c;
  h='<div class="ad-field"><label>표 편집</label><div class="ad-tbl-tools">'+
    '<button class="ad-mini" type="button" data-addrow="1">+ 행 추가</button>'+
    '<button class="ad-mini" type="button" data-addcol="1">+ 열 추가</button></div>'+
    '<div class="ad-tblwrap"><table class="ad-tbl">';
  h+="<tr>";for(c=0;c<cols;c++)h+='<th><button class="ad-mini ad-del" type="button" data-delcol="'+c+'">열삭제</button></th>';h+="<th></th></tr>";
  h+="<tr>";for(c=0;c<cols;c++)h+='<td><textarea data-h="'+c+'">'+_t(t.headers[c])+"</textarea></td>";h+="<td></td></tr>";
  (t.rows||[]).forEach(function(row,ri){
    h+="<tr>";for(c=0;c<cols;c++)h+='<td><textarea data-r="'+ri+'" data-c="'+c+'">'+_t(row[c]||"")+"</textarea></td>";
    h+='<td><button class="ad-mini ad-del" type="button" data-delrow="'+ri+'">행삭제</button></td></tr>';
  });
  h+="</table></div><div class=\"ad-help\">셀 안에는 <b>&lt;b&gt;</b>(굵게), <b>&lt;br&gt;</b>(줄바꿈) 같은 태그를 쓸 수 있습니다.</div></div>";
  return h;
}
function syncTableFromDOM(work,host){
  var t=work.table;if(!t)return;
  host.querySelectorAll("textarea[data-h]").forEach(function(ta){t.headers[+ta.getAttribute("data-h")]=ta.value;});
  host.querySelectorAll("textarea[data-r]").forEach(function(ta){
    var r=+ta.getAttribute("data-r"),c=+ta.getAttribute("data-c");
    t.rows[r]=t.rows[r]||[];t.rows[r][c]=ta.value;
  });
}
function wireTableSub(host,work){
  var t=work.table;
  var ar=host.querySelector("[data-addrow]");if(ar)ar.onclick=function(){syncTableFromDOM(work,host);var row=[];for(var c=0;c<t.headers.length;c++)row.push("");t.rows.push(row);buildSub(work);};
  var ac=host.querySelector("[data-addcol]");if(ac)ac.onclick=function(){syncTableFromDOM(work,host);t.headers.push("제목");t.rows.forEach(function(r){r.push("");});buildSub(work);};
  host.querySelectorAll("[data-delcol]").forEach(function(b){b.onclick=function(){syncTableFromDOM(work,host);var c=+b.getAttribute("data-delcol");t.headers.splice(c,1);t.rows.forEach(function(r){r.splice(c,1);});buildSub(work);};});
  host.querySelectorAll("[data-delrow]").forEach(function(b){b.onclick=function(){syncTableFromDOM(work,host);var r=+b.getAttribute("data-delrow");t.rows.splice(r,1);buildSub(work);};});
}

/* boxes 하위편집 */
function boxesSubHtml(work){
  var rows=(work.boxes||[]).map(function(b,bi){
    return '<div class="ad-field" style="border:1.5px solid #EEE7DF;border-radius:10px;padding:10px">'+
      '<label>박스 '+(bi+1)+'</label>'+
      '<select data-bk="'+bi+'">'+opt("note","노랑(안내)",b.kind)+opt("ok","초록(강조)",b.kind)+opt("bad","빨강(주의)",b.kind)+'</select>'+
      '<textarea data-bh="'+bi+'" style="margin-top:8px">'+_t(b.html)+'</textarea>'+
      '<div class="ad-row-btns" style="margin-top:8px"><button class="ad-mini ad-del" type="button" data-delbox="'+bi+'">삭제</button></div></div>';
  }).join("");
  return '<div class="ad-field"><label>강조 박스 목록</label>'+rows+
    '<button class="ad-add" type="button" data-addbox="1">+ 박스 추가</button></div>';
}
function syncBoxesFromDOM(work,host){
  work.boxes=work.boxes||[];
  host.querySelectorAll("select[data-bk]").forEach(function(s){var i=+s.getAttribute("data-bk");work.boxes[i]=work.boxes[i]||{};work.boxes[i].kind=s.value;});
  host.querySelectorAll("textarea[data-bh]").forEach(function(ta){var i=+ta.getAttribute("data-bh");work.boxes[i]=work.boxes[i]||{};work.boxes[i].html=ta.value;});
}
function wireBoxesSub(host,work){
  var ab=host.querySelector("[data-addbox]");if(ab)ab.onclick=function(){syncBoxesFromDOM(work,host);work.boxes.push({kind:"note",html:"내용을 입력하세요."});buildSub(work);};
  host.querySelectorAll("[data-delbox]").forEach(function(b){b.onclick=function(){syncBoxesFromDOM(work,host);var i=+b.getAttribute("data-delbox");work.boxes.splice(i,1);buildSub(work);};});
}

/* ---------- 카드/단계 편집 (WYSIWYG) ---------- */
function openCardEditor(si,ci){
  var work=clone(window.GUIDE.sections[si].cards[ci]);
  var body=field("ctag","태그 (예: 1단계)")+
    '<div class="ad-field"><label>태그 색상</label><select id="ad_ctagcls">'+
      opt("tn","파랑",work.tagClass)+opt("to","주황",work.tagClass)+opt("tg","초록",work.tagClass)+opt("tr","빨강",work.tagClass)+
    '</select></div>'+
    field("cico","아이콘 (이모지)")+field("ctitle","카드 제목")+fieldArea("cdesc","카드 설명 (카드에 보이는 한 줄 요약)")+
    field("cmtitle","팝업 제목")+
    '<div class="ad-field"><label>단계 상세 내용 (팝업에 표시)</label>'+
    '<div class="ad-wtoolbar">'+
      '<button type="button" data-w="p">문단</button>'+
      '<button type="button" data-w="h4">소제목</button>'+
      '<button type="button" data-w="bold">굵게</button>'+
      '<button type="button" data-w="ul">목록</button>'+
      '<button type="button" data-w="ok">초록박스</button>'+
      '<button type="button" data-w="note">노랑박스</button>'+
      '<button type="button" data-w="bad">빨강박스</button>'+
      '<button type="button" data-w="html">HTML 보기</button>'+
    '</div>'+
    '<div class="ad-wysi" id="ad_wysi" contenteditable="true"></div>'+
    '<textarea class="ad-htmlarea" id="ad_html"></textarea>'+
    '<div class="ad-help">글자를 직접 고치고, 위 버튼으로 소제목·목록·강조박스를 넣을 수 있어요. 표가 필요하면 [HTML 보기]에서 직접 편집하세요.</div></div>';
  openPanel("카드 · 단계 수정",body,function(){
    work.tag=val("ctag");
    var sc=document.getElementById("ad_ctagcls");work.tagClass=sc?sc.value:work.tagClass;
    work.ico=val("cico");work.title=val("ctitle");work.desc=val("cdesc");
    work.modalTitle=val("cmtitle");work.modalBody=getBody();
    window.GUIDE.sections[si].cards[ci]=work;
    return saveGuide("Update card (admin)");
  });
  setVal("ctag",work.tag);setVal("cico",work.ico);setVal("ctitle",work.title);
  setVal("cdesc",work.desc);setVal("cmtitle",work.modalTitle);
  var wysi=document.getElementById("ad_wysi");if(wysi)wysi.innerHTML=work.modalBody||"";
  wireWysi();
}
function wireWysi(){
  var wysi=document.getElementById("ad_wysi"),html=document.getElementById("ad_html");
  document.querySelectorAll(".ad-wtoolbar button").forEach(function(b){
    b.onclick=function(){
      var a=b.getAttribute("data-w");
      if(a==="html"){
        if(html.style.display==="block"){wysi.innerHTML=html.value;html.style.display="none";wysi.style.display="block";b.textContent="HTML 보기";}
        else{html.value=wysi.innerHTML;html.style.display="block";wysi.style.display="none";b.textContent="화면 보기";}
        return;
      }
      wysi.focus();
      if(a==="bold"){document.execCommand("bold",false,null);return;}
      var ins={p:"<p>내용</p>",h4:"<h4>소제목</h4>",ul:'<ul><li class="n">항목</li></ul>',
        ok:'<div class="ok">내용</div>',note:'<div class="note">내용</div>',bad:'<div class="bad">내용</div>'}[a];
      if(ins){try{document.execCommand("insertHTML",false,ins);}catch(e){wysi.innerHTML+=ins;}}
    };
  });
}
function getBody(){
  var wysi=document.getElementById("ad_wysi"),html=document.getElementById("ad_html");
  if(html&&html.style.display==="block")return html.value;
  return wysi?wysi.innerHTML:"";
}

/* ---------- 노출 & 초기화 ---------- */
window.AdminEditor={isLoggedIn:isLoggedIn,openLogin:openLogin,logout:logout,decorateGuide:decorate};
document.addEventListener("DOMContentLoaded",function(){
  ensureOverlay();
  if(isLoggedIn())ensureBar();
  updateIndexButton();
});
})();
