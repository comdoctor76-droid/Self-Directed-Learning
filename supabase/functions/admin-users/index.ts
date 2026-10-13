// ═══════════════════════════════════════════════════════════════
// admin-users — 관리자 전용 서버 함수 (Supabase Edge Function)
//   action: 'upsert' | 'delete' | 'reset' | 'unlink_kakao' | 'seed_admin'
//   관리자 권한 키(SUPABASE_SERVICE_ROLE_KEY)는 Supabase 가 함수 환경변수로 넣어 준다. 저장소에는 없다.
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEED_TOKEN = Deno.env.get("SEED_TOKEN") ?? "";          // 관리자 최초 생성 때만 1회 쓰고 지운다
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const norm = (x: unknown) => String(x ?? "").trim().toLowerCase();
const valid = (x: string) => /^[0-9a-z]{6}$/.test(x);
const mail = (id: string) => `${id}@emp.local`;
const FIELDS = ["name", "phone", "company", "region", "vision_center", "branch", "note"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "잘못된 요청" }, 400); }

  // 관리자 최초 생성: SEED_TOKEN 이 맞을 때만, 관리자가 아직 없을 때만
  if (body.action === "seed_admin") {
    if (!SEED_TOKEN || body.token !== SEED_TOKEN) return json({ error: "권한 없음" }, 403);
    const id = norm(body.emp_id), pw = String(body.password ?? "");
    const { data: exist } = await admin.from("members").select("emp_id").eq("role", "admin").limit(1);
    if (exist?.length) return json({ error: "관리자가 이미 있습니다" }, 409);
    const { data: u, error } = await admin.auth.admin.createUser({ email: mail(id), password: pw, email_confirm: true });
    if (error) return json({ error: error.message }, 400);
    await admin.from("members").insert({ emp_id: id, user_id: u.user.id, name: body.name ?? "관리자", role: "admin", must_change_pw: false, consent_at: new Date().toISOString() });
    return json({ ok: true });
  }

  // 호출한 사람이 관리자인지 확인
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return json({ error: "로그인이 필요합니다" }, 401);
  const { data: me } = await admin.from("members").select("role").eq("user_id", who.user.id).maybeSingle();
  if (me?.role !== "admin") return json({ error: "관리자만 할 수 있습니다" }, 403);

  const id = norm(body.emp_id ?? body.member?.emp_id);
  if (!valid(id)) return json({ error: "사번은 영문·숫자 6자리입니다" }, 400);
  const { data: row } = await admin.from("members").select("*").eq("emp_id", id).maybeSingle();

  if (body.action === "upsert") {
    const m = body.member ?? {}, patch: Record<string, string> = {};
    for (const f of FIELDS) if (m[f] !== undefined) patch[f] = String(m[f] ?? "");
    if (!row) {
      const { data: u, error } = await admin.auth.admin.createUser({ email: mail(id), password: id, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { data, error: e2 } = await admin.from("members").insert({ emp_id: id, user_id: u.user.id, ...patch }).select().single();
      if (e2) return json({ error: e2.message }, 400);
      return json({ member: data });
    }
    const { data, error } = await admin.from("members").update(patch).eq("emp_id", id).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ member: data });
  }
  if (!row) return json({ error: "없는 사번입니다" }, 404);
  if (body.action === "delete") {
    if (row.role === "admin") return json({ error: "관리자 계정은 삭제할 수 없습니다" }, 400);
    await admin.auth.admin.deleteUser(row.user_id);              // members·activity 는 cascade 로 함께 삭제
    return json({ ok: true });
  }
  if (body.action === "reset") {
    const { error } = await admin.auth.admin.updateUserById(row.user_id, { password: id });
    if (error) return json({ error: error.message }, 400);
    await admin.from("members").update({ must_change_pw: true }).eq("emp_id", id);
    return json({ ok: true });
  }
  if (body.action === "unlink_kakao") {
    // 카카오 연결 기록 삭제 (auth.identities)
    const { error } = await admin.rpc("admin_unlink_kakao", { p_user: row.user_id });
    if (error) return json({ error: error.message }, 400);
    await admin.from("members").update({ kakao_linked: false }).eq("emp_id", id);
    return json({ ok: true });
  }
  return json({ error: "알 수 없는 요청" }, 400);
});
