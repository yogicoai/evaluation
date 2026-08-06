// 매출 평가 자동 산정 (요청서 4-2: ERP 매출 데이터 자동 업데이트)
// 오프라인 서버의 직원 명단 + 기간 주문 데이터를 집계해
// 기존 엑셀 양식과 동일한 구조의 rows(rawStoreTable / rawPersonalTable)를 생성한다.
// → 이후 채점(extractSales)·화면 표시·인쇄는 엑셀 업로드와 완전히 동일한 경로를 탄다.
import { fetchManagers, fetchOrders, strip, shortName, safeNum, ROLE_PRIORITY } from "./staff.js";

// 상대평가 대상 직영 직급 (중간관리 매장 / 일급제 / 서포터 제외)
const DIRECT_ROLES = ["매니저", "부매니저", "시니어"];

const storeMatch = (a, b) => {
  const x = strip(a), y = strip(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

function monthLabel(dateStr, fallback) {
  const s = String(dateStr || "");
  const m = s.match(/^(\d{4})[-./]?(\d{2})/);
  if (!m) return fallback;
  return `${m[1]}년 ${m[2]}월`;
}

// 같은 매장+이름 중복 등록 정리
function dedupeStaff(managers) {
  const map = new Map();
  managers.forEach((m) => {
    const key = strip(m.storeName) + "|" + strip(m.managerName);
    if (!map.has(key)) map.set(key, m);
  });
  return [...map.values()].filter((m) => m.managerName !== "system_store_placeholder");
}

export async function buildSalesData({ name, store, startDate, endDate }) {
  // 매출은 "그 기간에 일한 사람" 기준이어야 하므로 퇴사자까지 포함한 전체 명단을 쓴다.
  // (활성 직원만 쓰면 기간 중 퇴사한 직원의 매출이 통째로 빠져 모집단·순위가 왜곡된다)
  const [managersRaw, orders] = await Promise.all([fetchManagers(), fetchOrders(startDate, endDate)]);
  const staff = dedupeStaff(managersRaw);
  const activeStaff = staff.filter((m) => m.isActive !== false);

  // ── 중간관리 매장 판정: 매장의 '현재' 성격이므로 활성 직원 기준으로 본다 ──
  const byStore = new Map();
  activeStaff.forEach((m) => {
    const k = strip(m.storeName);
    if (!byStore.has(k)) byStore.set(k, []);
    byStore.get(k).push(m);
  });
  const midStores = new Set();
  byStore.forEach((arr, k) => {
    if (arr.some((m) => String(m.role || "").trim() === "중간관리" || m.consignment === "Y")) midStores.add(k);
  });

  // ── ① 매장 매출 기여도: 대상 매장 주문만 집계 ──
  const storeOrders = orders.filter((o) => storeMatch(o.store, store));
  const storeTotal = storeOrders.reduce((s, o) => s + safeNum(o.amount), 0);

  // 매장 근무자 컬럼 =
  //   ① 해당 매장 현재 직원(매출 0이어도 표시)
  //   ② 기간 내 이 매장에서 매출이 발생한 모든 담당자 — 퇴사자·명단에 없는 담당자 포함
  //   ③ 평가 대상자
  // ②를 넣지 않으면 열 합계가 매장 총매출과 어긋난다.
  const roleByName = new Map(staff.map((m) => [strip(m.managerName), String(m.role || "").trim()]));
  const labelByName = new Map(staff.map((m) => [strip(m.managerName), String(m.managerName).trim()]));

  const colMap = new Map(); // nameStrip → {name, role}
  const addCol = (rawName, role) => {
    const key = strip(rawName);
    if (!key || colMap.has(key)) return;
    colMap.set(key, { name: String(rawName).trim(), role: role ?? roleByName.get(key) ?? "" });
  };
  activeStaff
    .filter((m) => storeMatch(m.storeName, store))
    .forEach((m) => addCol(m.managerName, String(m.role || "").trim()));
  storeOrders.forEach((o) => {
    const n = shortName(o.manager);
    if (n) addCol(labelByName.get(strip(n)) || n);
  });
  addCol(name, roleByName.get(strip(name)) || "수습");

  const cols = [...colMap.values()].sort(
    (a, b) =>
      (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99) ||
      String(a.name).localeCompare(String(b.name), "ko")
  );
  const colLabel = (c) => (c.role ? `${c.name} ${c.role}` : c.name);

  // 월별 × 직원별 매출
  const fallbackMonth = monthLabel(startDate, "기간 매출");
  const monthKeys = [];
  const monthPerson = new Map(); // month → Map(nameStrip → amt)
  const monthTotal = new Map();  // month → 매장 전체 매출
  storeOrders.forEach((o) => {
    const mk = monthLabel(o.date, fallbackMonth);
    if (!monthPerson.has(mk)) { monthPerson.set(mk, new Map()); monthTotal.set(mk, 0); monthKeys.push(mk); }
    monthTotal.set(mk, monthTotal.get(mk) + safeNum(o.amount));
    const nm = strip(shortName(o.manager));
    if (nm) {
      const mp = monthPerson.get(mk);
      mp.set(nm, (mp.get(nm) || 0) + safeNum(o.amount));
    }
  });
  monthKeys.sort();

  const personTotal = (nameStrip) => {
    let sum = 0;
    monthPerson.forEach((mp) => { sum += mp.get(nameStrip) || 0; });
    return sum;
  };

  // 엑셀 시트1과 동일 구조: 구분/직원.../합계 → 월별 행 → 합계 행 → 매출 기여도 행
  const storeRows = [];
  storeRows.push(["구분", ...cols.map(colLabel), "합계"]);
  monthKeys.forEach((mk) => {
    storeRows.push([mk, ...cols.map((c) => monthPerson.get(mk)?.get(strip(c.name)) || 0), monthTotal.get(mk) || 0]);
  });
  const colSums = cols.map((c) => personTotal(strip(c.name)));
  storeRows.push(["합계", ...colSums, storeTotal]);
  storeRows.push(["매출 기여도", ...colSums.map((v) => (storeTotal ? Math.round((v / storeTotal) * 1000) / 10 : 0)), ""]);

  // ── ② 개인매출 상대평가: 직영직원 풀 (중간관리 매장·일급제·서포터 제외) ──
  // 이름별 주문 집계 (매장 단위)
  const salesByNameStore = new Map(); // nameStrip → [{storeKey, amt}]
  orders.forEach((o) => {
    const nm = strip(shortName(o.manager));
    if (!nm) return;
    const sk = strip(o.store);
    if (!salesByNameStore.has(nm)) salesByNameStore.set(nm, new Map());
    const m = salesByNameStore.get(nm);
    m.set(sk, (m.get(sk) || 0) + safeNum(o.amount));
  });
  const salesOf = (staffName, staffStore) => {
    const m = salesByNameStore.get(strip(staffName));
    if (!m) return 0;
    let sum = 0;
    m.forEach((amt, sk) => { if (storeMatch(sk, staffStore)) sum += amt; });
    return sum;
  };

  const pool = staff
    .filter((m) => DIRECT_ROLES.includes(String(m.role || "").trim()))
    .filter((m) => m.consignment !== "Y")
    .filter((m) => !midStores.has(strip(m.storeName)))
    .map((m) => ({ name: String(m.managerName).trim(), store: String(m.storeName).trim(), sales: salesOf(m.managerName, m.storeName) }))
    .filter((p) => p.sales > 0);

  const candidateSales = salesOf(name, store);

  // 평가 대상자가 제외 대상(중간관리 매장 / 일급제 / 서포터)인지 판정한다.
  // 제외 대상이면 상대평가 순위표에 넣지 않는다.
  // (예전에는 "매출 0원이어도 항상 포함"시켜, 규정상 제외돼야 할 사람이 순위·점수를 받았다)
  const candidateStaff = staff.find(
    (m) => strip(m.managerName) === strip(name) && storeMatch(m.storeName, store)
  );
  const candidateRole = String(candidateStaff?.role || "").trim();
  const inMidStore = midStores.has(strip(candidateStaff?.storeName || store));
  const excluded =
    inMidStore ||
    candidateStaff?.consignment === "Y" ||
    (!!candidateRole && !DIRECT_ROLES.includes(candidateRole));
  const excludeReason = inMidStore
    ? "중간관리 매장"
    : candidateStaff?.consignment === "Y"
      ? "위탁 매장"
      : candidateRole && !DIRECT_ROLES.includes(candidateRole)
        ? candidateRole
        : "";

  if (!excluded && !pool.some((p) => strip(p.name) === strip(name) && storeMatch(p.store, store))) {
    pool.push({ name: String(name).trim(), store: String(store).trim(), sales: candidateSales });
  }
  pool.sort((a, b) => b.sales - a.sales || String(a.name).localeCompare(String(b.name), "ko"));

  const personalRows = [["순위", "담당자", "합계"]];
  pool.forEach((p, i) => {
    personalRows.push([i + 1, `${p.name} (${p.store})`, p.sales]);
  });

  const candidateIdx = pool.findIndex((p) => strip(p.name) === strip(name) && storeMatch(p.store, store));
  const headcountNames = cols.map(colLabel);

  return {
    storeRows,
    personalRows,
    meta: {
      period: `${startDate} ~ ${endDate}`,
      excluded,
      excludeReason,
      candidateRole,
      storeTotal,
      candidateSales,
      contributionPct: storeTotal ? Math.round((candidateSales / storeTotal) * 1000) / 10 : 0,
      storeStaffCount: cols.length,
      headcountNames,
      rank: candidateIdx >= 0 ? candidateIdx + 1 : null,
      population: pool.length,
      excludedMidStores: midStores.size,
      orderCount: orders.length,
      storeOrderCount: storeOrders.length
    }
  };
}
