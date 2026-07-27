import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalize } from "@/lib/scoring";

// 직원용: 동일 매장+이름 제출 여부 확인 (재응시 방지)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store") || "";
  const name = searchParams.get("name") || "";
  if (!store.trim() || !name.trim()) {
    return NextResponse.json({ error: "store, name이 필요합니다." }, { status: 400 });
  }
  const identityKey = normalize(store + "_" + name);
  const db = await getDb();
  const existing = await db
    .collection(COLLECTIONS.submissions)
    .findOne({ identityKey }, { projection: { submissionId: 1, submittedAt: 1 } });
  return NextResponse.json({
    locked: !!existing,
    submittedAt: existing?.submittedAt || null
  });
}
