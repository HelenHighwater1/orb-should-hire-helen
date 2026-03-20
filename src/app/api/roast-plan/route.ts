import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Plan, UsageEvent } from "@/types/billing";

/**
 * Default: Haiku 4.5 (fast). Older `claude-3-5-haiku-20241022` is often retired - requests
 * then fail entirely. Override with ANTHROPIC_INSIGHTS_MODEL if needed.
 */
const MODEL =
  process.env.ANTHROPIC_INSIGHTS_MODEL?.trim() || "claude-haiku-4-5";

const FRIENDLY_ERROR =
  "Couldn't generate an insight right now - try again in a moment.";

type RawEvent = {
  customerId?: string;
  eventType?: string;
  quantity?: number;
};

function isPlanLike(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const p = value as Plan;
  return Array.isArray(p.lineItems) && typeof p.companyName === "string";
}

function coerceEvents(raw: unknown): UsageEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: UsageEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as RawEvent;
    if (typeof e.customerId !== "string" || typeof e.eventType !== "string") continue;
    const quantity = typeof e.quantity === "number" && Number.isFinite(e.quantity) ? e.quantity : 0;
    out.push({
      id: typeof (item as { id?: string }).id === "string" ? (item as { id: string }).id : "",
      timestamp: new Date(),
      customerId: e.customerId,
      eventType: e.eventType,
      quantity,
      metadata: (item as { metadata?: Record<string, string> }).metadata,
    });
  }
  return out;
}

/** Match invoice logic: per_seat counts events; others sum quantity */
function unitsPerLineItemSummary(plan: Plan, customerId: string, events: UsageEvent[]): string {
  const customerEvents = events.filter((ev) => ev.customerId === customerId);
  const lines: string[] = [];

  for (const li of plan.lineItems) {
    const matching = customerEvents.filter((ev) => ev.eventType === li.eventType);
    const units =
      li.pricingModel.type === "per_seat"
        ? matching.length
        : matching.reduce((sum, ev) => sum + ev.quantity, 0);
    const unitLabel = li.unit + (units === 1 ? "" : "s");
    lines.push(`${li.displayName} (${li.eventType}): ${units.toLocaleString()} ${unitLabel}`);
  }

  return lines.join("\n");
}

/** Smaller than full Plan JSON - same pricing signal, fewer input tokens = faster turnarounds */
function compactPlanForInsights(plan: Plan): Record<string, unknown> {
  return {
    companyName: plan.companyName,
    name: plan.name,
    baseFee: plan.baseFee,
    lineItems: plan.lineItems.map((li) => ({
      eventType: li.eventType,
      displayName: li.displayName,
      unit: li.unit,
      pricingModel: li.pricingModel,
    })),
  };
}

function buildPrompt(params: {
  plan: Plan;
  customerId: string;
  eventCount: number;
  usageSummary: string;
  invoiceTotal: number;
}): string {
  const { plan, customerId, eventCount, usageSummary, invoiceTotal } = params;
  const planJson = JSON.stringify(compactPlanForInsights(plan));
  const totalStr = invoiceTotal.toLocaleString("en-US", {
    style: "currency",
    currency: plan.currency ?? "USD",
  });

  const usageBlock =
    usageSummary.trim().length > 0
      ? usageSummary
          .split("\n")
          .map((line) => (line ? `  ${line}` : ""))
          .join("\n")
      : "  (no matching line item usage)";

  return `Billing strategist: write ONE short paragraph (1 to 3 sentences total) about this vendor's pricing plan versus one customer's observed usage.

The paragraph must briefly cover BOTH: (1) what is working well or aligned, if anything, and (2) what is weak, risky, or worth fixing, if anything. If one side is thin, say so in a compact way. Be specific to the numbers (tiers, totals, event mix, model type). Tone: smart, lightly witty, PG, constructive - never mean-spirited.

Also assign fitScore: integer 0-100 = how well this plan aligns with the observed usage AND healthy usage-based pricing. Rough guide: 0-35 poor/misaligned, 36-64 mixed, 65-100 strong fit.

Return ONLY one JSON object (no markdown fences, no text before or after). Keys: fitScore (integer 0-100), summary (single string, the paragraph).
Example: {"fitScore":72,"summary":"..."}

Plan:
${planJson}

Usage for ${customerId}:
- Events this period: ${eventCount}
- Units per line item:
${usageBlock}
- Invoice total: ${totalStr}`;
}

/** Extract first top-level `{ ... }` balancing braces (handles prose before/after). */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === "\"") inString = false;
      continue;
    }
    if (c === "\"") {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function coerceFitScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
}

/** Prefer summary string; fall back to joining legacy reflections[] into one paragraph */
function extractSummary(parsed: {
  summary?: unknown;
  narrative?: unknown;
  reflections?: unknown;
}): string | null {
  const direct = parsed.summary ?? parsed.narrative;
  if (typeof direct === "string") {
    const t = direct.trim();
    if (t.length >= 24) return t;
  }
  if (Array.isArray(parsed.reflections)) {
    const parts = parsed.reflections
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return null;
    return parts.join(" ");
  }
  return null;
}

function parseInsightsResponse(text: string): { fitScore: number; summary: string } | null {
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
  }
  const candidate = extractFirstJsonObject(trimmed) ?? trimmed;
  try {
    const parsed = JSON.parse(candidate) as {
      fitScore?: unknown;
      fit_score?: unknown;
      summary?: unknown;
      narrative?: unknown;
      reflections?: unknown;
    };
    const rawScore = parsed.fitScore ?? parsed.fit_score;
    let fitScore = coerceFitScore(rawScore);
    const summary = extractSummary(parsed);
    if (!summary) return null;

    if (fitScore == null) {
      fitScore = 52;
    }

    return { fitScore, summary };
  } catch {
    return null;
  }
}

type RoastRequestBody = {
  plan?: unknown;
  customerId?: string;
  invoiceTotal?: number;
  events?: unknown;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const body = (await request.json()) as RoastRequestBody;
    if (!isPlanLike(body.plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    const plan = body.plan;
    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    if (!customerId) {
      return NextResponse.json({ error: "Missing customer." }, { status: 400 });
    }
    const invoiceTotal =
      typeof body.invoiceTotal === "number" && Number.isFinite(body.invoiceTotal)
        ? body.invoiceTotal
        : 0;

    const events = coerceEvents(body.events);
    const customerEvents = events.filter((e) => e.customerId === customerId);
    const eventCount = customerEvents.length;

    const usageSummary = unitsPerLineItemSummary(plan, customerId, events);
    const userPrompt = buildPrompt({
      plan,
      customerId,
      eventCount,
      usageSummary,
      invoiceTotal,
    });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 520,
      temperature: 0.65,
      system:
        "You output a single raw JSON object only. No markdown code fences, no preamble, no explanation. All required keys must be present.",
      messages: [{ role: "user", content: userPrompt }],
    });

    let raw = "";
    for (const block of response.content) {
      if (block.type === "text") {
        raw = block.text.trim();
        break;
      }
    }

    if (!raw) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const parsed = parseInsightsResponse(raw);
    if (!parsed) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    return NextResponse.json({
      fitScore: parsed.fitScore,
      summary: parsed.summary,
    });
  } catch {
    return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
  }
}
