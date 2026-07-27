// 시험 채점 완료(서술형 점수 입력 → 합격/불합격 확정) 시
// 해당 응시자를 종합평가 대상자(evaluation_employees)로 자동 등록/연결한다.
import { getDb, COLLECTIONS } from "./mongodb.js";
import { normalize } from "./scoring.js";

export async function syncSubmissionToEmployee(submission) {
  const name = String(submission?.name || "").trim();
  if (!name) return null;

  const store = String(submission?.store || "").trim();
  const role = String(submission?.role || "").trim() || "수습";
  const db = await getDb();
  const col = db.collection(COLLECTIONS.employees);

  // 이름+소속 기준으로 기존 대상자 검색 (normalize: 공백/대소문자 무시)
  const candidates = await col.find({}, { projection: { _id: 0 } }).toArray();
  const existing = candidates.find(
    (e) => normalize(e.name) === normalize(name) && normalize(e.store) === normalize(store)
  );

  const now = new Date().toISOString();

  if (existing) {
    // 이미 등록된 대상자는 역량평가 연동만 최신 응시 결과로 맞춘다.
    // 평가자가 수동 점수(override)를 넣어둔 경우에는 그 값을 존중해 건드리지 않는다.
    if (existing.competency?.sourceId === submission.submissionId) {
      return { created: false, linked: false, id: existing.id, name, store };
    }
    await col.updateOne(
      { id: existing.id },
      {
        $set: {
          "competency.sourceId": submission.submissionId,
          "competency.lastSyncAt": now,
          updatedAt: now
        }
      }
    );
    return { created: false, linked: true, id: existing.id, name, store };
  }

  const emp = {
    id: "emp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    name,
    store,
    role,
    period: "",
    hr: { grades: [], memo: "" },
    sales: {},
    competency: { override: "", memo: "", sourceId: submission.submissionId, lastSyncAt: now },
    finalMemo: "",
    createdAt: now,
    updatedAt: now,
    createdFrom: "exam" // 시험 채점 완료로 자동 등록됨
  };
  await col.insertOne({ ...emp });
  return { created: true, linked: true, id: emp.id, name, store };
}
