import { NextResponse } from "next/server";
import { fetchActiveManagers, strip } from "@/lib/staff";

// 매장 목록 (활성 직원이 있는 매장, 가나다순)
export async function GET() {
  try {
    const staff = await fetchActiveManagers();
    const map = new Map();
    staff.forEach((m) => {
      const name = String(m.storeName || "").trim();
      if (!name || m.managerName === "system_store_placeholder") return;
      const k = strip(name);
      if (!map.has(k)) map.set(k, { name, staffCount: 0 });
      map.get(k).staffCount++;
    });
    const stores = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return NextResponse.json({ ok: true, stores });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e), stores: [] }, { status: 502 });
  }
}
