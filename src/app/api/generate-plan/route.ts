import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  FRIENDLY_GENERATION_ERROR,
  validateAndSanitizePlan,
} from "@/lib/validatePlan";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You generate usage-based billing plans for a sandbox app.

Return strict JSON only, no markdown, no code fences.
Schema:
{
  "plan": {
    "id": "string",
    "name": "string",
    "companyName": "string",
    "currency": "USD",
    "billingPeriod": "monthly",
    "baseFee": number,
    "lineItems": [
      {
        "id": "string",
        "eventType": "string",
        "displayName": "string",
        "unit": "string",
        "pricingModel": PricingModel
      }
    ]
  },
  "reasoning": "1 short paragraph"
}

Allowed PricingModel variants:
- {"type":"flat_per_unit","pricePerUnit":number}
- {"type":"tiered","tiers":[{"upTo":number|"infinity","pricePerUnit":number,"flatFee"?:number}]}
- {"type":"volume","tiers":[{"upTo":number|"infinity","pricePerUnit":number,"flatFee"?:number}]}
- {"type":"stairstep","tiers":[{"upTo":number|"infinity","pricePerUnit":number,"flatFee"?:number}]}
- {"type":"per_seat","pricePerSeat":number}
- {"type":"prepaid_credits","creditPrice":number,"creditsPerUnit":number,"overagePricePerUnit"?:number}
- {"type":"package","packageSize":number,"packagePrice":number,"overage"?:number}
- {"type":"flat_overage","includedUnits":number,"baseFee":number,"overagePrice":number}

Constraints:
- Use only one pricing model type per generated plan (one line item is fine).
- Keep numbers realistic and non-negative.
- Keep tiers at 3-5 entries when tier-based.
- For flat_overage, set plan.baseFee to 0.`;

function extractTextContent(content: Anthropic.Messages.Message["content"]): string {
  for (const block of content) {
    if (block.type === "text") {
      return block.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: FRIENDLY_GENERATION_ERROR }, { status: 500 });
    }

    const body = (await request.json()) as { productDescription?: string };
    const productDescription = body.productDescription?.trim();
    if (!productDescription) {
      return NextResponse.json({ error: "Please describe your product first." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Product description: ${productDescription}`,
        },
      ],
    });

    const text = extractTextContent(response.content);
    const parsed = JSON.parse(text) as { plan?: unknown; reasoning?: unknown };

    const validation = validateAndSanitizePlan(parsed);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
        ? parsed.reasoning.trim()
        : "This plan was generated from your product description and normalized for the sandbox.";

    return NextResponse.json({
      plan: validation.plan,
      reasoning,
      issues: validation.issues,
    });
  } catch {
    return NextResponse.json({ error: FRIENDLY_GENERATION_ERROR }, { status: 500 });
  }
}
