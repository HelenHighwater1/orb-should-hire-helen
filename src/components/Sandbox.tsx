"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export function Sandbox() {
  const SELECTED_CUSTOMER_EVENT_WEIGHT = 0.5;
  const [plan, setPlan] = useState<Plan>(() => clonePlan(DEFAULT_PLAN));
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const previousInvoicesRef = useRef<Record<string, Invoice | undefined>>({});
  const planRef = useRef<Plan>(plan);
  const selectedCustomerIdRef = useRef<string>(selectedCustomerId);

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

    const previousForCustomer = previousInvoicesRef.current[selectedCustomerId];
    const nextInvoice = calculateInvoice(events, plan, {
      customerId: selectedCustomerId,
      previousInvoice: previousForCustomer,
    });
    previousInvoicesRef.current[selectedCustomerId] = nextInvoice;
    return nextInvoice;
  }, [events, plan, selectedCustomerId]);

  const currentModelType = getPlanModelType(plan);

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

  return (
    <motion.div
      className="contents"
      variants={panelContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={panelItemVariants} className="min-h-0">
        <PlanBuilder
          plan={plan}
          selectedModelType={currentModelType}
          onModelPresetChange={handleModelPresetChange}
          onPlanChange={handlePlanChange}
        />
      </motion.div>
      <motion.div variants={panelItemVariants} className="min-h-0">
        <EventStream
          events={events}
          lineItems={plan.lineItems}
          onFireEvent={handleFireEvent}
          onSimulateSpike={handleSimulateSpike}
          onNewBillingPeriod={handleNewBillingPeriod}
        />
      </motion.div>
      <motion.div variants={panelItemVariants} className="min-h-0">
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
  );
}
