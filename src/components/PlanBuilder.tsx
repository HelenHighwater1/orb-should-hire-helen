import type { LineItem, Plan, PricingModelType, Tier } from "@/types/billing";
import { PRICING_MODEL_LABELS, PRICING_MODEL_TYPES } from "@/types/billing";

type PlanBuilderProps = {
  plan: Plan;
  selectedModelType: PricingModelType;
  onModelPresetChange: (modelType: PricingModelType) => void;
  onPlanChange: (plan: Plan) => void;
};

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateLineItem(plan: Plan, lineItem: LineItem): Plan {
  return {
    ...plan,
    lineItems: [lineItem, ...plan.lineItems.slice(1)],
  };
}

function updateTier(tiers: Tier[], index: number, updates: Partial<Tier>): Tier[] {
  return tiers.map((tier, tierIndex) =>
    tierIndex === index ? { ...tier, ...updates } : tier,
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted mb-1">{children}</label>;
}

function FieldInput({
  label,
  type = "number",
  step,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  type?: string;
  step?: string;
  value: string | number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function PlanBuilder({
  plan,
  selectedModelType,
  onModelPresetChange,
  onPlanChange,
}: PlanBuilderProps) {
  const lineItem = plan.lineItems[0];
  const pricingModel = lineItem.pricingModel;

  function updatePlanBase(updates: Partial<Plan>) {
    onPlanChange({ ...plan, ...updates });
  }

  function updatePricingModel(nextPricingModel: LineItem["pricingModel"]) {
    onPlanChange(updateLineItem(plan, { ...lineItem, pricingModel: nextPricingModel }));
  }

  return (
    <section className="flex flex-col rounded-xl border border-border bg-white shadow-sm p-5 h-full overflow-y-auto">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
        Plan Builder
      </h2>

      <div className="flex gap-1 mb-5 rounded-lg bg-gray-100 p-1">
        <button className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium bg-white shadow-sm text-accent">
          Manual Setup
        </button>
        <button className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted cursor-not-allowed">
          AI Setup
        </button>
      </div>

      <div>
        <FieldLabel>Pricing Model</FieldLabel>
        <select
          className="mb-4 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          value={selectedModelType}
          onChange={(event) => onModelPresetChange(event.target.value as PricingModelType)}
        >
          {PRICING_MODEL_TYPES.map((type) => (
            <option key={type} value={type}>
              {PRICING_MODEL_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-3">
        <FieldInput
          label="Company Name"
          type="text"
          value={plan.companyName}
          onChange={(v) => updatePlanBase({ companyName: v })}
        />

        <FieldInput
          label="Base Fee ($)"
          step="0.01"
          value={plan.baseFee}
          onChange={(v) => updatePlanBase({ baseFee: toNumber(v) })}
        />

        {(pricingModel.type === "tiered" ||
          pricingModel.type === "volume" ||
          pricingModel.type === "stairstep") && (
          <div>
            <FieldLabel>Tiers</FieldLabel>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-2 gap-0 bg-gray-50 px-3 py-1.5 text-xs font-medium text-muted border-b border-border">
                <span>Up to</span>
                <span>{pricingModel.type === "stairstep" ? "Flat fee ($)" : "Rate/unit ($)"}</span>
              </div>
              <div className="divide-y divide-border">
                {pricingModel.tiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 px-3 py-2">
                    <input
                      type="text"
                      value={tier.upTo}
                      className="rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const upTo: number | "infinity" = raw === "infinity" ? "infinity" : toNumber(raw);
                        updatePricingModel({
                          ...pricingModel,
                          tiers: updateTier(pricingModel.tiers, index, { upTo }),
                        });
                      }}
                    />
                    {pricingModel.type === "stairstep" ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tier.flatFee ?? 0}
                        className="rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
                        onChange={(event) =>
                          updatePricingModel({
                            ...pricingModel,
                            tiers: updateTier(pricingModel.tiers, index, {
                              flatFee: toNumber(event.target.value),
                            }),
                          })
                        }
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.001"
                        value={tier.pricePerUnit}
                        className="rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
                        onChange={(event) =>
                          updatePricingModel({
                            ...pricingModel,
                            tiers: updateTier(pricingModel.tiers, index, {
                              pricePerUnit: toNumber(event.target.value),
                            }),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {pricingModel.type === "flat_per_unit" && (
          <FieldInput
            label="Price Per Unit ($)"
            step="0.001"
            value={pricingModel.pricePerUnit}
            onChange={(v) =>
              updatePricingModel({ ...pricingModel, pricePerUnit: toNumber(v) })
            }
          />
        )}

        {pricingModel.type === "per_seat" && (
          <FieldInput
            label="Price Per Seat ($)"
            step="0.01"
            value={pricingModel.pricePerSeat}
            onChange={(v) =>
              updatePricingModel({ ...pricingModel, pricePerSeat: toNumber(v) })
            }
          />
        )}

        {pricingModel.type === "prepaid_credits" && (
          <div className="space-y-3">
            <FieldInput
              label="Credit Package Price ($)"
              step="0.01"
              value={pricingModel.creditPrice}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, creditPrice: toNumber(v) })
              }
            />
            <FieldInput
              label="Credits Per Package"
              step="1"
              value={pricingModel.creditsPerUnit}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, creditsPerUnit: toNumber(v) })
              }
            />
            <FieldInput
              label="Overage Rate Per Unit ($)"
              step="0.01"
              value={pricingModel.overagePricePerUnit ?? ""}
              placeholder="Optional"
              onChange={(v) =>
                updatePricingModel({
                  ...pricingModel,
                  overagePricePerUnit: v === "" ? undefined : toNumber(v),
                })
              }
            />
          </div>
        )}

        {pricingModel.type === "package" && (
          <div className="space-y-3">
            <FieldInput
              label="Package Size (units)"
              step="1"
              value={pricingModel.packageSize}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, packageSize: toNumber(v) })
              }
            />
            <FieldInput
              label="Package Price ($)"
              step="0.01"
              value={pricingModel.packagePrice}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, packagePrice: toNumber(v) })
              }
            />
            <FieldInput
              label="Overage Rate Per Unit ($)"
              step="0.01"
              value={pricingModel.overage ?? ""}
              placeholder="Optional"
              onChange={(v) =>
                updatePricingModel({
                  ...pricingModel,
                  overage: v === "" ? undefined : toNumber(v),
                })
              }
            />
          </div>
        )}

        {pricingModel.type === "flat_overage" && (
          <div className="space-y-3">
            <FieldInput
              label="Included Units"
              step="1"
              value={pricingModel.includedUnits}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, includedUnits: toNumber(v) })
              }
            />
            <FieldInput
              label="Monthly Base Fee ($)"
              step="0.01"
              value={pricingModel.baseFee}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, baseFee: toNumber(v) })
              }
            />
            <FieldInput
              label="Overage Price Per Unit ($)"
              step="0.001"
              value={pricingModel.overagePrice}
              onChange={(v) =>
                updatePricingModel({ ...pricingModel, overagePrice: toNumber(v) })
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
