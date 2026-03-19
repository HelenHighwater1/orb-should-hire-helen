"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { EventStream } from "@/components/EventStream";
import { LiveInvoice } from "@/components/LiveInvoice";
import { PlanBuilder } from "@/components/PlanBuilder";
import { ALL_PRESETS, DEFAULT_PLAN } from "@/data/presets";
import { panelContainerVariants, panelItemVariants } from "@/lib/animation";
import { calculateInvoice } from "@/lib/calculateInvoice";
import { generateEvent, generateSpike } from "@/lib/eventGenerator";
import type { Invoice, Plan, PricingModelType, UsageEvent } from "@/types/billing";

function clonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan)) as Plan;
}

function getPlanModelType(plan: Plan): PricingModelType {
  return (plan.lineItems[0]?.pricingModel.type ?? "tiered") as PricingModelType;
}

function getEventTypes(plan: Plan): Set<string> {
  return new Set(plan.lineItems.map((item) => item.eventType));
}

function getMostActiveCustomer(events: UsageEvent[]): string | undefined {
  if (events.length === 0) {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.customerId, (counts.get(event.customerId) ?? 0) + event.quantity);
  }

  let mostActive = events[0].customerId;
  let highestCount = counts.get(mostActive) ?? 0;

  for (const [customerId, count] of counts.entries()) {
    if (count > highestCount) {
      highestCount = count;
      mostActive = customerId;
    }
  }

  return mostActive;
}

function invoiceSignature(invoice: Invoice): string {
  const parts = invoice.lineItemCharges.map(
    (c) =>
      `${c.lineItemId}:${c.charge}:${c.unitsConsumed}:${c.crossedTierAt ?? ""}`,
  );
  return `${parts.join("|")}|${invoice.total}|${invoice.subtotal}|${invoice.baseFee}`;
}

type MobileTab = "plan" | "events" | "invoice";

function MobileTabBar({
  mobileTab,
  onTabChange,
  eventsUnreadDot,
  invoiceBriefPulse,
}: {
  mobileTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  eventsUnreadDot: boolean;
  invoiceBriefPulse: boolean;
}) {
  const tabBtn = (tab: MobileTab, label: ReactNode) => (
    <button
      type="button"
      onClick={() => onTabChange(tab)}
      className={`relative flex flex-1 items-center justify-center gap-1 px-1 py-3 text-xs font-semibold transition-colors sm:text-sm ${
        mobileTab === tab
          ? "bg-accent text-white"
          : "text-muted hover:bg-accent/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-[100] flex border-b border-border bg-white shadow-sm md:hidden"
      aria-label="Panel navigation"
    >
      {tabBtn("plan", "Plan")}
      {tabBtn(
        "events",
        <span className="relative inline-flex items-center">
          Events
          {eventsUnreadDot && (
            <span
              className="absolute -right-2.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
              aria-hidden
            />
          )}
        </span>,
      )}
      {tabBtn(
        "invoice",
        <span
          className={invoiceBriefPulse ? "invoice-tab-brief-pulse" : undefined}
        >
          Invoice
        </span>,
      )}
    </nav>
  );
}

export function Sandbox() {
  const SELECTED_CUSTOMER_EVENT_WEIGHT = 0.5;
  const [plan, setPlan] = useState<Plan>(() => clonePlan(DEFAULT_PLAN));
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const previousInvoicesRef = useRef<Record<string, Invoice | undefined>>({});
  const planRef = useRef<Plan>(plan);
  const selectedCustomerIdRef = useRef<string>(selectedCustomerId);

  const [mobileTab, setMobileTab] = useState<MobileTab>("events");
  const [eventsUnreadDot, setEventsUnreadDot] = useState(false);
  const [invoiceBriefPulse, setInvoiceBriefPulse] = useState(false);
  const prevEventsLengthRef = useRef(0);
  const invoiceSigRef = useRef("");

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomerId;
  }, [selectedCustomerId]);

  useEffect(() => {
    const firstEvent = generateEvent(planRef.current);
    setEvents([firstEvent]);
    setSelectedCustomerId(firstEvent.customerId);

    const intervalId = setInterval(() => {
      setEvents((currentEvents) => [
        ...currentEvents,
        generateEvent(planRef.current, {
          preferredCustomerId: selectedCustomerIdRef.current,
          preferredWeight: SELECTED_CUSTOMER_EVENT_WEIGHT,
        }),
      ]);
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const customerIds = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.customerId)));
  }, [events]);

  useEffect(() => {
    if (customerIds.length === 0) {
      setSelectedCustomerId("");
      return;
    }

    if (!selectedCustomerId || !customerIds.includes(selectedCustomerId)) {
      setSelectedCustomerId(getMostActiveCustomer(events) ?? customerIds[0]);
    }
  }, [customerIds, events, selectedCustomerId]);

  const invoice = useMemo(() => {
    if (!selectedCustomerId) {
      return calculateInvoice([], plan, {
        customerId: "",
        previousInvoice: undefined,
      });
    }

    /* eslint-disable react-hooks/refs -- previous invoice snapshot for tier-cross detection; updated in same memo pass */
    const previousForCustomer = previousInvoicesRef.current[selectedCustomerId];
    const nextInvoice = calculateInvoice(events, plan, {
      customerId: selectedCustomerId,
      previousInvoice: previousForCustomer,
    });
    previousInvoicesRef.current[selectedCustomerId] = nextInvoice;
    /* eslint-enable react-hooks/refs */
    return nextInvoice;
  }, [events, plan, selectedCustomerId]);

  const currentModelType = getPlanModelType(plan);

  /** New events while not on Events tab → notification dot */
  useEffect(() => {
    const len = events.length;
    if (len > prevEventsLengthRef.current && mobileTab !== "events") {
      setEventsUnreadDot(true);
    }
    prevEventsLengthRef.current = len;
  }, [events.length, mobileTab]);

  /** Invoice update while not on Invoice tab → brief pulse on Invoice tab */
  useEffect(() => {
    const sig = invoiceSignature(invoice);
    const prev = invoiceSigRef.current;
    if (prev !== "" && sig !== prev && mobileTab !== "invoice") {
      setInvoiceBriefPulse(true);
      const t = window.setTimeout(() => setInvoiceBriefPulse(false), 800);
      invoiceSigRef.current = sig;
      return () => window.clearTimeout(t);
    }
    invoiceSigRef.current = sig;
  }, [invoice, mobileTab]);

  function handleMobileTabChange(tab: MobileTab) {
    setMobileTab(tab);
    if (tab === "events") {
      setEventsUnreadDot(false);
    }
  }

  function resetEventsForNewPlan(nextPlan: Plan) {
    const currentTypes = getEventTypes(plan);
    const nextTypes = getEventTypes(nextPlan);
    const typesChanged =
      currentTypes.size !== nextTypes.size ||
      [...currentTypes].some((t) => !nextTypes.has(t));

    if (typesChanged) {
      previousInvoicesRef.current = {};
      const seed = generateEvent(nextPlan);
      setEvents([seed]);
      setSelectedCustomerId(seed.customerId);
    }
  }

  function handleModelPresetChange(modelType: PricingModelType) {
    const nextPreset = ALL_PRESETS.find(
      (preset) => preset.lineItems[0]?.pricingModel.type === modelType,
    );
    if (nextPreset) {
      const cloned = clonePlan(nextPreset);
      resetEventsForNewPlan(cloned);
      setPlan(cloned);
    }
  }

  function handlePlanChange(nextPlan: Plan) {
    resetEventsForNewPlan(nextPlan);
    setPlan(nextPlan);
  }

  function handleFireEvent() {
    setEvents((currentEvents) => [
      ...currentEvents,
      generateEvent(planRef.current, {
        preferredCustomerId: selectedCustomerIdRef.current,
        preferredWeight: SELECTED_CUSTOMER_EVENT_WEIGHT,
      }),
    ]);
  }

  function handleSimulateSpike() {
    setEvents((currentEvents) => [
      ...currentEvents,
      ...generateSpike(planRef.current, undefined, {
        preferredCustomerId: selectedCustomerIdRef.current,
        preferredWeight: SELECTED_CUSTOMER_EVENT_WEIGHT,
      }),
    ]);
  }

  function handleNewBillingPeriod() {
    setEvents([]);
    previousInvoicesRef.current = {};
  }

  const panelVisibility = (tab: MobileTab) =>
    mobileTab === tab ? "flex flex-1 min-h-0 flex-col" : "hidden";

  return (
    <>
      {portalReady &&
        createPortal(
          <MobileTabBar
            mobileTab={mobileTab}
            onTabChange={handleMobileTabChange}
            eventsUnreadDot={eventsUnreadDot}
            invoiceBriefPulse={invoiceBriefPulse}
          />,
          document.body,
        )}
      <motion.div
        className="contents"
        variants={panelContainerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={panelItemVariants}
          className={`min-h-0 ${panelVisibility("plan")} md:flex md:flex-col`}
        >
          <PlanBuilder
            plan={plan}
            selectedModelType={currentModelType}
            onModelPresetChange={handleModelPresetChange}
            onPlanChange={handlePlanChange}
          />
        </motion.div>
        <motion.div
          variants={panelItemVariants}
          className={`min-h-0 ${panelVisibility("events")} md:flex md:flex-col`}
        >
          <EventStream
            events={events}
            lineItems={plan.lineItems}
            onFireEvent={handleFireEvent}
            onSimulateSpike={handleSimulateSpike}
            onNewBillingPeriod={handleNewBillingPeriod}
          />
        </motion.div>
        <motion.div
          variants={panelItemVariants}
          className={`min-h-0 ${panelVisibility("invoice")} md:flex md:flex-col`}
        >
          <LiveInvoice
            plan={plan}
            invoice={invoice}
            customerIds={customerIds}
            selectedCustomerId={selectedCustomerId}
            onCustomerChange={setSelectedCustomerId}
            events={events}
          />
        </motion.div>
      </motion.div>
    </>
  );
}
