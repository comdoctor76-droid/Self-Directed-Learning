# 로그인 모듈 — 준비·시험·탑재 안내

이 폴더(`auth/`)는 **아직 어떤 학습 페이지에도 연결되어 있지 않습니다.** 사이트 이용자에게는 아무 변화가 없습니다.

## 지금 바로 체험하기 (체험 모드)
- 주소: `https://comdoctor76-droid.github.io/Self-Directed-Learning/auth/test.html`
- 관리자로 처음 들어갈 때 체험 모드 비밀번호는 **사번 313766** 입니다. (운영 모드의 실제 관리자 비밀번호는 서버에만 저장)
- 체험 모드는 **이 브라우저 안에만** 저장됩니다. 다른 기기·다른 브라우저와 공유되지 않습니다.
- 관리자 화면: `auth/admin.html`

## 운영 모드 준비 (무료, 사용자 계정 필요)
1. **Supabase** (https://supabase.com) 가입 → New project 생성 (지역: Northeast Asia (Seoul))
   - Project Settings → API 에서 **Project URL** 과 **anon public key** 를 알려 주세요.
   - Authentication → Providers → Email: "Confirm email" 끄기
   - Authentication → Sign In / Providers → "Allow manual linking" 켜기 (카카오 연결용)
2. **카카오 디벨로퍼스** (https://developers.kakao.com) → 내 애플리케이션 추가
   - 카카오 로그인 활성화, Redirect URI 에 `https://<프로젝트>.supabase.co/auth/v1/callback` 등록
   - **REST API 키**와 보안 → **Client Secret** 을 알려 주세요. (사업자 인증·전화번호 동의항목은 필요 없음)
3. 받은 값으로 제가 할 일
   - `supabase/schema.sql` 실행(표·권한), `supabase/functions/admin-users` 배포, 카카오 공급자 설정
   - 관리자 계정(313766) 1회 생성 — 요청하신 비밀번호는 이때만 쓰고 저장소에는 남기지 않음
   - `auth/auth-config.js` 의 `mode` 를 `'supabase'` 로 바꾸고 URL·공개 키 입력 → 같은 시험 페이지로 운영 모드 시험

> 주의: Supabase 무료 프로젝트는 7일간 요청이 없으면 일시정지됩니다. 탑재 후에는 매일 자동 접속(GitHub Actions)으로 막습니다.

## 탑재 (사용자 승인 후에만)
각 학습 페이지와 메인의 `<head>` 맨 앞에 두 줄을 넣습니다.
```html
<script src="auth/auth-config.js"></script>
<script src="auth/auth-guard.js"></script>
```
되돌릴 때는 이 두 줄만 지우면 즉시 원래대로 돌아갑니다.

## 파일
| 파일 | 역할 |
|---|---|
| `auth-config.js` | 모드·서버 주소·공개 키 (공개 가능 값만) |
| `auth-core.js` | 로그인·회원·기록 엔진 (체험/운영 공통) |
| `auth-guard.js` | 페이지에 심는 모듈 — 로그인 확인·원래 주소 복귀·학습 기록 |
| `login.html` | 로그인·최초 비밀번호 변경·개인정보 동의·카카오 연결·비밀번호 찾기 |
| `admin.html` | 회원 관리·접속/학습 기록·통계 |
| `test.html` | 시험용 학습 페이지 |
| `../supabase/schema.sql`, `../supabase/functions/admin-users/` | 운영 서버 설정 |
