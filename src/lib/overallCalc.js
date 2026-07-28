// 종합평가 계산 (3. 수습 종합평가_평가자용.html 원본 이관)
// 인사카드 20% + 매출 50% + 역량평가 30%
import { autoScore, normalize } from "./scoring.js";
import { calculateHR, calculateSalesScore } from "./salesEval.js";

// 역량평가(시험) 점수: 자동채점 + 서술형, 0~100 클램프
export function calculateExamScore(sub, answerKey) {
  if (!sub) return null;
  const total = autoScore(sub, answerKey).total;
  const manual = Number(sub.manualScore);
  return Math.max(0, Math.min(100, total + (Number.isFinite(manual) ? manual : 0)));
}

// 이름(+소속) 기준 최근 응시 결과 매칭
export function matchExam(emp, exams) {
  const list = exams || [];
  const sameName = list.filter((x) => normalize(x.name) === normalize(emp.name));
  if (!sameName.length) return null;
  const sameStore = sameName.filter((x) => normalize(x.store) === normalize(emp.store));
  const pool = sameStore.length ? sameStore : sameName;
  return [...pool].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
}

export function calculateCompetency(emp, exams, answerKey) {
  const matched = emp.competency?.sourceId
    ? (exams || []).find((x) => x.submissionId === emp.competency.sourceId) || matchExam(emp, exams)
    : matchExam(emp, exams);
  const linked = calculateExamScore(matched, answerKey);
  const override = emp.competency?.override;
  const hasOverride = override !== "" && override !== null && typeof override !== "undefined";
  const raw = hasOverride ? Number(override) : linked;
  const bounded = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
  return {
    raw: bounded,
    linked,
    matched,
    weighted: Math.round(bounded * 0.3 * 10) / 10,
    source: hasOverride ? "수동 반영" : "역량평가 대시보드 연동"
  };
}

export function calculateTotal(emp, exams, answerKey) {
  const hr = calculateHR(emp);
  const sales = calculateSalesScore(emp);
  const comp = calculateCompetency(emp, exams, answerKey);

  // 매출 평가 제외 대상(중간관리·일급제·서포터)은 매출 50점을 빼고
  // 인사카드 20 + 역량 30 = 50점을 100점으로 환산한다.
  // (0점 처리하면 제외 대상은 최대 50점이라 무조건 불합격이 된다)
  if (sales.excluded) {
    const earned = hr.weighted + comp.weighted; // 50점 만점
    return {
      hr, sales, comp,
      salesExcluded: true,
      total: Math.round(earned * 2 * 10) / 10
    };
  }
  return { hr, sales, comp, salesExcluded: false, total: Math.round((hr.weighted + sales.total + comp.weighted) * 10) / 10 };
}

export function completion(emp, exams, answerKey) {
  const hrDone = (emp.hr?.grades || []).filter(Boolean).length === 10;
  const salesExcluded = calculateSalesScore(emp).excluded;
  // 제외 대상은 매출 입력을 요구하지 않으므로 완료로 본다.
  const salesDone = salesExcluded || !!emp.sales?.uploadedAt;
  const compDone = calculateCompetency(emp, exams, answerKey).raw > 0;
  return { hrDone, salesDone, salesExcluded, compDone, done: hrDone && salesDone && compDone };
}

export function fmtNum(v, d = 1) {
  return Number(v || 0).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: d });
}
export function fmtMoney(v) {
  return Number(v || 0).toLocaleString("ko-KR");
}
export function fmtPct(v) {
  return Number(v || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "%";
}
export function formatRawCell(c) {
  if (c === null || typeof c === "undefined" || c === "") return "";
  if (typeof c === "number") {
    if (Math.abs(c) < 1 && c !== 0) return fmtPct(c * 100);
    return fmtMoney(c);
  }
  return String(c);
}
