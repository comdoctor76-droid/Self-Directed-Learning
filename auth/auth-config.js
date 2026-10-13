/* ═══════════════════════════════════════════════════════════════
   auth-config.js — 로그인 모듈 설정 (공개해도 되는 값만 넣는다)
   · mode: 'demo'     — 서버 없이 이 브라우저 안에서만 동작하는 체험 모드
           'firebase' — 운영 모드 (Google Firebase, 아래 firebase 값 필요)
   · Firebase 웹 설정값(apiKey 등)은 공개해도 되는 값이다. 실제 보호는 Firestore 보안 규칙이 한다.
   ═══════════════════════════════════════════════════════════════ */
window.AUTH_CONFIG = {
  mode: 'demo',
  firebase: { apiKey: '', authDomain: '', projectId: '', appId: '', functionsRegion: 'asia-northeast3' },
  sessionHours: 24,         /* 로그인 유지 시간 */
  adminId: '313766'
};
