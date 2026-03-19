import { Plan } from "@/types/billing";

export const flatPerUnitPlan: Plan = {
  id: "preset-flat-per-unit",
  name: "Flat per Unit",
  companyName: "NovaCast API",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-api-call",
      eventType: "api_call",
      displayName: "API Calls",
      unit: "call",
      pricingModel: { type: "flat_per_unit", pricePerUnit: 0.002 },
    },
  ],
};

export const tieredPlan: Plan = {
  id: "preset-tiered",
  name: "Tiered",
  companyName: "WidgetCo",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-widget-created",
      eventType: "widget_created",
      displayName: "Widgets Created",
      unit: "widget",
      pricingModel: {
        type: "tiered",
        tiers: [
          { upTo: 100, pricePerUnit: 0.5 },
          { upTo: 500, pricePerUnit: 0.3 },
          { upTo: 2000, pricePerUnit: 0.15 },
          { upTo: "infinity", pricePerUnit: 0.08 },
        ],
      },
    },
  ],
};

export const volumePlan: Plan = {
  id: "preset-volume",
  name: "Volume",
  companyName: "PulseDB",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-query",
      eventType: "query",
      displayName: "Database Queries",
      unit: "query",
      pricingModel: {
        type: "volume",
        tiers: [
          { upTo: 10000, pricePerUnit: 0.01 },
          { upTo: 100000, pricePerUnit: 0.005 },
          { upTo: "infinity", pricePerUnit: 0.001 },
        ],
      },
    },
  ],
};

export const perSeatPlan: Plan = {
  id: "preset-per-seat",
  name: "Per Seat",
  companyName: "TeamFlow",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-active-user",
      eventType: "active_user",
      displayName: "Active Users",
      unit: "seat",
      pricingModel: { type: "per_seat", pricePerSeat: 12 },
    },
  ],
};

export const flatOveragePlan: Plan = {
  id: "preset-flat-overage",
  name: "Flat + Overage",
  companyName: "MailRelay",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0, // baseFee lives inside the PricingModel for flat_overage
  lineItems: [
    {
      id: "li-email-sent",
      eventType: "email_sent",
      displayName: "Emails Sent",
      unit: "email",
      pricingModel: {
        type: "flat_overage",
        includedUnits: 10000,
        baseFee: 49,
        overagePrice: 0.003,
      },
    },
  ],
};

export const packagePlan: Plan = {
  id: "preset-package",
  name: "Package / Bundles",
  companyName: "RenderFast",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-render",
      eventType: "render",
      displayName: "Renders",
      unit: "render",
      pricingModel: {
        type: "package",
        packageSize: 100,
        packagePrice: 25,
        overage: 0.35,
      },
    },
  ],
};

export const stairstepPlan: Plan = {
  id: "preset-stairstep",
  name: "Stairstep",
  companyName: "FormPilot",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-form-submission",
      eventType: "form_submission",
      displayName: "Form Submissions",
      unit: "submission",
      pricingModel: {
        type: "stairstep",
        tiers: [
          { upTo: 100, pricePerUnit: 0, flatFee: 19 },
          { upTo: 500, pricePerUnit: 0, flatFee: 49 },
          { upTo: 2000, pricePerUnit: 0, flatFee: 99 },
          { upTo: "infinity", pricePerUnit: 0, flatFee: 199 },
        ],
      },
    },
  ],
};

export const prepaidCreditsPlan: Plan = {
  id: "preset-prepaid-credits",
  name: "Prepaid Credits",
  companyName: "Lumina AI",
  currency: "USD",
  billingPeriod: "monthly",
  baseFee: 0,
  lineItems: [
    {
      id: "li-image-generation",
      eventType: "image_generation",
      displayName: "Image Generations",
      unit: "generation",
      pricingModel: {
        type: "prepaid_credits",
        creditPrice: 50,
        creditsPerUnit: 500,
        // Overage rate ($0.15) is deliberately higher than the implied credit
        // rate ($50 / 500 = $0.10) to incentivize buying credits upfront.
        overagePricePerUnit: 0.15,
      },
    },
  ],
};

export const ALL_PRESETS: Plan[] = [
  flatPerUnitPlan,
  tieredPlan,
  volumePlan,
  perSeatPlan,
  flatOveragePlan,
  packagePlan,
  stairstepPlan,
  prepaidCreditsPlan,
];

export const DEFAULT_PLAN = tieredPlan;
