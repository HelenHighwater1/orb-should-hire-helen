"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { tierBadgeVariants, tierCrossFlash } from "@/lib/animation";
import type { Invoice, LineItemCharge, Plan, UsageEvent } from "@/types/billing";

type LiveInvoiceProps = {
  plan: Plan;
  invoice: Invoice;
  customerIds: string[];
  selectedCustomerId: string;
  onCustomerChange: (customerId: string) => void;
  events: UsageEvent[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function shouldShowBreakdownRow(row: { units: number; subtotal: number }): boolean {
  return row.units > 0 || row.subtotal > 0;
}

function isCreditsExhausted(charge: LineItemCharge): boolean {
  if (charge.pricingModel.type !== "prepaid_credits") return false;
  const included = charge.pricingModel.creditsPerUnit;
  return charge.unitsConsumed > included;
}

function hasNoOverageRate(charge: LineItemCharge): boolean {
  if (charge.pricingModel.type !== "prepaid_credits") return false;
  return typeof charge.pricingModel.overagePricePerUnit !== "number";
}

export function LiveInvoice({
  plan,
  invoice,
  customerIds,
  selectedCustomerId,
  onCustomerChange,
  events,
}: LiveInvoiceProps) {
  const eventTypesSeen = new Set(events.map((event) => event.eventType));
  const roastEnabled = events.length >= 15 && eventTypesSeen.size >= 2;
  const firedCrossingsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const charge of invoice.lineItemCharges) {
      if (charge.crossedTierAt != null) {
        const key = `${charge.lineItemId}-${charge.crossedTierAt}`;
        if (!firedCrossingsRef.current.has(key)) {
          firedCrossingsRef.current.add(key);
          toast.success(
            `${charge.displayName} crossed tier at ${charge.crossedTierAt.toLocaleString()} units!`,
          );
        }
      }
    }
  }, [invoice]);

  const visibleCharges = invoice.lineItemCharges.filter((charge) => {
    if (charge.lineItemId.endsWith("-credits") && charge.unitsConsumed === 0) {
      return false;
    }
    return true;
  });

  return (
    <section className="flex flex-col rounded-xl border border-border bg-white shadow-sm p-5 h-full overflow-y-auto">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
        Live Invoice
      </h2>

      <div className="mb-5 pb-4 border-b border-border">
        <p className="text-lg font-semibold">{plan.companyName}</p>
        <p className="text-xs text-muted">
          {formatDateRange(invoice.periodStart, invoice.periodEnd)}
        </p>
        <div className="mt-2">
          <label className="text-xs text-muted">Customer</label>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-mono"
            value={selectedCustomerId}
            onChange={(event) => onCustomerChange(event.target.value)}
          >
            {customerIds.length === 0 && <option value="">No customers yet</option>}
            {customerIds.map((customerId) => (
              <option key={customerId} value={customerId}>
                {customerId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {invoice.baseFee > 0 && (
        <div className="flex justify-between text-sm mb-3 pb-3 border-b border-border">
          <span className="text-muted">Base Fee</span>
          <AnimatedNumber value={invoice.baseFee} className="font-mono font-medium" />
        </div>
      )}

      <div className="flex-1 space-y-4">
        {visibleCharges.map((charge) => (
          <motion.div
            key={charge.lineItemId}
            variants={tierCrossFlash}
            initial="idle"
            animate={charge.crossedTierAt != null ? "flash" : "idle"}
            className="rounded-lg px-2 -mx-2 py-1"
          >
            <div className="flex justify-between text-sm font-medium">
              <span>{charge.displayName}</span>
              <AnimatedNumber value={charge.charge} className="font-mono" />
            </div>
            <p className="text-xs text-muted mt-0.5">
              {charge.unitsConsumed.toLocaleString()} {charge.unit}
              {charge.unitsConsumed === 1 ? "" : "s"}
            </p>

            <AnimatePresence>
              {charge.crossedTierAt != null && (
                <motion.div
                  variants={tierBadgeVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                >
                  Crossed tier at {charge.crossedTierAt.toLocaleString()} units
                </motion.div>
              )}
            </AnimatePresence>

            {isCreditsExhausted(charge) && hasNoOverageRate(charge) && (
              <div className="mt-1 inline-block rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                Credits exhausted
              </div>
            )}

            {charge.tierBreakdown && charge.tierBreakdown.length > 0 && (
              <div className="mt-2 space-y-1 ml-3">
                {charge.tierBreakdown
                  .filter(shouldShowBreakdownRow)
                  .map((row) => (
                    <div
                      key={`${charge.lineItemId}-${row.tierLabel}`}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <span className="shrink-0">{row.tierLabel}</span>
                      <span className="font-mono">
                        {row.units.toLocaleString()} × {formatCurrency(row.pricePerUnit)}
                      </span>
                      <span className="ml-auto font-mono">{formatCurrency(row.subtotal)}</span>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        ))}
        {visibleCharges.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Waiting for usage events for {selectedCustomerId || "a customer"}.
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border space-y-2">
        <div className="flex justify-between text-sm text-muted">
          <span>Subtotal</span>
          <AnimatedNumber value={invoice.subtotal} className="font-mono" />
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <AnimatedNumber value={invoice.total} className="font-mono" />
        </div>
      </div>

      <button
        className={`mt-5 w-full rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-colors ${
          roastEnabled
            ? "border-warning/50 bg-warning/5 text-warning hover:bg-warning/10"
            : "border-border bg-gray-50 text-muted opacity-50 cursor-not-allowed"
        }`}
        disabled={!roastEnabled}
      >
        🔥 Roast my pricing
      </button>
      {!roastEnabled && (
        <p className="text-xs text-muted text-center mt-1">
          Available after 15+ events with 2+ event types
        </p>
      )}
    </section>
  );
}
