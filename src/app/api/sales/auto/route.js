import { NextResponse } from "next/server";
import { buildSalesData } from "@/lib/salesAuto";
import { requireEvaluator } from "@/lib/auth";

// 매출 평가 자동 산정: 오프라인 서버 주문 데이터 → 매장 기여도/개인 상대평가 표 생성
export async function POST(req) {
  try {
    await requireEvaluator();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = String(body.name || "").trim();
  const store = String(body.store || "").trim();
  const startDate = String(body.startDate || "").trim();
  const endDate = String(body.endDate || "").trim();

  if (!name || !store) {
    return NextResponse.json({ error: "name, store가 필요합니다." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: "기간은 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "시작일이 종료일보다 늦습니다." }, { status: 400 });
  }

  try {
    const data = await buildSalesData({ name, store, startDate, endDate });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: "매출 데이터 연동 실패: " + String(e.message || e) }, { status: 502 });
  }
}
