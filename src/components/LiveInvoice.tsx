"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useIsMobile } from "@/hooks/useIsMobile";
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

function fitBandLabel(score: number): { headline: string; hue: "red" | "amber" | "green" } {
  if (score >= 65) return { headline: "Good fit", hue: "green" };
  if (score >= 36) return { headline: "Could be better", hue: "amber" };
  return { headline: "Bad fit", hue: "red" };
}

function FitScoreMeter({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const { headline, hue } = fitBandLabel(clamped);
  const hueClasses = {
    red: "from-red-600 to-red-500",
    amber: "from-amber-600 to-amber-500",
    green: "from-emerald-600 to-emerald-500",
  } as const;

  return (
    <div
      className="mb-6 rounded-xl border border-stone-200/80 bg-white/95 px-4 py-3 shadow-sm"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Pricing fit score ${clamped} out of 100, ${headline}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Pricing fit
        </span>
        <span
          className={`text-base font-bold ${
            hue === "green"
              ? "text-emerald-800"
              : hue === "amber"
                ? "text-amber-900"
                : "text-red-800"
          }`}
        >
          {headline}
        </span>
      </div>

      <div className="relative pt-1 pb-6">
        <div className="relative h-3 overflow-visible rounded-full bg-stone-200/90 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 opacity-90"
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-stone-900/25"
            style={{ left: "33.33%" }}
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-stone-900/25"
            style={{ left: "66.66%" }}
            aria-hidden
          />
          <div
            className={`absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-gradient-to-br shadow-md ${hueClasses[hue]}`}
            style={{ left: `${clamped}%` }}
            aria-hidden
          />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex text-[10px] font-medium leading-tight text-stone-500">
          <span className="w-[33.33%] text-left">Bad fit</span>
          <span className="w-[33.33%] text-center">Could be better</span>
          <span className="w-[33.33%] text-right">Good fit</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-stone-500 tabular-nums">
        Score: <span className="font-semibold text-stone-700">{clamped}</span> / 100
      </p>
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PostItIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 3h8a2 2 0 012 2v10l-4 4H8a2 2 0 01-2-2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LiveInvoice({
  plan,
  invoice,
  customerIds,
  selectedCustomerId,
  onCustomerChange,
  events,
}: LiveInvoiceProps) {
  const customerEventsForSelected = useMemo(
    () => events.filter((e) => e.customerId === selectedCustomerId),
    [events, selectedCustomerId],
  );
  const analyzeEnabled =
    Boolean(selectedCustomerId) && customerEventsForSelected.length >= 15;

  const isMobile = useIsMobile();
  const [breakdownExpanded, setBreakdownExpanded] = useState<Record<string, boolean>>({});

  const toggleBreakdown = useCallback((lineItemId: string) => {
    setBreakdownExpanded((prev) => ({
      ...prev,
      [lineItemId]: !prev[lineItemId],
    }));
  }, []);

  const [insightSummary, setInsightSummary] = useState<string | null>(null);
  const [fitScore, setFitScore] = useState<number | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [unlockPulse, setUnlockPulse] = useState(false);
  const analyzeWasEnabledRef = useRef(false);
  const insightFetchIdRef = useRef(0);

  /** Clear insights when the business / catalog or selected customer changes */
  const planResetKey = useMemo(
    () =>
      [
        plan.id,
        plan.companyName,
        plan.name,
        ...plan.lineItems.map(
          (li) =>
            `${li.id}:${li.eventType}:${li.pricingModel.type}:${li.displayName}`,
        ),
      ].join("\0"),
    [plan],
  );

  useEffect(() => {
    insightFetchIdRef.current += 1;
    setInsightSummary(null);
    setFitScore(null);
    setInsightError(null);
    setInsightLoading(false);
    setInsightModalOpen(false);
  }, [planResetKey, selectedCustomerId]);

  const dismissInsightModal = useCallback(() => {
    insightFetchIdRef.current += 1;
    setInsightModalOpen(false);
    setInsightLoading(false);
  }, []);

  useEffect(() => {
    if (!insightModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissInsightModal();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [insightModalOpen, dismissInsightModal]);

  useEffect(() => {
    if (analyzeEnabled) {
      if (!analyzeWasEnabledRef.current) {
        analyzeWasEnabledRef.current = true;
        setUnlockPulse(true);
        const id = window.setTimeout(() => setUnlockPulse(false), 900);
        return () => window.clearTimeout(id);
      }
    } else {
      analyzeWasEnabledRef.current = false;
    }
    return undefined;
  }, [analyzeEnabled]);

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

  async function handleAnalyzePlan() {
    if (!selectedCustomerId) return;

    const id = ++insightFetchIdRef.current;
    setInsightModalOpen(true);
    setInsightLoading(true);
    setInsightError(null);
    setInsightSummary(null);
    setFitScore(null);

    try {
      const res = await fetch("/api/roast-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          customerId: selectedCustomerId,
          invoiceTotal: invoice.total,
          events: events.map((e) => ({
            id: e.id,
            customerId: e.customerId,
            eventType: e.eventType,
            quantity: e.quantity,
            timestamp:
              e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
          })),
        }),
      });

      const data = (await res.json()) as {
        summary?: string;
        reflections?: string[];
        fitScore?: number;
        error?: string;
      };
      if (id !== insightFetchIdRef.current) return;

      const summaryFromApi =
        typeof data.summary === "string" && data.summary.trim().length > 0
          ? data.summary.trim()
          : Array.isArray(data.reflections) && data.reflections.length > 0
            ? data.reflections
                .filter((s): s is string => typeof s === "string")
                .map((s) => s.trim())
                .filter(Boolean)
                .join(" ")
            : "";

      if (!res.ok || data.error) {
        setInsightError(data.error ?? "Something went wrong.");
        setInsightSummary(null);
        setFitScore(null);
      } else if (
        summaryFromApi.length >= 20 &&
        typeof data.fitScore === "number" &&
        Number.isFinite(data.fitScore)
      ) {
        setInsightSummary(summaryFromApi);
        setFitScore(Math.max(0, Math.min(100, Math.round(data.fitScore))));
        setInsightError(null);
      } else {
        setInsightError("Couldn't parse insights — try again.");
        setInsightSummary(null);
        setFitScore(null);
      }
    } catch {
      if (id !== insightFetchIdRef.current) return;
      setInsightError("Couldn't reach the server — try again in a moment.");
      setInsightSummary(null);
      setFitScore(null);
    } finally {
      if (id === insightFetchIdRef.current) setInsightLoading(false);
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
              <>
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-accent md:hidden"
                  onClick={() => toggleBreakdown(charge.lineItemId)}
                  aria-expanded={Boolean(breakdownExpanded[charge.lineItemId])}
                  aria-controls={`tier-breakdown-${charge.lineItemId}`}
                  id={`tier-breakdown-toggle-${charge.lineItemId}`}
                >
                  <span>Tier breakdown</span>
                  <ChevronDownIcon
                    className={`shrink-0 transition-transform duration-200 ${
                      breakdownExpanded[charge.lineItemId] ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  id={`tier-breakdown-${charge.lineItemId}`}
                  role="region"
                  aria-labelledby={`tier-breakdown-toggle-${charge.lineItemId}`}
                  className={`mt-2 space-y-1.5 border-l-2 border-border pl-3 ml-3 ${
                    isMobile && !breakdownExpanded[charge.lineItemId]
                      ? "hidden md:block"
                      : ""
                  }`}
                >
                  {charge.tierBreakdown
                    .filter(shouldShowBreakdownRow)
                    .map((row) => (
                      <BreakdownRow
                        key={`${charge.lineItemId}-${row.tierLabel}-${row.units}-${row.subtotal}-${row.rowFormat ?? "x"}`}
                        row={row}
                      />
                    ))}
                </div>
              </>
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

      <div className="mt-5 space-y-1.5">
        <button
          type="button"
          disabled={!analyzeEnabled || insightLoading}
          onClick={handleAnalyzePlan}
          className={`relative w-full overflow-hidden rounded-xl border-0 px-4 py-3.5 text-center font-bold text-white shadow-sm transition-[filter,transform] duration-200 ${
            analyzeEnabled && !insightLoading
              ? `bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] ${unlockPulse ? "analyze-plan-unlock-pulse" : ""}`
              : "cursor-not-allowed bg-gradient-to-br from-gray-300 to-gray-400 text-gray-100 opacity-90"
          }`}
        >
          Analyze My Plan
        </button>
        {!analyzeEnabled && (
          <p className="text-xs text-muted text-center">
            Keep the events flowing to unlock insights
          </p>
        )}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {insightModalOpen && (
              <motion.div
                key="insight-modal-root"
                role="presentation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
                onClick={dismissInsightModal}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="insight-modal-title"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[min(85vh,620px)] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200/70 bg-stone-50 shadow-xl"
                >
                  <div className="border-b border-stone-200/60 bg-stone-100/50 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <PostItIcon className="mt-0.5 shrink-0 text-orange-700/90" />
                        <div>
                          <p
                            id="insight-modal-title"
                            className="text-xs font-bold uppercase tracking-wider text-orange-800/90"
                          >
                            Plan fit
                          </p>
                          <p className="mt-1 text-sm text-stone-600">
                            {plan.companyName}
                            <span className="text-muted"> · </span>
                            <span className="font-mono text-xs">{selectedCustomerId}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={dismissInsightModal}
                        className="shrink-0 rounded-lg border border-stone-200/80 bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-5">
                    {insightLoading ? (
                      <div
                        className="flex flex-col items-center justify-center gap-4 py-10"
                        aria-live="polite"
                      >
                        <p className="text-sm font-medium text-stone-600">
                          Cookin&apos; up your take…
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="insight-loading-dot" />
                          <span className="insight-loading-dot" />
                          <span className="insight-loading-dot" />
                        </div>
                      </div>
                    ) : insightError ? (
                      <p className="text-sm leading-relaxed text-red-800/90">{insightError}</p>
                    ) : insightSummary && fitScore != null ? (
                      <>
                        <FitScoreMeter score={fitScore} />
                        <motion.p
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="mt-4 rounded-xl border border-amber-100/90 bg-white/90 px-3.5 py-3 text-sm leading-relaxed text-stone-800 shadow-sm"
                        >
                          {insightSummary}
                        </motion.p>
                      </>
                    ) : null}
                  </div>

                  {!insightLoading && (
                    <div className="border-t border-stone-200/60 bg-stone-50 px-5 py-3">
                      <button
                        type="button"
                        onClick={dismissInsightModal}
                        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105"
                      >
                        Back to invoice
                      </button>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </section>
  );
}
