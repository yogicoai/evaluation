import { NextResponse } from "next/server";
import { cookieNameFor, normalizeScope } from "@/lib/auth";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const scope = normalizeScope(body.scope);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieNameFor(scope), "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}
