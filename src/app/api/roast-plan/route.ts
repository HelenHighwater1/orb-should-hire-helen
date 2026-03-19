import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-20250514";

const FRIENDLY_ERROR =
  "Couldn't roast your pricing right now — try again in a moment.";

const SYSTEM_PROMPT = `You are a blunt, seasoned usage-based pricing consultant.

You will receive:
1. A pricing plan (JSON) — model type, rates, tiers, company name.
2. A usage summary — total events, breakdown by event type, unique customers, and the current invoice total.

Your job: return ONE or TWO sentences of sharp, specific pricing critique.

Rules:
- Be opinionated and specific to the numbers you see. Reference actual values.
- Focus on the most impactful observation: mispriced tiers, poor overage incentives, volume discounts that give away too much, flat rates that ignore usage patterns, etc.
- Never be generic ("consider A/B testing" or "talk to your customers"). Every word must reference this plan or this usage data.
- Be witty but not mean. The tone is "experienced advisor at a bar," not "angry consultant."
- Do NOT use markdown, bullet points, or lists. Just plain sentences.
- Maximum 280 characters. Be concise.`;

type UsageSummary = {
  totalEvents: number;
  uniqueCustomers: number;
  eventBreakdown: Record<string, number>;
  invoiceTotal: number;
};

type RoastRequestBody = {
  plan?: unknown;
  usageSummary?: UsageSummary;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const body = (await request.json()) as RoastRequestBody;
    if (!body.plan || !body.usageSummary) {
      return NextResponse.json(
        { error: "Missing plan or usage summary." },
        { status: 400 },
      );
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Plan:\n${JSON.stringify(body.plan, null, 2)}\n\nUsage Summary:\n${JSON.stringify(body.usageSummary, null, 2)}`,
        },
      ],
    });

    let roast = "";
    for (const block of response.content) {
      if (block.type === "text") {
        roast = block.text.trim();
        break;
      }
    }

    if (!roast) {
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    return NextResponse.json({ roast });
  } catch {
    return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
  }
}
