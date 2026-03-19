import type { Plan, UsageEvent } from "@/types/billing";

const CUSTOMERS = [
  "acme_corp",
  "globex_inc",
  "stark_labs",
  "initech",
  "umbrella_co",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

type GenerateEventOptions = {
  preferredCustomerId?: string;
  preferredWeight?: number;
};

function pickCustomerId(options?: GenerateEventOptions): string {
  const preferredCustomerId = options?.preferredCustomerId;
  const preferredWeight = options?.preferredWeight ?? 0.5;

  if (!preferredCustomerId || !CUSTOMERS.includes(preferredCustomerId)) {
    return pickRandom(CUSTOMERS);
  }

  if (Math.random() < preferredWeight) {
    return preferredCustomerId;
  }

  const otherCustomers = CUSTOMERS.filter((customerId) => customerId !== preferredCustomerId);
  return pickRandom(otherCustomers);
}

function quantityRangeByEventType(eventType: string): { min: number; max: number } {
  if (eventType.includes("query") || eventType.includes("call")) {
    return { min: 20, max: 200 };
  }

  if (eventType.includes("email") || eventType.includes("render")) {
    return { min: 10, max: 120 };
  }

  if (eventType.includes("seat") || eventType.includes("user")) {
    return { min: 1, max: 1 };
  }

  return { min: 1, max: 20 };
}

export function generateEvent(plan: Plan, options?: GenerateEventOptions): UsageEvent {
  const lineItem = pickRandom(plan.lineItems);
  const { min, max } = quantityRangeByEventType(lineItem.eventType);

  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    customerId: pickCustomerId(options),
    eventType: lineItem.eventType,
    quantity: randomInt(min, max),
    metadata: {
      source: "simulated",
      unit: lineItem.unit,
    },
  };
}

export function generateSpike(
  plan: Plan,
  count?: number,
  options?: GenerateEventOptions,
): UsageEvent[] {
  const burstCount = count ?? randomInt(8, 15);
  return Array.from({ length: burstCount }, () => generateEvent(plan, options));
}

