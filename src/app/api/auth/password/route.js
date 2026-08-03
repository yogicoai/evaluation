import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  requireEvaluator, verifyPassword, setPassword, currentSessionToken, masterSessionToken,
  cookieNameFor, normalizeScope, SCOPES, SESSION_COOKIE_OPTIONS
} from "@/lib/auth";

// 평가자 비밀번호 변경 — 해당 영역(store/hq)에 로그인된 상태 + 현재 비밀번호 확인 필요
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const scope = normalizeScope(body.scope);
  try {
    await requireEvaluator(scope);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "").trim();

  if (!(await verifyPassword(scope, currentPassword))) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  // 마스터 세션으로 접속 중이면 변경 후에도 마스터 세션을 유지한다.
  const master = masterSessionToken(scope);
  const cookieName = cookieNameFor(scope);
  const wasMaster = !!master && (await cookies()).get(cookieName)?.value === master;

  await setPassword(scope, newPassword);

  // 변경 직후 현재 브라우저는 새 세션 쿠키로 갱신 (다른 기기의 기존 세션은 무효화됨)
  const res = NextResponse.json({ ok: true, scope, label: SCOPES[scope].label });
  res.cookies.set(cookieName, wasMaster ? master : await currentSessionToken(scope), SESSION_COOKIE_OPTIONS);
  return res;
}
