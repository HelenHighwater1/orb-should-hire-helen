import { NextResponse } from "next/server";
import { tieredPlan } from "@/data/presets";

export async function POST() {
  // Stub: returns a hardcoded plan. Phase 4 will wire this to Claude.
  return NextResponse.json({
    plan: tieredPlan,
    reasoning:
      "This is a placeholder response. In Phase 4, Claude will generate a custom plan based on your product description.",
  });
}
