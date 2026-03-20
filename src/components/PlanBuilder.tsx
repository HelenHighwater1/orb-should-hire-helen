"use client";

import { useState } from "react";
import { pickRandomBusinessIdea } from "@/data/aiBusinessIdeas";
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
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [productDescription, setProductDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  const lineItem = plan.lineItems[0];
  const pricingModel = lineItem.pricingModel;

  function updatePlanBase(updates: Partial<Plan>) {
    onPlanChange({ ...plan, ...updates });
  }

  function updatePricingModel(nextPricingModel: LineItem["pricingModel"]) {
    onPlanChange(updateLineItem(plan, { ...lineItem, pricingModel: nextPricingModel }));
  }

  async function handleGeneratePlan() {
    const description = productDescription.trim();
    if (!description) {
      setAiError("Please describe your product first.");
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDescription: description }),
      });

      const payload = (await response.json()) as {
        plan?: Plan;
        reasoning?: string;
        error?: string;
      };

      if (!response.ok || !payload.plan) {
        setAiError(
          payload.error ??
            "Couldn't generate a plan for that - try describing your product differently.",
        );
        return;
      }

      onPlanChange(payload.plan);
      setAiReasoning(payload.reasoning ?? "This plan was generated from your product description.");
      setIsReasoningOpen(false);
      setActiveTab("manual");
    } catch {
      setAiError("Couldn't generate a plan for that - try describing your product differently.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="flex flex-col rounded-xl border border-border bg-white shadow-sm p-5 h-full overflow-y-auto">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
        Plan Builder
      </h2>

      <div className="flex gap-1 mb-5 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "manual"
              ? "bg-white shadow-sm text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Manual Setup
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "ai"
              ? "bg-white shadow-sm text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          AI Setup
        </button>
      </div>

      {activeTab === "ai" ? (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <FieldLabel>What does your product do?</FieldLabel>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  setProductDescription(pickRandomBusinessIdea());
                  setAiError(null);
                }}
                className={`shrink-0 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium transition-colors ${
                  isGenerating
                    ? "text-muted opacity-50 cursor-not-allowed"
                    : "text-accent hover:bg-accent/5 hover:border-accent/30"
                }`}
              >
                Random idea
              </button>
            </div>
            <input
              type="text"
              value={productDescription}
              placeholder="e.g. We provide an image generation API for ecommerce teams."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isGenerating
                ? "bg-gray-200 text-muted cursor-not-allowed"
                : "bg-accent text-white hover:bg-accent/90"
            }`}
          >
            {isGenerating ? "Generating..." : "Generate Plan"}
          </button>
          {aiError && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {aiError}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
            <div className="w-full min-w-0">
              <FieldLabel>Tiers</FieldLabel>
              <div className="-mx-5 max-md:overflow-x-auto md:mx-0 md:max-w-none md:overflow-visible">
                <div className="min-w-[min(100%,280px)] md:min-w-0">
                  <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-0 border-b border-border bg-gray-50 px-3 py-1.5 text-xs font-medium text-muted">
                  <span>Up to</span>
                  <span>{pricingModel.type === "stairstep" ? "Flat fee ($)" : "Rate/unit ($)"}</span>
                </div>
                <div className="divide-y divide-border">
                  {pricingModel.tiers.map((tier, index) => (
                    <div key={index} className="grid min-w-0 grid-cols-2 gap-2 px-3 py-2">
                      <input
                        type="text"
                        value={tier.upTo}
                        className="min-w-0 w-full rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                          className="min-w-0 w-full rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                          className="min-w-0 w-full rounded-md border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
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
      )}

      {aiReasoning && (
        <div className="mt-4 rounded-lg border border-border bg-gray-50">
          <button
            type="button"
            onClick={() => setIsReasoningOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left"
          >
            <span>Why this plan?</span>
            <span className="text-muted">{isReasoningOpen ? "−" : "+"}</span>
          </button>
          {isReasoningOpen && (
            <div className="px-3 pb-3 text-sm text-muted leading-relaxed">
              {aiReasoning}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
