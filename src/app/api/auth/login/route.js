import { NextResponse } from "next/server";
import { verifyPassword, currentSessionToken, AUTH_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

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
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await currentSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/"
  });
  return res;
}
