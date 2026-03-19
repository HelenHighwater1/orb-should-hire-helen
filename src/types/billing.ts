// ─── Usage Events ────────────────────────────────────────────────────────────

export type UsageEvent = {
  id: string;
  timestamp: Date;
  customerId: string;
  /** Maps to a LineItem.eventType in the Plan */
  eventType: string;
  quantity: number;
  metadata?: Record<string, string>;
};

// ─── Plan & Line Items ──────────────────────────────────────────────────────

/**
 * Convention: For `flat_overage` plans, `baseFee` must always be 0 here.
 * The base fee for that model lives inside `PricingModel.baseFee` to prevent
 * double-counting. The invoice calculator reads only one place per charge type.
 */
export type Plan = {
  id: string;
  name: string;
  companyName: string;
  currency: "USD";
  billingPeriod: "monthly";
  baseFee: number;
  lineItems: LineItem[];
};

export type LineItem = {
  id: string;
  eventType: string;
  displayName: string;
  unit: string;
  pricingModel: PricingModel;
};

// ─── Pricing Models ─────────────────────────────────────────────────────────

export type PricingModel =
  | { type: "flat_per_unit"; pricePerUnit: number }
  | { type: "tiered"; tiers: Tier[] }
  | { type: "volume"; tiers: Tier[] }
  | { type: "stairstep"; tiers: Tier[] }
  | { type: "per_seat"; pricePerSeat: number }
  | {
      type: "prepaid_credits";
      creditPrice: number;
      creditsPerUnit: number;
      /**
       * If defined, overage kicks in when the credit balance reaches zero and
       * charges at this rate per unit. If undefined, overage is not offered —
       * show a "credits exhausted" warning with no additional charge.
       */
      overagePricePerUnit?: number;
    }
  | { type: "package"; packageSize: number; packagePrice: number; overage?: number }
  | { type: "flat_overage"; includedUnits: number; baseFee: number; overagePrice: number };

/**
 * Convention: `upTo` is inclusive across all tiered models.
 * `upTo: 1000` means units 1–1000 fall in that tier; the next tier starts at 1001.
 * This applies to tiered, volume, stairstep, and any other model using Tier[].
 *
 * `flatFee` is used only by stairstep — the calculator ignores `pricePerUnit`
 * for stairstep and reads only `flatFee` from the matched tier.
 */
export type Tier = {
  upTo: number | "infinity";
  pricePerUnit: number;
  flatFee?: number;
};

// ─── Invoice (Derived — never stored) ───────────────────────────────────────

export type Invoice = {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  baseFee: number;
  lineItemCharges: LineItemCharge[];
  subtotal: number;
  total: number;
};

export type LineItemCharge = {
  lineItemId: string;
  displayName: string;
  unit: string;
  unitsConsumed: number;
  pricingModel: PricingModel;
  tierBreakdown?: TierBreakdown[];
  charge: number;
  /** Previous charge amount — used to animate the delta on change */
  previousCharge?: number;
  /** Unit count at which a tier boundary was crossed; triggers special UI */
  crossedTierAt?: number;
};

/**
 * `rowFormat` controls invoice UI for rows that aren't a simple units × rate:
 * - multiplier (default): units × pricePerUnit = subtotal
 * - package: prepaid bundle — show label + subtotal only (no fake quantity × rate)
 * - included_usage: units drawn from prepaid balance — no $0 rate column
 * - plain: notice-style row (e.g. unbilled overage when no overage rate)
 */
export type TierBreakdownRowFormat = "multiplier" | "package" | "included_usage" | "plain";

export type TierBreakdown = {
  tierLabel: string;
  units: number;
  pricePerUnit: number;
  subtotal: number;
  rowFormat?: TierBreakdownRowFormat;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export const PRICING_MODEL_TYPES = [
  "flat_per_unit",
  "tiered",
  "volume",
  "stairstep",
  "per_seat",
  "prepaid_credits",
  "package",
  "flat_overage",
] as const;

export type PricingModelType = (typeof PRICING_MODEL_TYPES)[number];

export const PRICING_MODEL_LABELS: Record<PricingModelType, string> = {
  flat_per_unit: "Flat per Unit",
  tiered: "Tiered",
  volume: "Volume",
  stairstep: "Stairstep",
  per_seat: "Per Seat",
  prepaid_credits: "Prepaid Credits",
  package: "Package / Bundles",
  flat_overage: "Flat + Overage",
};
