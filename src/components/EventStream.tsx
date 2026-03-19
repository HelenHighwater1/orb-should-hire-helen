"use client";

import { AnimatePresence, motion } from "framer-motion";
import { eventCardVariants, MAX_VISIBLE_EVENTS } from "@/lib/animation";
import type { LineItem, UsageEvent } from "@/types/billing";

type EventStreamProps = {
  events: UsageEvent[];
  lineItems: LineItem[];
  onFireEvent: () => void;
  onSimulateSpike: () => void;
  onNewBillingPeriod: () => void;
};

function describeEvent(event: UsageEvent, lineItems: LineItem[]): string {
  const lineItem = lineItems.find((item) => item.eventType === event.eventType);
  const unit = lineItem?.unit ?? "unit";
  return `${event.customerId} ran ${event.quantity} ${unit}${event.quantity === 1 ? "" : "s"}`;
}

function cardOpacity(index: number, total: number): number {
  if (total <= 1) return 1;
  const normalized = index / Math.min(total - 1, MAX_VISIBLE_EVENTS);
  return Math.max(0.4, 1 - normalized * 0.6);
}

export function EventStream({
  events,
  lineItems,
  onFireEvent,
  onSimulateSpike,
  onNewBillingPeriod,
}: EventStreamProps) {
  const orderedEvents = [...events]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_VISIBLE_EVENTS);

  return (
    <section className="flex flex-col rounded-xl border border-border bg-white shadow-sm p-5 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Event Stream
        </h2>
        <span className="text-xs text-muted font-mono">{events.length} events</span>
      </div>

      <div className="mb-4 flex flex-nowrap gap-1 md:gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 shrink truncate rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-accent/90 md:px-3 md:py-1.5 md:text-sm"
          onClick={onFireEvent}
        >
          Fire Event
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 shrink truncate rounded-lg bg-accent/10 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20 md:px-3 md:py-1.5 md:text-sm"
          onClick={onSimulateSpike}
        >
          Simulate Spike
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 shrink truncate rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-gray-50 md:px-3 md:py-1.5 md:text-sm"
          onClick={onNewBillingPeriod}
        >
          New Period
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false} mode="popLayout">
          {orderedEvents.map((evt, index) => (
            <motion.div
              key={evt.id}
              layout
              variants={eventCardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ opacity: cardOpacity(index, orderedEvents.length) }}
              className="rounded-lg border border-border px-4 py-3"
            >
              <p className="text-sm">{describeEvent(evt, lineItems)}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span className="font-mono">{evt.eventType}</span>
                <span>×{evt.quantity}</span>
                <span className="ml-auto">{evt.customerId}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {orderedEvents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted"
          >
            New billing period started. Fire events to begin building an invoice.
          </motion.div>
        )}
      </div>
    </section>
  );
}
