import { NextResponse } from "next/server";
import { fetchActiveManagers, strip, ROLE_PRIORITY } from "@/lib/staff";

// 특정 매장의 활성 직원 명단 (직급순 → 이름순). store 미지정 시 전체.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store") || "";
  try {
    const staff = await fetchActiveManagers();
    const seen = new Set();
    const members = staff
      .filter((m) => m.managerName !== "system_store_placeholder")
      .filter((m) => !store || strip(m.storeName) === strip(store))
      .filter((m) => {
        const k = strip(m.storeName) + "|" + strip(m.managerName);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((m) => ({
        name: String(m.managerName || "").trim(),
        store: String(m.storeName || "").trim(),
        role: String(m.role || "").trim() || "직원"
      }))
      .sort(
        (a, b) =>
          (ROLE_PRIORITY[a.role] || 99) - (ROLE_PRIORITY[b.role] || 99) ||
          a.name.localeCompare(b.name, "ko")
      );
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e), members: [] }, { status: 502 });
  }
}
