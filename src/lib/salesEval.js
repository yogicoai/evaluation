// 매출 평가 로직 (3. 수습 종합평가_평가자용.html 원본 이관)
// 로우데이터(시트 2장 형태의 rows)에서 ①매장 매출 기여도(30점) ②개인매출 상대평가(20점)를 산정한다.
// rows는 엑셀 업로드 또는 오프라인 서버 자동연동(salesAuto)으로 생성된다 — 산정 로직은 동일.

export function norm(v) {
  return String(v ?? "").trim().toLowerCase().replace(/\s/g, "");
}

// 매장 매출 기여도 점수표: 직영직원 수(1~3명)별 기여도 % 구간 → 점수
export function officialContribution(headcount, pct) {
  const bands = {
    "1": [[50, 30], [45, 25], [40, 20], [35, 15], [0, 10]],
    "2": [[35, 30], [30, 25], [25, 20], [20, 15], [0, 10]],
    "3": [[25, 30], [20, 25], [15, 20], [10, 15], [0, 10]]
  };
  const band = bands[String(headcount)] || bands["3"];
  return band.find((x) => pct >= x[0])?.[1] ?? 10;
}

// 개인매출 상대평가: 전체 순위 백분율 → 점수 (상위 20% 20점 / 50% 15점 / 80% 10점 / 그 외 5점)
export function officialIndividual(rankPct) {
  if (rankPct <= 20) return 20;
  if (rankPct <= 50) return 15;
  if (rankPct <= 80) return 10;
  return 5;
}

// 직영직원 수 추정: 서포터/일급제/파트/알바 등 상대평가 제외 대상 제거
export function inferHeadcount(names) {
  return Math.max(1, names.filter((n) => n && !/서포터|지원|일급|파트|알바/i.test(String(n))).length);
}

export function matchName(cell, name) {
  const c = norm(cell), n = norm(name);
  return !!c && !!n && (c.includes(n) || n.includes(c));
}

export function parseNumberValue(v) {
  if (typeof v === "number") return v;
  const raw = String(v ?? "").replace(/[,₩원\s]/g, "").replace(/%/g, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parsePercentValue(v) {
  if (typeof v === "number") {
    if (v > 0 && v <= 1) return v * 100;
    return v;
  }
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[,\s]/g, "").replace(/%/g, ""));
  if (!Number.isFinite(n)) return 0;
  if (raw.includes("%")) return n;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

// 시트1 "매장 매출 기여도" 표에서 대상자 열을 찾아 기여도 % 산출
export function extractStoreContribution(name, rows) {
  let headerIdx = rows.findIndex((r) => (r || []).some((v) => String(v || "").includes("구분")));
  if (headerIdx < 0) headerIdx = 0;
  const header = rows[headerIdx] || [];
  const totalCol = header.findIndex((v) => String(v || "").includes("합계"));
  const employeeCols = header
    .map((v, i) => ({ name: v, i }))
    .filter((x) => x.name && x.i !== totalCol && !String(x.name).includes("구분"));
  const target = employeeCols.find((x) => matchName(x.name, name)) || employeeCols[0] || { i: -1, name: "" };
  let sumRow =
    rows.find((r, idx) => idx > headerIdx && (r || []).some((v, i) => i <= 3 && String(v || "").includes("합계")) && !(r || []).some((v) => String(v || "").includes("매출 기여도"))) || [];
  if (!sumRow.length) {
    sumRow = rows.find((r, idx) => idx > headerIdx && (r || []).some((v) => String(v || "").includes("합계")) && !(r || []).some((v) => String(v || "").includes("매출 기여도"))) || [];
  }
  const contribRow = rows.find((r) => (r || []).some((v) => String(v || "").includes("매출 기여도"))) || [];
  const candidate = parseNumberValue(sumRow[target.i]);
  const team = totalCol >= 0 ? parseNumberValue(sumRow[totalCol]) : employeeCols.reduce((s, x) => s + parseNumberValue(sumRow[x.i]), 0);
  let pct = parsePercentValue(contribRow[target.i]);
  if (!pct && team) pct = (candidate / team) * 100;
  const headcount = inferHeadcount(employeeCols.map((x) => x.name));
  return { storeEmployee: String(target.name || ""), candidateSales: candidate, teamSales: team, contributionPct: pct, headcount };
}

// 시트2 "개인매출(상대평가)" 순위표에서 대상자 순위/모수 산출
export function extractPersonalSales(name, rows) {
  const headerIdx = rows.findIndex(
    (r) => (r || []).some((v) => String(v || "").includes("순위")) && (r || []).some((v) => String(v || "").includes("담당자"))
  );
  const header = rows[headerIdx] || [];
  const rankCol = header.findIndex((v) => String(v || "").includes("순위"));
  const nameCol = header.findIndex((v) => String(v || "").includes("담당자"));
  const totalCol = header.findIndex((v) => String(v || "").includes("합계"));
  const data = rows.slice(headerIdx + 1).filter((r) => parseNumberValue(r[rankCol]) > 0 && String(r[nameCol] || "").trim());
  const target = data.find((r) => matchName(r[nameCol], name)) || data[0] || [];
  const rank = parseNumberValue(target[rankCol]);
  const population = data.length || 0;
  return {
    personalName: String(target[nameCol] || ""),
    personalSales: parseNumberValue(target[totalCol]),
    rank,
    population,
    rankPct: population ? (rank / population) * 100 : 0
  };
}

export function extractSales(name, storeRows, personalRows) {
  const store = extractStoreContribution(name, storeRows || []);
  const personal = extractPersonalSales(name, personalRows || []);
  const contributionScore = officialContribution(store.headcount || 3, store.contributionPct || 0);
  const individualScore = officialIndividual(personal.rankPct || 100);
  return { ...store, ...personal, contributionScore, individualScore, totalScore: contributionScore + individualScore };
}

// ---- 종합평가 계산 ----
// 인사카드: 10개 항목 A10/B8/C6/D4/F0 → 100점 만점 → 20% 반영
export const GRADE_SCORE = { A: 10, B: 8, C: 6, D: 4, F: 0 };

export const HR_ITEMS = [
  { category: "근태", content: "지각·결근 없이, 정해진 스케줄에 맞추어 성실하게 근무한다." },
  { category: "제품 지식", content: "제품에 대한 정보를 정확하게 숙지하고, 전문적인 용어를 사용하여 고객을 응대한다." },
  { category: "의사소통", content: "근무자 간 적극적으로 소통하고, 의견을 수렴한다." },
  { category: "의사소통", content: "공지사항 및 프로모션 내용을 잘 확인하고, 그 내용을 숙지하며 이를 고객 니즈에 맞게 활용한다." },
  { category: "고객 응대", content: "매장에 입점하는 고객에게 긍정적이고 적극적으로 인사하며 응대한다." },
  { category: "고객 응대", content: "적극적으로 체험을 권유하며, 고객의 니즈를 파악하고 그에 맞게 응대한다." },
  { category: "고객 응대", content: "체험이 끝난 고객에게 리플렛을 전달하고, 오늘 체험한 제품에 대해 한 번 더 친절하게 안내한다." },
  { category: "매장 운영", content: "제품의 출고 시스템을 잘 이해하고, 회사 내부 전산(ERP) 사용에 능숙하다." },
  { category: "매장 운영", content: "고객 체험용 데모 제품을 잘 관리하고, 고객의 만족도를 높이기 위해 주기적으로 교체한다." },
  { category: "재고 관리", content: "매장의 재고 상황을 잘 파악하여 그에 맞게 고객에게 안내하며 창고 내 재고를 효율적으로 배치 및 관리한다." }
];

export function calculateHR(emp) {
  const grades = emp.hr?.grades || [];
  const raw = grades.reduce((s, g) => s + (GRADE_SCORE[g] ?? 0), 0);
  return { raw, weighted: Math.round(raw * 0.2 * 10) / 10 };
}

export function calculateSalesScore(emp) {
  let s = emp.sales || {};
  // 매출 데이터가 없으면 미산정(0점)으로 둔다.
  // 구간표의 최하단이 기여도 10점 / 개인매출 5점이라, 그냥 계산하면
  // 아무 데이터가 없어도 15점이 붙어 종합점수에 반영되어 버린다.
  const hasData = !!(s.rawStoreTable && s.rawPersonalTable) || !!s.uploadedAt;
  if (!hasData) {
    return { ...s, hasData: false, contributionPct: 0, rankPct: 0, contribution: 0, individual: 0, total: 0, share: 0 };
  }
  if (s.rawStoreTable && s.rawPersonalTable) {
    s = { ...s, ...extractSales(emp.name, s.rawStoreTable, s.rawPersonalTable) };
  }
  const pct = parsePercentValue(s.contributionPct || 0);
  const rankPct = parsePercentValue(s.rankPct || 0);
  const contribution = officialContribution(Number(s.headcount || 3), pct);
  const individual = officialIndividual(rankPct || 100);
  const total = contribution + individual;
  return { ...s, hasData: true, contributionPct: pct, rankPct, contribution, individual, total, share: pct };
}
