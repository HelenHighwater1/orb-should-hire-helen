import type {
  Invoice,
  LineItem,
  LineItemCharge,
  Plan,
  Tier,
  TierBreakdown,
  UsageEvent,
} from "@/types/billing";

type CalculateInvoiceOptions = {
  customerId: string;
  previousInvoice?: Invoice;
  periodStart?: Date;
  periodEnd?: Date;
};

type ModelResult = {
  charge: number;
  tierBreakdown?: TierBreakdown[];
  crossedTierAt?: number;
  extraCharges?: LineItemCharge[];
};

const INFINITY = Number.POSITIVE_INFINITY;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function tierUpperBound(tier: Tier): number {
  return tier.upTo === "infinity" ? INFINITY : tier.upTo;
}

function getMatchedTierIndex(tiers: Tier[], units: number): number {
  if (units <= 0) {
    return -1;
  }

  for (let i = 0; i < tiers.length; i += 1) {
    if (units <= tierUpperBound(tiers[i])) {
      return i;
    }
  }

  return tiers.length - 1;
}

function getTierCrossingAt(tiers: Tier[], previousUnits: number, nextUnits: number): number | undefined {
  if (nextUnits <= previousUnits) {
    return undefined;
  }

  const prevIndex = getMatchedTierIndex(tiers, previousUnits);
  const nextIndex = getMatchedTierIndex(tiers, nextUnits);

  if (prevIndex === nextIndex || nextIndex <= 0) {
    return undefined;
  }

  const crossedTier = tiers[nextIndex - 1];
  return tierUpperBound(crossedTier);
}

function calculateTieredModel(units: number, tiers: Tier[], previousUnits: number): ModelResult {
  if (units <= 0) {
    return { charge: 0 };
  }

  let remaining = units;
  let lowerBound = 1;
  let total = 0;
  const tierBreakdown: TierBreakdown[] = [];

  for (const tier of tiers) {
    if (remaining <= 0) {
      break;
    }

    const upperBound = tierUpperBound(tier);
    const tierCapacity = upperBound === INFINITY ? remaining : upperBound - lowerBound + 1;
    const tierUnits = Math.max(0, Math.min(remaining, tierCapacity));

    if (tierUnits > 0) {
      const subtotal = roundCurrency(tierUnits * tier.pricePerUnit);
      total += subtotal;
      tierBreakdown.push({
        tierLabel: upperBound === INFINITY ? `${lowerBound}+` : `${lowerBound}-${upperBound}`,
        units: tierUnits,
        pricePerUnit: tier.pricePerUnit,
        subtotal,
      });
      remaining -= tierUnits;
    }

    if (upperBound !== INFINITY) {
      lowerBound = upperBound + 1;
    }
  }

  return {
    charge: roundCurrency(total),
    tierBreakdown,
    crossedTierAt: getTierCrossingAt(tiers, previousUnits, units),
  };
}

function calculateVolumeModel(units: number, tiers: Tier[], previousUnits: number): ModelResult {
  if (units <= 0) {
    return { charge: 0 };
  }

  const tierIndex = getMatchedTierIndex(tiers, units);
  const tier = tierIndex >= 0 ? tiers[tierIndex] : tiers[0];
  const subtotal = roundCurrency(units * tier.pricePerUnit);

  return {
    charge: subtotal,
    tierBreakdown: [
      {
        tierLabel:
          tier.upTo === "infinity"
            ? `Volume tier ${tierIndex + 1} (${units}+ units)`
            : `Volume tier ${tierIndex + 1} (up to ${tier.upTo})`,
        units,
        pricePerUnit: tier.pricePerUnit,
        subtotal,
      },
    ],
    crossedTierAt: getTierCrossingAt(tiers, previousUnits, units),
  };
}

function calculateStairstepModel(units: number, tiers: Tier[], previousUnits: number): ModelResult {
  if (units <= 0) {
    return { charge: 0 };
  }

  const tierIndex = getMatchedTierIndex(tiers, units);
  const tier = tierIndex >= 0 ? tiers[tierIndex] : tiers[0];
  const fee = tier.flatFee ?? 0;

  return {
    charge: roundCurrency(fee),
    tierBreakdown: [
      {
        tierLabel:
          tier.upTo === "infinity"
            ? `Stairstep tier ${tierIndex + 1} (${units}+ units)`
            : `Stairstep tier ${tierIndex + 1} (up to ${tier.upTo})`,
        units,
        pricePerUnit: 0,
        subtotal: roundCurrency(fee),
      },
    ],
    crossedTierAt: getTierCrossingAt(tiers, previousUnits, units),
  };
}

function calculatePackageModel(
  units: number,
  packageSize: number,
  packagePrice: number,
  overage?: number,
): ModelResult {
  if (units <= 0) {
    return { charge: 0 };
  }

  const fullPackages = Math.floor(units / packageSize);
  const remainder = units % packageSize;

  let charge = fullPackages * packagePrice;
  let breakdownLabel = `${fullPackages} package(s)`;

  if (remainder > 0) {
    if (typeof overage === "number") {
      charge += remainder * overage;
      breakdownLabel += ` + ${remainder} overage unit(s)`;
    } else {
      charge = Math.ceil(units / packageSize) * packagePrice;
      breakdownLabel = `${Math.ceil(units / packageSize)} package(s)`;
    }
  }

  const roundedCharge = roundCurrency(charge);
  return {
    charge: roundedCharge,
    tierBreakdown: [
      {
        tierLabel: breakdownLabel,
        units,
        pricePerUnit: roundCurrency(roundedCharge / units),
        subtotal: roundedCharge,
      },
    ],
  };
}

function buildLineItemCharge(params: {
  lineItem: LineItem;
  unitsConsumed: number;
  result: ModelResult;
  previousCharge?: number;
}): LineItemCharge {
  const { lineItem, unitsConsumed, result, previousCharge } = params;
  return {
    lineItemId: lineItem.id,
    displayName: lineItem.displayName,
    unit: lineItem.unit,
    unitsConsumed,
    pricingModel: lineItem.pricingModel,
    tierBreakdown: result.tierBreakdown,
    charge: roundCurrency(result.charge),
    previousCharge,
    crossedTierAt: result.crossedTierAt,
  };
}

export function calculateInvoice(
  events: UsageEvent[],
  plan: Plan,
  options: CalculateInvoiceOptions,
): Invoice {
  const periodEnd = options.periodEnd ?? new Date();
  const periodStart =
    options.periodStart ??
    new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1, 0, 0, 0, 0);

  const customerEvents = events.filter((event) => event.customerId === options.customerId);
  const previousChargesMap = new Map(
    options.previousInvoice?.lineItemCharges.map((charge) => [charge.lineItemId, charge]) ?? [],
  );

  const lineItemCharges: LineItemCharge[] = [];

  for (const lineItem of plan.lineItems) {
    const matchingEvents = customerEvents.filter((event) => event.eventType === lineItem.eventType);
    const defaultUnitsConsumed = matchingEvents.reduce((sum, event) => sum + event.quantity, 0);
    const unitsConsumed =
      lineItem.pricingModel.type === "per_seat" ? matchingEvents.length : defaultUnitsConsumed;

    const previousEntry = previousChargesMap.get(lineItem.id);
    const previousUnits = previousEntry?.unitsConsumed ?? 0;

    let result: ModelResult;

    switch (lineItem.pricingModel.type) {
      case "flat_per_unit":
        result = {
          charge: roundCurrency(unitsConsumed * lineItem.pricingModel.pricePerUnit),
        };
        break;
      case "tiered":
        result = calculateTieredModel(unitsConsumed, lineItem.pricingModel.tiers, previousUnits);
        break;
      case "volume":
        result = calculateVolumeModel(unitsConsumed, lineItem.pricingModel.tiers, previousUnits);
        break;
      case "stairstep":
        result = calculateStairstepModel(unitsConsumed, lineItem.pricingModel.tiers, previousUnits);
        break;
      case "per_seat":
        result = {
          charge: roundCurrency(unitsConsumed * lineItem.pricingModel.pricePerSeat),
        };
        break;
      case "prepaid_credits": {
        const { creditPrice, creditsPerUnit: includedUnits, overagePricePerUnit } =
          lineItem.pricingModel;
        const creditsUsed = Math.min(unitsConsumed, includedUnits);
        const overageUnits = Math.max(0, unitsConsumed - includedUnits);
        const overageCharge =
          overageUnits > 0 && typeof overagePricePerUnit === "number"
            ? roundCurrency(overageUnits * overagePricePerUnit)
            : 0;

        /** Customer prepays the package for the period; overage is incremental */
        const packageCharge = unitsConsumed > 0 ? creditPrice : 0;
        const totalCharge = roundCurrency(packageCharge + overageCharge);

        const tierBreakdown: TierBreakdown[] = [];

        if (unitsConsumed > 0) {
          tierBreakdown.push({
            tierLabel: "Prepaid credits package",
            units: 1,
            pricePerUnit: creditPrice,
            subtotal: roundCurrency(creditPrice),
            rowFormat: "package",
          });

          if (creditsUsed > 0) {
            tierBreakdown.push({
              tierLabel: "Included usage (from package)",
              units: creditsUsed,
              pricePerUnit: 0,
              subtotal: 0,
              rowFormat: "included_usage",
            });
          }

          if (overageUnits > 0) {
            if (typeof overagePricePerUnit === "number") {
              tierBreakdown.push({
                tierLabel: "Overage",
                units: overageUnits,
                pricePerUnit: overagePricePerUnit,
                subtotal: overageCharge,
                rowFormat: "multiplier",
              });
            } else {
              tierBreakdown.push({
                tierLabel: "Beyond included credits - overage not offered",
                units: overageUnits,
                pricePerUnit: 0,
                subtotal: 0,
                rowFormat: "plain",
              });
            }
          }
        }

        result = {
          charge: totalCharge,
          tierBreakdown,
        };
        break;
      }
      case "package":
        result = calculatePackageModel(
          unitsConsumed,
          lineItem.pricingModel.packageSize,
          lineItem.pricingModel.packagePrice,
          lineItem.pricingModel.overage,
        );
        break;
      case "flat_overage": {
        const overageUnits = Math.max(0, unitsConsumed - lineItem.pricingModel.includedUnits);
        const overageCharge = roundCurrency(overageUnits * lineItem.pricingModel.overagePrice);
        result = {
          charge: roundCurrency(lineItem.pricingModel.baseFee + overageCharge),
          tierBreakdown: [
            {
              tierLabel: `Included units (${lineItem.pricingModel.includedUnits})`,
              units: Math.min(unitsConsumed, lineItem.pricingModel.includedUnits),
              pricePerUnit: 0,
              subtotal: lineItem.pricingModel.baseFee,
            },
            {
              tierLabel: "Overage",
              units: overageUnits,
              pricePerUnit: lineItem.pricingModel.overagePrice,
              subtotal: overageCharge,
            },
          ],
        };
        break;
      }
      default:
        result = { charge: 0 };
    }

    lineItemCharges.push(
      buildLineItemCharge({
        lineItem,
        unitsConsumed,
        result,
        previousCharge: previousEntry?.charge,
      }),
    );

    if (result.extraCharges) {
      lineItemCharges.push(...result.extraCharges);
    }
  }

  const lineItemsTotal = lineItemCharges.reduce((sum, item) => sum + item.charge, 0);
  const subtotal = roundCurrency(plan.baseFee + lineItemsTotal);

  return {
    customerId: options.customerId,
    periodStart,
    periodEnd,
    baseFee: plan.baseFee,
    lineItemCharges,
    subtotal,
    total: subtotal,
  };
}
