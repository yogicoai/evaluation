import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";
import { getExamConfig } from "@/lib/examConfig";
import { DEFAULT_QUESTIONS, DEFAULT_ANSWER_KEY } from "@/lib/examDefaults";

// 평가자: 문항 + 정답 전체 조회
export async function GET() {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getExamConfig());
}

// 평가자: 문항/정답 저장 (부분 업데이트 허용)
export async function PUT(req) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const current = await getExamConfig();
  const next = {
    questions: Array.isArray(body.questions) && body.questions.length === 25 ? body.questions : current.questions,
    answerKey: body.answerKey && typeof body.answerKey === "object" ? body.answerKey : current.answerKey,
    updatedAt: new Date().toISOString()
  };
  const db = await getDb();
  await db.collection(COLLECTIONS.config).updateOne({ _id: "default" }, { $set: next }, { upsert: true });
  return NextResponse.json({ ok: true, ...next });
}

// 평가자: 기본 시험지로 복원
export async function DELETE() {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  await db.collection(COLLECTIONS.config).deleteOne({ _id: "default" });
  return NextResponse.json({ ok: true, questions: DEFAULT_QUESTIONS, answerKey: DEFAULT_ANSWER_KEY });
}
