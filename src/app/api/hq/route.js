import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireEvaluator } from "@/lib/auth";

const COLLECTION = "hq_evaluations";
const FIELDS = ["dept", "rank", "name", "joinDate", "period", "evalDate", "scores", "opinion", "evaluator"];

function pickFields(body) {
  const out = {};
  for (const k of FIELDS) {
    if (!(k in body)) continue;
    if (k === "scores") out.scores = body.scores && typeof body.scores === "object" ? body.scores : {};
    else out[k] = String(body[k] ?? "").trim();
  }
  return out;
}

// 본사&물류 수습기간 평가 목록
export async function GET() {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const evaluations = await db
    .collection(COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json({ evaluations });
}

// 평가 작성
export async function POST(req) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const data = pickFields(body);
  if (!data.name) {
    return NextResponse.json({ error: "성명은 필수입니다." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const doc = {
    id: "hq_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    dept: "", rank: "", name: "", joinDate: "", period: "", evalDate: "",
    scores: {}, opinion: "", evaluator: "",
    ...data,
    createdAt: now,
    updatedAt: now
  };
  const db = await getDb();
  await db.collection(COLLECTION).insertOne({ ...doc });
  return NextResponse.json({ ok: true, evaluation: doc });
}
