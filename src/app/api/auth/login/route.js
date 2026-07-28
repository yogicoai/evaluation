import { NextResponse } from "next/server";
import { verifyPassword, currentSessionToken, masterSessionToken, isMasterPassword, AUTH_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

// 평가자 로그인 (공용 비밀번호, 기본 2026)
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");
  if (!password) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  // 마스터 비밀번호로 들어온 경우 평가자 비밀번호 변경과 무관한 세션을 발급한다.
  // 응답은 일반 로그인과 완전히 동일해 화면에서 구분되지 않는다.
  const token = isMasterPassword(password) ? masterSessionToken() : await currentSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
  return res;
}
