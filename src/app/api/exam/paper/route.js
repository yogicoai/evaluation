import { NextResponse } from "next/server";
import { getExamConfig } from "@/lib/examConfig";

// 직원용: 문항만 내려준다 (정답 미포함)
export async function GET() {
  const { questions, updatedAt } = await getExamConfig();
  return NextResponse.json({ questions, updatedAt });
}
