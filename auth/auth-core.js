/* ═══════════════════════════════════════════════════════════════
   auth-core.js — 로그인 모듈의 공통 엔진
   · 화면(login/admin/guard)은 모두 window.AUTH 의 함수만 부른다.
   · 실제 저장소는 두 가지 중 하나: DemoBackend(이 브라우저 localStorage) / SupabaseBackend(운영)
   · 사번: 영문·숫자 6자리, 대소문자 구분 없음 → 항상 소문자로 통일
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.AUTH) return;
  var C = window.AUTH_CONFIG || { mode: 'demo', sessionHours: 24, adminId: '313766' };
  var SESS_KEY = 'sdl_auth_session';
  var HOUR = 3600 * 1000;

  function normId(id) { return String(id || '').trim().toLowerCase(); }
  function validId(id) { return /^[0-9a-z]{6}$/.test(normId(id)); }
  function pwRule(pw) {
    if (!pw || pw.length < 8) return '8자 이상으로 입력해 주세요.';
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return '영문과 숫자를 함께 넣어 주세요.';
    return '';
  }
  function now() { return new Date().toISOString(); }
  /* 최초 로그인 때 본인이 직접 입력하는 소속 정보 4가지 */
  var ORG = ['company', 'region', 'vision_center', 'branch'];
  var SELF = ['phone', 'company', 'region', 'vision_center', 'branch'];   /* 본인이 고칠 수 있는 항목 */
  function profileDone(m) { return ORG.every(function (k) { return String(m[k] || '').trim(); }); }
  async function sha256(s) {
    var b = new TextEncoder().encode(s);
    var h = await crypto.subtle.digest('SHA-256', b);
    return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function err(msg) { var e = new Error(msg); e.userMsg = msg; return e; }

  /* ── 세션(이 기기) : 24시간 유지 ─────────────────────────── */
  function readSess() {
    try {
      var s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
      if (!s || !s.emp || !s.exp || Date.now() > s.exp) return null;
      return s;
    } catch (_) { return null; }
  }
  function writeSess(m) {
    var s = { emp: m.emp_id, name: m.name || '', role: m.role || 'member', mustChange: !!m.must_change_pw,
              consent: !!m.consent_at, kakao: !!m.kakao_linked, profile: profileDone(m), at: Date.now(), exp: Date.now() + (C.sessionHours || 24) * HOUR };
    try { localStorage.setItem(SESS_KEY, JSON.stringify(s)); } catch (_) {}
    return s;
  }
  function patchSess(p) { var s = readSess(); if (!s) return null; for (var k in p) s[k] = p[k]; try { localStorage.setItem(SESS_KEY, JSON.stringify(s)); } catch (_) {} return s; }
  function clearSess() { try { localStorage.removeItem(SESS_KEY); } catch (_) {} }

  /* ═══ DemoBackend — 이 브라우저 안에만 저장되는 체험용 서버 ═══ */
  function DemoBackend() {
    var DB = 'sdl_auth_demo_db';
    function load() {
      var d; try { d = JSON.parse(localStorage.getItem(DB) || 'null'); } catch (_) {}
      if (!d) d = { members: {}, pw: {}, kakao: {}, activity: [] };
      return d;
    }
    function save(d) { localStorage.setItem(DB, JSON.stringify(d)); }
    async function ensureSeed() {
      var d = load();
      var a = normId(C.adminId || '313766');
      if (!d.members[a]) {
        d.members[a] = { emp_id: a, name: '관리자', phone: '', company: '', region: '', vision_center: '', branch: '', note: '체험 모드 관리자',
                         role: 'admin', must_change_pw: true, kakao_linked: false, consent_at: null, created_at: now() };
        /* 체험 모드 관리자의 첫 비밀번호는 사번(운영 모드의 실제 비밀번호는 서버에만 있다) */
        d.pw[a] = await sha256(a + ':' + a);
        save(d);
      }
      return d;
    }
    var me = function () { var s = readSess(); return s && s.emp; };
    function isAdmin() { var s = readSess(); return s && s.role === 'admin'; }
    return {
      kind: 'demo',
      login: async function (id, pw) {
        var d = await ensureSeed(); id = normId(id);
        var m = d.members[id];
        if (!m || d.pw[id] !== await sha256(id + ':' + pw)) throw err('사번 또는 비밀번호가 맞지 않습니다.');
        return m;
      },
      logout: async function () {},
      check: async function () { var d = load(); var id = me(); return id ? d.members[id] || null : null; },
      changePassword: async function (pw, cur) {
        var d = load(), id = me(); if (!id) throw err('로그인이 필요합니다.');
        if (cur !== undefined && d.pw[id] !== await sha256(id + ':' + cur)) throw err('현재 비밀번호가 맞지 않습니다.');
        d.pw[id] = await sha256(id + ':' + pw); d.members[id].must_change_pw = false; save(d); return d.members[id];
      },
      consent: async function () { var d = load(), id = me(); d.members[id].consent_at = now(); save(d); return d.members[id]; },
      updateProfile: async function (p) {
        var d = load(), id = me(); if (!id) throw err('로그인이 필요합니다.');
        SELF.forEach(function (k) { if (p[k] !== undefined) d.members[id][k] = String(p[k] || '').trim(); }); save(d); return d.members[id];
      },
      linkKakao: async function () {
        var d = load(), id = me(); var k = 'demo-kakao-' + id;
        d.kakao[k] = id; d.members[id].kakao_linked = true; save(d); return d.members[id];
      },
      /* 체험 모드: 카카오 화면 대신 '카카오 확인 성공'으로 간주하고 사번만 대조 */
      kakaoReset: async function (id, pw) {
        var d = load(); id = normId(id);
        var m = d.members[id]; if (!m) throw err('등록되지 않은 사번입니다.');
        if (!m.kakao_linked) throw err('카카오 계정이 연결되지 않은 사번입니다. 관리자에게 초기화를 요청해 주세요.');
        d.pw[id] = await sha256(id + ':' + pw); m.must_change_pw = false; save(d); return m;
      },
      log: async function (ev) {
        var d = load(), id = me(); if (!id) return;
        ev.emp_id = id; ev.at = ev.at || now(); ev.id = d.activity.length + 1; d.activity.push(ev);
        if (d.activity.length > 20000) d.activity = d.activity.slice(-20000);
        save(d);
      },
      /* 관리자 */
      listMembers: async function () { if (!isAdmin()) throw err('관리자만 볼 수 있습니다.'); var d = await ensureSeed(); return Object.keys(d.members).map(function (k) { return d.members[k]; }); },
      upsertMember: async function (m) {
        if (!isAdmin()) throw err('관리자만 할 수 있습니다.');
        var d = load(); var id = normId(m.emp_id); if (!validId(id)) throw err('사번은 영문·숫자 6자리입니다: ' + m.emp_id);
        var cur = d.members[id];
        if (!cur) {
          cur = { emp_id: id, name: '', phone: '', company: '', region: '', vision_center: '', branch: '', note: '',
                  role: 'member', must_change_pw: true, kakao_linked: false, consent_at: null, created_at: now() };
          d.pw[id] = await sha256(id + ':' + id);
        }
        ['name', 'phone', 'company', 'region', 'vision_center', 'branch', 'note'].forEach(function (k) { if (m[k] !== undefined) cur[k] = String(m[k] || ''); });
        d.members[id] = cur; save(d); return cur;
      },
      deleteMember: async function (id) {
        if (!isAdmin()) throw err('관리자만 할 수 있습니다.'); id = normId(id);
        if (id === normId(C.adminId)) throw err('관리자 계정은 삭제할 수 없습니다.');
        var d = load(); delete d.members[id]; delete d.pw[id];
        Object.keys(d.kakao).forEach(function (k) { if (d.kakao[k] === id) delete d.kakao[k]; }); save(d);
      },
      resetPassword: async function (id) {
        if (!isAdmin()) throw err('관리자만 할 수 있습니다.'); id = normId(id);
        var d = load(); if (!d.members[id]) throw err('없는 사번입니다.');
        d.pw[id] = await sha256(id + ':' + id); d.members[id].must_change_pw = true; save(d);
      },
      unlinkKakao: async function (id) {
        if (!isAdmin()) throw err('관리자만 할 수 있습니다.'); id = normId(id);
        var d = load(); Object.keys(d.kakao).forEach(function (k) { if (d.kakao[k] === id) delete d.kakao[k]; });
        if (d.members[id]) d.members[id].kakao_linked = false; save(d);
      },
      listActivity: async function (f) {
        if (!isAdmin()) throw err('관리자만 볼 수 있습니다.');
        f = f || {}; var d = load();
        return d.activity.filter(function (a) {
          if (f.from && a.at < f.from) return false;
          if (f.to && a.at > f.to) return false;
          if (f.emp && a.emp_id !== normId(f.emp)) return false;
          if (f.page && a.page !== f.page) return false;
          return true;
        }).slice().reverse();
      }
    };
  }

  /* ═══ SupabaseBackend — 운영 ═══ */
  function SupabaseBackend() {
    if (!window.supabase || !C.supabaseUrl || !C.supabaseAnonKey) throw err('Supabase 설정이 비어 있습니다.');
    var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sdl_sb_auth' }
    });
    var mail = function (id) { return normId(id) + '@emp.local'; };
    async function myRow() {
      var u = (await sb.auth.getUser()).data.user; if (!u) return null;
      var r = await sb.from('members').select('*').eq('user_id', u.id).maybeSingle();
      return r.data || null;
    }
    async function fn(action, body) {
      var r = await sb.functions.invoke('admin-users', { body: Object.assign({ action: action }, body || {}) });
      if (r.error) { var m = r.error.context && r.error.context.json ? (await r.error.context.json()).error : r.error.message; throw err(m || '서버 오류'); }
      if (r.data && r.data.error) throw err(r.data.error);
      return r.data;
    }
    var back = location.href.split('#')[0];
    return {
      kind: 'supabase', client: sb,
      login: async function (id, pw) {
        var r = await sb.auth.signInWithPassword({ email: mail(id), password: pw });
        if (r.error) throw err('사번 또는 비밀번호가 맞지 않습니다.');
        var m = await myRow(); if (!m) { await sb.auth.signOut(); throw err('등록 정보가 없습니다. 관리자에게 문의해 주세요.'); }
        return m;
      },
      logout: async function () { await sb.auth.signOut(); },
      check: async function () { return await myRow(); },
      changePassword: async function (pw) {
        var r = await sb.auth.updateUser({ password: pw }); if (r.error) throw err('비밀번호를 바꾸지 못했습니다: ' + r.error.message);
        await sb.rpc('me_password_changed'); return await myRow();
      },
      consent: async function () { await sb.rpc('me_consent'); return await myRow(); },
      /* 카카오 연결: 로그인 상태에서 카카오 계정을 이 사번에 붙인다 (Supabase 수동 연결 기능) */
      linkKakao: async function () {
        var r = await sb.auth.linkIdentity({ provider: 'kakao', options: { redirectTo: back.split('?')[0] + '?kakao=linked' } });
        if (r.error) throw err('카카오 연결을 시작하지 못했습니다: ' + r.error.message);
        return null; /* 카카오 화면으로 이동 */
      },
      kakaoLinkedDone: async function () { await sb.rpc('me_kakao_linked'); return await myRow(); },
      /* 비밀번호 찾기: 카카오로 로그인 → 연결된 사번이면 그대로 로그인된 상태 → 새 비밀번호 설정 */
      kakaoSignIn: async function (id) {
        try { sessionStorage.setItem('sdl_reset_emp', normId(id)); } catch (_) {}
        var r = await sb.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: back.split('?')[0] + '?kakao=reset' } });
        if (r.error) throw err('카카오 확인을 시작하지 못했습니다: ' + r.error.message);
      },
      kakaoResetFinish: async function (pw) {
        var want = ''; try { want = sessionStorage.getItem('sdl_reset_emp') || ''; } catch (_) {}
        var m = await myRow();
        if (!m || (want && m.emp_id !== want)) { await sb.auth.signOut(); throw err('이 카카오 계정에 연결된 사번이 입력한 사번과 다릅니다.'); }
        var r = await sb.auth.updateUser({ password: pw }); if (r.error) throw err(r.error.message);
        await sb.rpc('me_password_changed'); return await myRow();
      },
      log: async function (ev) {
        var m = readSess(); if (!m) return;
        ev.emp_id = m.emp; await sb.from('activity').insert(ev);
      },
      listMembers: async function () { var r = await sb.from('members').select('*').order('emp_id'); if (r.error) throw err(r.error.message); return r.data; },
      upsertMember: async function (m) { m.emp_id = normId(m.emp_id); if (!validId(m.emp_id)) throw err('사번은 영문·숫자 6자리입니다: ' + m.emp_id); return (await fn('upsert', { member: m })).member; },
      deleteMember: async function (id) { return fn('delete', { emp_id: normId(id) }); },
      resetPassword: async function (id) { return fn('reset', { emp_id: normId(id) }); },
      unlinkKakao: async function (id) { return fn('unlink_kakao', { emp_id: normId(id) }); },
      listActivity: async function (f) {
        f = f || {}; var q = sb.from('activity').select('*').order('at', { ascending: false }).limit(20000);
        if (f.from) q = q.gte('at', f.from); if (f.to) q = q.lte('at', f.to);
        if (f.emp) q = q.eq('emp_id', normId(f.emp)); if (f.page) q = q.eq('page', f.page);
        var r = await q; if (r.error) throw err(r.error.message); return r.data;
      }
    };
  }

  /* ═══ FirebaseBackend — 운영 (Google Firebase: Authentication + Firestore) ═══
     · 로그인 아이디는 {사번}@emp.local, 회원 정보는 members/{사번}, 기록은 activity 컬렉션
     · 무료(Spark) 요금제로 되는 것: 로그인·최초 비번 변경·동의·내 정보 수정·관리자 등록/일괄 등록/정보 수정·기록·통계
     · 서버 함수(Cloud Functions, Blaze 요금제)가 있어야 되는 것: 관리자 비밀번호 초기화, 계정 완전 삭제, 카카오 비밀번호 찾기 */
  function FirebaseBackend() {
    var F = C.firebase || {};
    if (!window.firebase || !F.apiKey) throw err('Firebase 설정이 비어 있습니다.');
    var app = firebase.apps.filter(function (a) { return a.name === 'sdl'; })[0] || firebase.initializeApp(F, 'sdl');
    var auth = app.auth(), db = app.firestore();
    /* 이미 쓰고 있는 다른 프로그램(고객 컨설팅 관리)과 섞이지 않게 컬렉션 이름에 sdl_ 을 붙인다 */
    var COL = { members: (F.prefix || 'sdl_') + 'members', activity: (F.prefix || 'sdl_') + 'activity' };
    var mail = function (id) { return normId(id) + '@emp.local'; };
    function waitUser() { return new Promise(function (ok) { var off = auth.onAuthStateChanged(function (u) { off(); ok(u); }); }); }
    async function myRow() {
      var u = auth.currentUser || await waitUser(); if (!u) return null;
      var d = await db.collection(COL.members).doc(u.email.split('@')[0]).get();
      return d.exists ? d.data() : null;
    }
    function fnCall(name, data) {
      if (!app.functions) throw err('서버 함수가 준비되지 않았습니다.');
      return app.functions(F.functionsRegion || 'asia-northeast3').httpsCallable(name)(data).then(function (r) { return r.data; })
        .catch(function (e) { throw err(e.code === 'functions/not-found' || e.code === 'functions/internal'
          ? '이 기능은 Firebase 서버 함수(Blaze 요금제) 설치 후 사용할 수 있습니다.' : (e.message || '서버 오류')); });
    }
    var me = function () { var s = readSess(); return s && s.emp; };
    return {
      kind: 'firebase', app: app,
      login: async function (id, pw) {
        try { await auth.signInWithEmailAndPassword(mail(id), pw); } catch (e) { throw err('사번 또는 비밀번호가 맞지 않습니다.'); }
        var m = await myRow(); if (!m) { await auth.signOut(); throw err('등록 정보가 없습니다. 관리자에게 문의해 주세요.'); }
        return m;
      },
      logout: async function () { await auth.signOut(); },
      check: async function () { return await myRow(); },
      changePassword: async function (pw, cur) {
        var u = auth.currentUser || await waitUser(); if (!u) throw err('로그인이 필요합니다.');
        if (cur !== undefined) {
          try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, cur)); }
          catch (e) { throw err('현재 비밀번호가 맞지 않습니다.'); }
        }
        try { await u.updatePassword(pw); }
        catch (e) { throw err(e.code === 'auth/requires-recent-login' ? '보안을 위해 다시 로그인한 뒤 바꿔 주세요.' : '비밀번호를 바꾸지 못했습니다.'); }
        await db.collection(COL.members).doc(me()).update({ must_change_pw: false }); return await myRow();
      },
      consent: async function () { await db.collection(COL.members).doc(me()).update({ consent_at: now() }); return await myRow(); },
      updateProfile: async function (p) {
        var patch = {}; SELF.forEach(function (k) { if (p[k] !== undefined) patch[k] = String(p[k] || '').trim(); });
        await db.collection(COL.members).doc(me()).update(patch); return await myRow();
      },
      /* 최초 1회: 관리자 계정 만들기 (보안 규칙이 관리자 사번·관리자 역할·문서 없음일 때만 허용) */
      setupAdmin: async function (pw) {
        var id = normId(C.adminId);
        try { await auth.createUserWithEmailAndPassword(mail(id), pw); } catch (e) { throw err(e.code === 'auth/email-already-in-use' ? '관리자 계정이 이미 있습니다.' : (e.message || e.code)); }
        await db.collection(COL.members).doc(id).set({ emp_id: id, name: '관리자', phone: '', company: '', region: '', vision_center: '', branch: '', note: '',
          role: 'admin', must_change_pw: false, kakao_linked: false, consent_at: now(), created_at: now() });
        await auth.signOut();
      },
      linkKakao: async function () { throw err('카카오 연결은 Firebase 서버 함수 설치 후 사용할 수 있습니다. 지금은 관리자 초기화를 이용해 주세요.'); },
      kakaoReset: async function () { throw err('카카오 비밀번호 찾기는 준비 중입니다. 관리자에게 초기화를 요청해 주세요.'); },
      log: async function (ev) { var id = me(); if (!id) return; ev.emp_id = id; ev.at = now(); await db.collection(COL.activity).add(ev); },
      listMembers: async function () { var q = await db.collection(COL.members).get(); return q.docs.map(function (d) { return d.data(); }); },
      upsertMember: async function (m) {
        var id = normId(m.emp_id); if (!validId(id)) throw err('사번은 영문·숫자 6자리입니다: ' + m.emp_id);
        var ref = db.collection(COL.members).doc(id), cur = await ref.get(), patch = {};
        ['name', 'phone', 'company', 'region', 'vision_center', 'branch', 'note'].forEach(function (k) { if (m[k] !== undefined) patch[k] = String(m[k] || '').trim(); });
        if (cur.exists) { await ref.update(patch); return Object.assign(cur.data(), patch); }
        /* 관리자 로그인을 유지한 채 새 계정을 만들기 위해 보조 앱 인스턴스를 쓴다 */
        var sec = firebase.apps.filter(function (a) { return a.name === 'sdl-create'; })[0] || firebase.initializeApp(F, 'sdl-create');
        try { await sec.auth().createUserWithEmailAndPassword(mail(id), id); }
        catch (e) { if (e.code !== 'auth/email-already-in-use') throw err('계정을 만들지 못했습니다: ' + (e.message || e.code)); }
        await sec.auth().signOut();
        var row = Object.assign({ emp_id: id, name: '', phone: '', company: '', region: '', vision_center: '', branch: '', note: '',
          role: 'member', must_change_pw: true, kakao_linked: false, consent_at: null, created_at: now() }, patch);
        await ref.set(row); return row;
      },
      deleteMember: async function (id) {
        id = normId(id); if (id === normId(C.adminId)) throw err('관리자 계정은 삭제할 수 없습니다.');
        try { await fnCall('adminUsers', { action: 'delete', emp_id: id }); }
        catch (e) { await db.collection(COL.members).doc(id).delete(); }   /* 서버 함수가 없으면 회원 정보만 지워 로그인을 막는다 */
      },
      resetPassword: async function (id) { return fnCall('adminUsers', { action: 'reset', emp_id: normId(id) }); },
      unlinkKakao: async function (id) { return fnCall('adminUsers', { action: 'unlink_kakao', emp_id: normId(id) }); },
      listActivity: async function (f) {
        f = f || {}; var q = db.collection(COL.activity).orderBy('at', 'desc');
        if (f.from) q = q.where('at', '>=', f.from); if (f.to) q = q.where('at', '<=', f.to);
        var r = await q.limit(20000).get();
        return r.docs.map(function (d) { return d.data(); }).filter(function (a) {
          return (!f.emp || a.emp_id === normId(f.emp)) && (!f.page || a.page === f.page);
        });
      }
    };
  }

  var backend = null;
  function B() {
    if (!backend) backend = C.mode === 'firebase' ? FirebaseBackend() : C.mode === 'supabase' ? SupabaseBackend() : DemoBackend();
    return backend;
  }

  window.AUTH = {
    config: C, normId: normId, validId: validId, pwRule: pwRule,
    session: readSess, clearSession: clearSess,
    backend: B,
    login: async function (id, pw) {
      if (!validId(id)) throw err('사번은 영문·숫자 6자리입니다.');
      var m;
      try { m = await B().login(id, pw); }
      catch (e) {
        /* 처음 비밀번호는 사번이므로, 사번을 대문자로 입력해도 들어갈 수 있게 소문자로 한 번 더 시도 */
        if (pw && pw.toLowerCase() === normId(id) && pw !== normId(id)) m = await B().login(id, normId(id)); else throw e;
      }
      var s = writeSess(m);
      try { await B().log({ page: 'login', kind: 'login', target: '', title: '로그인', device_hint: navigator.userAgent.slice(0, 120) }); } catch (_) {}
      return s;
    },
    logout: async function () { try { await B().logout(); } catch (_) {} clearSess(); },
    changePassword: async function (pw, cur) { var e = pwRule(pw); if (e) throw err(e); var m = await B().changePassword(pw, cur); return patchSess({ mustChange: false }) || m; },
    updateProfile: async function (p) {
      var m = await B().updateProfile(p); if (!profileDone(m)) throw err('소속사·지역단·비전센터·지점을 모두 입력해 주세요.');
      return patchSess({ profile: true });
    },
    me: async function () { return await B().check(); },
    profileDone: profileDone,
    consent: async function () { await B().consent(); return patchSess({ consent: true }); },
    refresh: async function () { var m = await B().check(); if (!m) { clearSess(); return null; } var s = readSess(); return patchSess({ name: m.name, role: m.role, mustChange: !!m.must_change_pw, consent: !!m.consent_at, kakao: !!m.kakao_linked, profile: profileDone(m) }) || s; },
    log: function (ev) { try { var p = B().log(ev); if (p && p.catch) p.catch(function () {}); } catch (_) {} },
    writeSession: writeSess
  };
})();
