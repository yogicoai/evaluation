import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";
import { normalize } from "@/lib/scoring";

// 직원용: 시험 제출
export async function POST(req) {
  const body = await req.json();
  const store = String(body.store || "").trim();
  const name = String(body.name || "").trim();
  const role = String(body.role || "").trim();
  if (!store || !name || !role) {
    return NextResponse.json({ error: "소속 매장, 이름, 직급은 필수입니다." }, { status: 400 });
  }
  const identityKey = normalize(store + "_" + name);
  const db = await getDb();
  const col = db.collection(COLLECTIONS.submissions);
  await col.createIndex({ identityKey: 1 }, { unique: true });

  const submittedAt = new Date().toISOString();
  const record = {
    submissionId: "YG" + Date.now() + Math.random().toString(36).slice(2, 6),
    examTitle: "요기보 직원 역량평가",
    store,
    name,
    role,
    identityKey,
    startedAt: body.startedAt || null,
    submittedAt,
    durationSec: Number.isFinite(Number(body.durationSec)) ? Number(body.durationSec) : null,
    autoSubmitted: !!body.autoSubmitted,
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
    manualScore: null,
    evaluatorMemo: "",
    evaluatedAt: null,
    evaluatorName: "",
    autoOverrides: {},
    version: "2026-07-evaluation"
  };

  try {
    await col.insertOne(record);
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: "이미 제출 완료된 응시 정보입니다. 재응시는 불가합니다." }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, submissionId: record.submissionId, submittedAt });
}

// 평가자: 전체 응시 데이터 조회
export async function GET() {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const list = await db
    .collection(COLLECTIONS.submissions)
    .find({}, { projection: { _id: 0 } })
    .sort({ submittedAt: -1 })
    .toArray();
  return NextResponse.json({ submissions: list });
}
