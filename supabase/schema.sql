-- ═══════════════════════════════════════════════════════════════
-- 스스로 학습하기 — 로그인·학습 기록 DB (Supabase SQL Editor 에서 한 번 실행)
-- 사번: 영문·숫자 6자리, 소문자로 저장. 로그인 아이디는 {사번}@emp.local
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.members (
  emp_id        text primary key check (emp_id ~ '^[0-9a-z]{6}$'),
  user_id       uuid unique references auth.users(id) on delete cascade,
  name          text default '', phone text default '', company text default '', region text default '',
  vision_center text default '', branch text default '', note text default '',
  role          text not null default 'member' check (role in ('admin','member')),
  must_change_pw boolean not null default true,
  kakao_linked  boolean not null default false,
  consent_at    timestamptz,
  created_at    timestamptz not null default now()
);
create table if not exists public.activity (
  id bigint generated always as identity primary key,
  emp_id text not null references public.members(emp_id) on delete cascade,
  at timestamptz not null default now(),
  page text not null default '', kind text not null default 'page' check (kind in ('login','page','section','card','image')),
  target text default '', title text default '', device_hint text default ''
);
create index if not exists activity_at_idx on public.activity(at desc);
create index if not exists activity_emp_idx on public.activity(emp_id, at desc);

-- 현재 로그인한 사람의 사번 / 관리자 여부
create or replace function public.my_emp() returns text language sql stable security definer set search_path=public as
$$ select emp_id from public.members where user_id = auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from public.members where user_id = auth.uid() and role = 'admin') $$;

alter table public.members enable row level security;
alter table public.activity enable row level security;
-- 회원: 본인 행만 읽기, 관리자는 전체 읽기. 쓰기는 서버 함수(admin-users)와 아래 RPC 로만
drop policy if exists m_read on public.members;
create policy m_read on public.members for select using (user_id = auth.uid() or public.is_admin());
-- 기록: 본인 사번으로만 쓰기, 읽기는 관리자만
drop policy if exists a_ins on public.activity;
create policy a_ins on public.activity for insert with check (emp_id = public.my_emp());
drop policy if exists a_read on public.activity;
create policy a_read on public.activity for select using (public.is_admin());

-- 본인이 바꿀 수 있는 상태값만 RPC 로
create or replace function public.me_password_changed() returns void language sql security definer set search_path=public as
$$ update public.members set must_change_pw = false where user_id = auth.uid() $$;
create or replace function public.me_consent() returns void language sql security definer set search_path=public as
$$ update public.members set consent_at = now() where user_id = auth.uid() $$;
create or replace function public.me_kakao_linked() returns void language sql security definer set search_path=public as
$$ update public.members m set kakao_linked = exists(select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'kakao') where m.user_id = auth.uid() $$;
grant execute on function public.me_password_changed, public.me_consent, public.me_kakao_linked, public.my_emp, public.is_admin to authenticated;

-- 학습 기록 2년 보관 (pg_cron 이 켜져 있으면 매일 정리)
-- select cron.schedule('trim-activity','10 3 * * *',$$ delete from public.activity where at < now() - interval '2 years' $$);

-- 관리자 서버 함수 전용: 카카오 연결 해제 (service_role 만 실행 가능)
create or replace function public.admin_unlink_kakao(p_user uuid) returns void language sql security definer set search_path=public, auth as
$$ delete from auth.identities where user_id = p_user and provider = 'kakao' $$;
revoke all on function public.admin_unlink_kakao(uuid) from public, anon, authenticated;
