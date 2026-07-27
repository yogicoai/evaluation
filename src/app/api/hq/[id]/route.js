import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";

const COLLECTION = "hq_evaluations";
const FIELDS = ["dept", "rank", "name", "joinDate", "period", "evalDate", "scores", "opinion", "evaluator"];

// 평가 수정
export async function PATCH(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const set = { updatedAt: new Date().toISOString() };
  for (const k of FIELDS) {
    if (!(k in body)) continue;
    if (k === "scores") set.scores = body.scores && typeof body.scores === "object" ? body.scores : {};
    else set[k] = String(body[k] ?? "").trim();
  }
  const db = await getDb();
  const result = await db.collection(COLLECTION).updateOne({ id }, { $set: set });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "평가 데이터를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// 평가 삭제
export async function DELETE(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const result = await db.collection(COLLECTION).deleteOne({ id });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "평가 데이터를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
