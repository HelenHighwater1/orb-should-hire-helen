import { NextResponse } from "next/server";

export async function POST() {
  // Stub: returns a hardcoded roast. Phase 5 will wire this to Claude.
  return NextResponse.json({
    roast:
      "Your tier breakpoints are suspiciously round numbers — are you pricing for humans or for spreadsheets? Consider anchoring Tier 1 to your median customer's usage so most people feel the jump.",
  });
}
