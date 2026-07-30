import { NextResponse } from "next/server";
import { isAuthenticated, normalizeScope } from "@/lib/auth";

export async function GET(req) {
  const scope = normalizeScope(new URL(req.url).searchParams.get("scope"));
  return NextResponse.json({ scope, authenticated: await isAuthenticated(scope) });
}
