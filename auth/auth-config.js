/* ═══════════════════════════════════════════════════════════════
   auth-config.js — 로그인 모듈 설정 (공개해도 되는 값만 넣는다)
   · mode: 'demo'     — 서버 없이 이 브라우저 안에서만 동작하는 체험 모드
           'supabase' — 실제 운영 모드 (url·anonKey 필요)
   · anonKey 는 공개용 키다. 관리자 권한 키(service_role)는 절대 여기에 넣지 않는다.
   ═══════════════════════════════════════════════════════════════ */
window.AUTH_CONFIG = {
  mode: 'demo',
  supabaseUrl: '',          /* 예: https://abcdxyz.supabase.co */
  supabaseAnonKey: '',      /* 예: eyJhbGciOi... (anon public) */
  kakao: true,              /* 카카오 계정 연결·비밀번호 찾기 사용 */
  sessionHours: 24,         /* 로그인 유지 시간 */
  adminId: '313766'
};
