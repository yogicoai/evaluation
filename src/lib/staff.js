// 오프라인 통합관리 서버(deliveryOFF에서 쓰는 서버) 연동
// - /api/jwasu/admin/managers : 매장 직원 명단 (storeName, managerName, role, isActive, consignment)
// - /api/orders?store=all     : 기간별 주문(개인매출) 데이터 (store, manager, amount, date)
const BASE = process.env.OFFLINE_API_BASE || "https://port-0-realtime-lzgmwhc4d9883c97.sel4.cloudtype.app";

export const strip = (s) => String(s || "").replace(/\s+/g, "");
// 주문 manager 필드는 "이름 직급" 형태 → 첫 토큰이 이름
export const shortName = (f) => String(f || "").trim().split(/\s+/)[0] || "";

export const ROLE_PRIORITY = { "매니저": 1, "부매니저": 2, "중간관리": 3, "시니어": 4, "서포터": 5, "일급제": 6 };

// 직원 명단 캐시 (10분)
let managersCache = { at: 0, data: null };

export async function fetchManagers() {
  if (managersCache.data && Date.now() - managersCache.at < 10 * 60 * 1000) return managersCache.data;
  const res = await fetch(`${BASE}/api/jwasu/admin/managers`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`직원 명단 API 응답 오류 (${res.status})`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.managers)) throw new Error("직원 명단 API 형식 오류");
  managersCache = { at: Date.now(), data: json.managers };
  return json.managers;
}

// 활성 직원만
export async function fetchActiveManagers() {
  const managers = await fetchManagers();
  return managers.filter((m) => m.isActive !== false && String(m.managerName || "").trim());
}

// 기간 주문 조회 (startDate/endDate: YYYY-MM-DD)
export async function fetchOrders(startDate, endDate) {
  const url = `${BASE}/api/orders?store=all&searchType=range&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`주문 데이터 API 응답 오류 (${res.status})`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.orders)) throw new Error("주문 데이터 API 형식 오류");
  return json.orders;
}

export function safeNum(v) {
  const n = Number(String(v ?? "").replace(/[,\s원₩]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
