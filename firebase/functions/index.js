// ═══════════════════════════════════════════════════════════════
// adminUsers — 관리자 전용 서버 함수 (Firebase Cloud Functions, Blaze 요금제 필요)
//   action: 'reset'(비밀번호를 사번으로 초기화) | 'delete'(계정 완전 삭제)
//   이 사이트 규모의 사용량은 Blaze 무료 할당량(월 200만 회 호출) 안이라 실제 요금은 0원 수준.
// 배포: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const COL = 'sdl_members';
const norm = (x) => String(x || '').trim().toLowerCase();

exports.adminUsers = onCall({ region: 'asia-northeast3' }, async (req) => {
  const email = req.auth && req.auth.token.email;
  if (!email || !/@emp\.local$/.test(email)) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
  const me = await db.collection(COL).doc(email.split('@')[0]).get();
  if (!me.exists || me.data().role !== 'admin') throw new HttpsError('permission-denied', '관리자만 할 수 있습니다');

  const id = norm(req.data && req.data.emp_id);
  if (!/^[0-9a-z]{6}$/.test(id)) throw new HttpsError('invalid-argument', '사번은 영문·숫자 6자리입니다');
  const ref = db.collection(COL).doc(id), row = await ref.get();
  let user = null;
  try { user = await admin.auth().getUserByEmail(id + '@emp.local'); } catch (e) { /* 없음 */ }

  switch (req.data.action) {
    case 'reset':
      if (!user) throw new HttpsError('not-found', '없는 사번입니다');
      await admin.auth().updateUser(user.uid, { password: id });
      if (row.exists) await ref.update({ must_change_pw: true });
      return { ok: true };
    case 'delete':
      if (row.exists && row.data().role === 'admin') throw new HttpsError('failed-precondition', '관리자 계정은 삭제할 수 없습니다');
      if (user) await admin.auth().deleteUser(user.uid);
      if (row.exists) await ref.delete();
      return { ok: true };
    default:
      throw new HttpsError('invalid-argument', '알 수 없는 요청');
  }
});
