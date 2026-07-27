// 자동채점 로직 (2. 수습평가시험_평가자용.html 원본 이관)
// 서버(API)와 클라이언트(평가자 화면)에서 공용으로 사용한다.
import { AUTO_QUESTION_IDS, QUESTION_SCORES, PASS_SCORE } from "./examDefaults.js";

export function normalize(v) {
  return String(v ?? "").trim().toLowerCase().replace(/\s/g, "");
}

function arraysEqual(a, b) {
  return JSON.stringify([...(a || [])].map(String).sort()) === JSON.stringify([...(b || [])].map(String).sort());
}

// 문항 1건 채점: q21(OX 부분점수), q13(연결형 전체일치), q22/q23(복수정답 허용 단답),
// q24(다중단답 각 0.5점), 복수선택(전체일치), 단일선택(일치)
export function scoreQuestion(qid, ans, answerKey) {
  const key = answerKey[qid];
  const max = QUESTION_SCORES[qid] ?? 4;
  if (qid === "q21") {
    let each = 0;
    (key || []).forEach((k, i) => { if ((ans || [])[i] === k) each += 1; });
    return { score: each, correct: each === max, max };
  }
  if (qid === "q13") {
    const ok = Array.isArray(ans) && ans.length === 3 && ans.every((v, i) => normalize(v) === normalize(key[i]));
    return { score: ok ? max : 0, correct: ok, max };
  }
  if (qid === "q22" || qid === "q23") {
    const ok = (Array.isArray(key) ? key : [key]).map(normalize).includes(normalize(ans));
    return { score: ok ? max : 0, correct: ok, max };
  }
  if (qid === "q24") {
    const expected = (key || []).map(normalize);
    const actual = (ans || []).map(normalize);
    let each = 0;
    expected.forEach((k, i) => { if (actual[i] === k) each += 0.5; });
    return { score: Math.round(each * 10) / 10, correct: each === max, max };
  }
  if (Array.isArray(key)) {
    const ok = Array.isArray(ans) && arraysEqual(ans, key);
    return { score: ok ? max : 0, correct: ok, max };
  }
  const ok = String(ans || "") === String(key);
  return { score: ok ? max : 0, correct: ok, max };
}

// 응시 레코드 자동채점 (평가자 수정값 autoOverrides 반영)
export function autoScore(record, answerKey) {
  let total = 0;
  const result = {};
  AUTO_QUESTION_IDS.forEach((qid) => {
    const raw = scoreQuestion(qid, record.answers?.[qid], answerKey);
    const override = record.autoOverrides?.[qid];
    const overrideScore = Number(override?.score);
    const hasOverride = override && Number.isFinite(overrideScore) && overrideScore >= 0 && overrideScore <= raw.max;
    const applied = hasOverride ? overrideScore : raw.score;
    result[qid] = {
      ...raw,
      rawScore: raw.score,
      score: applied,
      correct: applied === raw.max,
      overridden: !!hasOverride,
      overrideMemo: override?.memo || ""
    };
    total += applied;
  });
  return { total: Math.round(total * 10) / 10, result };
}

export function finalScore(record, answerKey) {
  const a = autoScore(record, answerKey).total;
  const m = Number(record.manualScore);
  return Math.round((a + (Number.isFinite(m) ? m : 0)) * 10) / 10;
}

export function statusOf(record, answerKey) {
  const m = record.manualScore;
  if (m === null || m === "" || typeof m === "undefined") return "pending";
  return finalScore(record, answerKey) >= PASS_SCORE ? "pass" : "fail";
}
