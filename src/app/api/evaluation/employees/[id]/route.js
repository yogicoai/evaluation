import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";

const ALLOWED_FIELDS = ["name", "store", "role", "period", "hr", "sales", "competency", "finalMemo"];

// 평가자: 대상자 부분 업데이트 (인사카드/매출/역량/기본정보)
export async function PATCH(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const set = { updatedAt: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) set[key] = body[key];
  }
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.employees).updateOne({ id }, { $set: set });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "대상자를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// 평가자: 대상자 삭제
export async function DELETE(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.employees).deleteOne({ id });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "대상자를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
