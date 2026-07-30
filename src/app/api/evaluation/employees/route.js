import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";

// 평가자: 종합평가 대상자 목록
export async function GET() {
  try {
    await requireEvaluator("store");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const employees = await db
    .collection(COLLECTIONS.employees)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json({ employees });
}

// 평가자: 대상자 추가
export async function POST(req) {
  try {
    await requireEvaluator("store");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });

  const now = new Date().toISOString();
  const emp = {
    id: "emp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    name,
    store: String(body.store || "").trim(),
    role: String(body.role || "수습").trim(),
    period: String(body.period || "").trim(),
    hr: { grades: [], memo: "" },
    sales: {},
    competency: { override: "", memo: "", sourceId: "", lastSyncAt: "" },
    finalMemo: "",
    createdAt: now,
    updatedAt: now
  };
  const db = await getDb();
  await db.collection(COLLECTIONS.employees).insertOne({ ...emp });
  return NextResponse.json({ ok: true, employee: emp });
}
