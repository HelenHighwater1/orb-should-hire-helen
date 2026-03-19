import type { LineItem, Plan, PricingModel, Tier } from "@/types/billing";

const FRIENDLY_GENERATION_ERROR =
  "Couldn't generate a plan for that — try describing your product differently.";

type ValidationSuccess = { plan: Plan; issues: string[] };
type ValidationFailure = { error: string };

export type ValidatePlanResult = ValidationSuccess | ValidationFailure;

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function ensureString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function coerceTier(rawTier: unknown, index: number, issues: string[]): Tier {
  const tierObj = (rawTier ?? {}) as Record<string, unknown>;
  const rawUpTo = tierObj.upTo;

  let upTo: number | "infinity";
  if (rawUpTo === "infinity") {
    upTo = "infinity";
  } else {
    upTo = Math.max(1, Math.floor(toNonNegativeNumber(rawUpTo, index + 1)));
  }

  return {
    upTo,
    pricePerUnit: toNonNegativeNumber(tierObj.pricePerUnit, 0),
    flatFee:
      typeof tierObj.flatFee === "undefined"
        ? undefined
        : toNonNegativeNumber(tierObj.flatFee, 0),
  };
}

function sanitizeTiers(rawTiers: unknown, issues: string[]): Tier[] {
  if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
    issues.push("Missing tiers; generated a default two-tier structure.");
    return [
      { upTo: 100, pricePerUnit: 1 },
      { upTo: "infinity", pricePerUnit: 0.5 },
    ];
  }

  const capped = rawTiers.slice(0, 5).map((tier, index) => coerceTier(tier, index, issues));
  if (rawTiers.length > 5) {
    issues.push("Tier count capped at 5.");
  }

  const numericTiers: Tier[] = [];
  const infinityTier = capped.find((tier) => tier.upTo === "infinity");
  const sortable = capped.filter((tier) => tier.upTo !== "infinity") as Array<Tier & { upTo: number }>;
  sortable.sort((a, b) => a.upTo - b.upTo);

  let previousUpTo = 0;
  for (const tier of sortable) {
    const nextUpTo = Math.max(previousUpTo + 1, tier.upTo);
    if (nextUpTo !== tier.upTo) {
      issues.push("Adjusted tier boundaries to maintain ascending order.");
    }
    numericTiers.push({ ...tier, upTo: nextUpTo });
    previousUpTo = nextUpTo;
  }

  const terminalTier =
    infinityTier ??
    ({
      upTo: "infinity",
      pricePerUnit: numericTiers.length > 0 ? numericTiers[numericTiers.length - 1].pricePerUnit : 0.5,
    } satisfies Tier);

  if (!infinityTier) {
    issues.push('Added terminal tier with upTo: "infinity".');
  }

  return [...numericTiers, terminalTier];
}

function sanitizePricingModel(rawModel: unknown, issues: string[]): PricingModel | null {
  const model = (rawModel ?? {}) as Record<string, unknown>;
  const type = model.type;

  if (type === "flat_per_unit") {
    return { type, pricePerUnit: toNonNegativeNumber(model.pricePerUnit, 0) };
  }
  if (type === "tiered" || type === "volume" || type === "stairstep") {
    return { type, tiers: sanitizeTiers(model.tiers, issues) } as PricingModel;
  }
  if (type === "per_seat") {
    return { type, pricePerSeat: toNonNegativeNumber(model.pricePerSeat, 0) };
  }
  if (type === "prepaid_credits") {
    const overage =
      typeof model.overagePricePerUnit === "undefined"
        ? undefined
        : toNonNegativeNumber(model.overagePricePerUnit, 0);
    return {
      type,
      creditPrice: toNonNegativeNumber(model.creditPrice, 0),
      creditsPerUnit: Math.max(1, Math.floor(toNonNegativeNumber(model.creditsPerUnit, 1))),
      overagePricePerUnit: overage,
    };
  }
  if (type === "package") {
    return {
      type,
      packageSize: Math.max(1, Math.floor(toNonNegativeNumber(model.packageSize, 1))),
      packagePrice: toNonNegativeNumber(model.packagePrice, 0),
      overage:
        typeof model.overage === "undefined" ? undefined : toNonNegativeNumber(model.overage, 0),
    };
  }
  if (type === "flat_overage") {
    return {
      type,
      includedUnits: Math.max(0, Math.floor(toNonNegativeNumber(model.includedUnits, 0))),
      baseFee: toNonNegativeNumber(model.baseFee, 0),
      overagePrice: toNonNegativeNumber(model.overagePrice, 0),
    };
  }

  return null;
}

function sanitizeLineItem(rawItem: unknown, index: number, issues: string[]): LineItem | null {
  const item = (rawItem ?? {}) as Record<string, unknown>;
  const pricingModel = sanitizePricingModel(item.pricingModel, issues);
  if (!pricingModel) return null;

  return {
    id: ensureString(item.id, crypto.randomUUID()),
    eventType: ensureString(item.eventType, `event_type_${index + 1}`),
    displayName: ensureString(item.displayName, `Line Item ${index + 1}`),
    unit: ensureString(item.unit, "unit"),
    pricingModel,
  };
}

export function validateAndSanitizePlan(raw: unknown): ValidatePlanResult {
  const root = (raw ?? {}) as Record<string, unknown>;

  if (!root || typeof root !== "object") {
    return { error: FRIENDLY_GENERATION_ERROR };
  }

  const rawPlan = (root.plan ?? root) as Record<string, unknown>;
  if (!rawPlan || typeof rawPlan !== "object") {
    return { error: FRIENDLY_GENERATION_ERROR };
  }

  if (!Array.isArray(rawPlan.lineItems) || rawPlan.lineItems.length === 0) {
    return { error: FRIENDLY_GENERATION_ERROR };
  }

  const issues: string[] = [];
  const lineItems: LineItem[] = [];

  rawPlan.lineItems.forEach((rawItem, index) => {
    const sanitized = sanitizeLineItem(rawItem, index, issues);
    if (sanitized) lineItems.push(sanitized);
  });

  if (lineItems.length === 0) {
    return { error: FRIENDLY_GENERATION_ERROR };
  }

  let baseFee = toNonNegativeNumber(rawPlan.baseFee, 0);
  if (lineItems.some((lineItem) => lineItem.pricingModel.type === "flat_overage")) {
    if (baseFee !== 0) {
      issues.push("Reset Plan.baseFee to 0 for flat_overage convention.");
    }
    baseFee = 0;
  }

  const plan: Plan = {
    id: ensureString(rawPlan.id, crypto.randomUUID()),
    name: ensureString(rawPlan.name, "Generated Plan"),
    companyName: ensureString(rawPlan.companyName, "GeneratedCo"),
    currency: "USD",
    billingPeriod: "monthly",
    baseFee,
    lineItems,
  };

  return { plan, issues };
}

export { FRIENDLY_GENERATION_ERROR };
