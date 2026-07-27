import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";
import { syncSubmissionToEmployee } from "@/lib/evaluationSync";

// 평가자: 채점/메모/자동채점 수정값 저장
export async function PATCH(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const set = {};

  if ("manualScore" in body) {
    const v = body.manualScore;
    if (v === null || v === "") {
      set.manualScore = null;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 4) {
        return NextResponse.json({ error: "서술형 점수는 0~4점 사이여야 합니다." }, { status: 400 });
      }
      set.manualScore = n;
    }
    set.evaluatedAt = new Date().toISOString();
    set.evaluatorName = String(body.evaluatorName || "");
  }
  if ("evaluatorMemo" in body) set.evaluatorMemo = String(body.evaluatorMemo || "");
  if ("autoOverrides" in body && typeof body.autoOverrides === "object") {
    set.autoOverrides = body.autoOverrides || {};
    set.autoEvaluatedAt = new Date().toISOString();
  }
  if (!Object.keys(set).length) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const db = await getDb();
  const col = db.collection(COLLECTIONS.submissions);
  const result = await col.updateOne({ submissionId: id }, { $set: set });
  if (!result.matchedCount) {
    return NextResponse.json({ error: "응시 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // 서술형 채점이 입력되어 합격/불합격이 확정되면 종합평가 대상자로 자동 등록한다.
  let sync = null;
  if ("manualScore" in body && set.manualScore !== null) {
    try {
      const submission = await col.findOne({ submissionId: id }, { projection: { _id: 0 } });
      sync = await syncSubmissionToEmployee(submission);
    } catch (e) {
      // 자동 등록 실패가 채점 저장 자체를 막지 않도록 한다.
      console.error("종합평가 대상자 자동 등록 실패:", e);
    }
  }
  return NextResponse.json({ ok: true, sync });
}

// 평가자: 응시 데이터 삭제 (재응시 허용 목적)
export async function DELETE(req, { params }) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.submissions).deleteOne({ submissionId: id });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "응시 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
