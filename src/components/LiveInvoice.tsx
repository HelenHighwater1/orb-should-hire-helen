"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { tierBadgeVariants, tierCrossFlash } from "@/lib/animation";
import type { Invoice, LineItemCharge, Plan, TierBreakdown, UsageEvent } from "@/types/billing";

const TIER_BADGE_DISMISS_MS = 3000;

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

function BreakdownRow({ row }: { row: TierBreakdown }) {
  const fmt = row.rowFormat ?? "multiplier";

  if (fmt === "package") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="shrink-0 font-medium text-foreground">{row.tierLabel}</span>
        <span className="ml-auto font-mono text-foreground">{formatCurrency(row.subtotal)}</span>
      </div>
    );
  }

  if (fmt === "included_usage") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="shrink-0">{row.tierLabel}</span>
        <span className="ml-auto">{row.units.toLocaleString()} units covered</span>
      </div>
    );
  }

  if (fmt === "plain") {
    return (
      <div className="flex items-center gap-2 text-xs text-warning">
        <span className="shrink-0">{row.tierLabel}</span>
        <span className="ml-auto font-mono">{row.units.toLocaleString()} units</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="shrink-0">{row.tierLabel}</span>
      <span className="font-mono">
        {row.units.toLocaleString()} × {formatCurrency(row.pricePerUnit)}
      </span>
      <span className="ml-auto font-mono">{formatCurrency(row.subtotal)}</span>
    </div>
  );
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

  const [roastText, setRoastText] = useState<string | null>(null);
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastError, setRoastError] = useState<string | null>(null);

  const firedCrossingsRef = useRef<Set<string>>(new Set());
  const [activeBadges, setActiveBadges] = useState<Set<string>>(new Set());
  const badgeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissBadge = useCallback((key: string) => {
    setActiveBadges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    badgeTimersRef.current.delete(key);
  }, []);

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

        if (!activeBadges.has(key) && !badgeTimersRef.current.has(key)) {
          setActiveBadges((prev) => new Set(prev).add(key));
          badgeTimersRef.current.set(
            key,
            setTimeout(() => dismissBadge(key), TIER_BADGE_DISMISS_MS),
          );
        }
      }
    }
  }, [invoice, activeBadges, dismissBadge]);

  useEffect(() => {
    const timers = badgeTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  const visibleCharges = invoice.lineItemCharges;

  async function handleRoast() {
    setRoastLoading(true);
    setRoastError(null);

    const eventBreakdown: Record<string, number> = {};
    for (const ev of events) {
      eventBreakdown[ev.eventType] = (eventBreakdown[ev.eventType] ?? 0) + ev.quantity;
    }

    try {
      const res = await fetch("/api/roast-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          usageSummary: {
            totalEvents: events.length,
            uniqueCustomers: new Set(events.map((e) => e.customerId)).size,
            eventBreakdown,
            invoiceTotal: invoice.total,
          },
        }),
      });

      const data = (await res.json()) as { roast?: string; error?: string };
      if (!res.ok || data.error) {
        setRoastError(data.error ?? "Something went wrong.");
      } else if (data.roast) {
        setRoastText(data.roast);
      }
    } catch {
      setRoastError("Couldn't reach the server — try again in a moment.");
    } finally {
      setRoastLoading(false);
    }
  }

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
            animate={
              charge.crossedTierAt != null &&
              activeBadges.has(`${charge.lineItemId}-${charge.crossedTierAt}`)
                ? "flash"
                : "idle"
            }
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
              {charge.crossedTierAt != null &&
                activeBadges.has(`${charge.lineItemId}-${charge.crossedTierAt}`) && (
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
              <div className="mt-2 space-y-1.5 ml-3 border-l-2 border-border pl-3">
                {charge.tierBreakdown
                  .filter(shouldShowBreakdownRow)
                  .map((row) => (
                    <BreakdownRow
                      key={`${charge.lineItemId}-${row.tierLabel}-${row.units}-${row.subtotal}-${row.rowFormat ?? "x"}`}
                      row={row}
                    />
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
          roastEnabled && !roastLoading
            ? "border-warning/50 bg-warning/5 text-warning hover:bg-warning/10"
            : "border-border bg-gray-50 text-muted opacity-50 cursor-not-allowed"
        }`}
        disabled={!roastEnabled || roastLoading}
        onClick={handleRoast}
      >
        {roastLoading ? "Analyzing your pricing..." : "🔥 Roast my pricing"}
      </button>
      {!roastEnabled && !roastText && (
        <p className="text-xs text-muted text-center mt-1">
          Available after 15+ events with 2+ event types
        </p>
      )}

      <AnimatePresence mode="wait">
        {roastText && !roastLoading && (
          <motion.div
            key="roast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3"
          >
            <p className="text-sm italic text-foreground leading-relaxed">
              &ldquo;{roastText}&rdquo;
            </p>
            <p className="mt-1.5 text-xs text-muted">— Claude, pricing critic</p>
          </motion.div>
        )}
        {roastError && !roastLoading && (
          <motion.div
            key="roast-error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="mt-4 rounded-lg border border-border bg-gray-50 px-4 py-3"
          >
            <p className="text-sm text-muted">{roastError}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
