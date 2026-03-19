# Orb Pricing Sandbox — Project Overview

> This document is the single source of truth for the project. It exists to give any Cursor
> agent working on any part of the codebase full context on what we're building, why, and how
> the pieces fit together. Refer to it before making architectural decisions.

---

## Purpose & Audience

This is a demo app built as a supplement to a job application for the **Software Engineer,
Core Product (Early Career)** role at **Orb** (withorb.com). Orb is a usage-based billing
infrastructure company for AI and SaaS businesses.

The app demonstrates understanding of Orb's domain (usage-based billing), their architecture
(event ingestion → pricing calculation → invoice), and their values (attention to detail,
customer empathy, AI-native thinking).

**Primary user:** An Orb engineer reviewing the job application.
**Secondary user:** A general tech audience via a blog post. The app must be immediately
understandable to someone with zero billing domain knowledge.

---

## What the App Does

A single-page interactive sandbox where the user watches a fictional SaaS company's invoice
build in real time as usage events stream in. The user can change the pricing model at any
time and instantly see how the same usage produces a completely different bill.

The core loop is:
1. Define a pricing plan (how you charge)
2. Watch usage events flow in automatically
3. See the invoice recalculate live with every event

This is a toyified but architecturally faithful version of what Orb actually does.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Notifications | Sonner |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Deployment | Vercel |

Orb's confirmed internal stack includes React, TypeScript, PostgreSQL, ClickHouse, AWS,
Cursor, Claude Code, and Graphite. This app mirrors their frontend layer directly.

---

## Layout

Three-column layout. The information architecture flows left to right:
**configure → observe → invoice.**

```
┌─────────────────┬──────────────────┬─────────────────┐
│                 │                  │                  │
│  PLAN BUILDER   │  EVENT STREAM    │  LIVE INVOICE   │
│  (left)         │  (center)        │  (right)        │
│                 │                  │                  │
└─────────────────┴──────────────────┴─────────────────┘
```

A single hero sentence sits above the columns on load:
> *"You're a SaaS founder. You just launched an API. Watch what happens when customers
> start using it."*

This is the only onboarding copy. Everything else is communicated through motion and interaction.

---

## The Three Panels

### Left — Plan Builder

Where the user defines how they charge. Has two modes:

**AI Setup** (primary): A single text input — *"What does your product do?"* — with a
Generate button. Calls the Claude API and auto-populates the entire plan: company name,
pricing model, rates, tiers, and event types. After generation, a collapsible
*"Why this plan?"* section shows Claude's reasoning.

**Manual Setup** (secondary): A dropdown to select a pricing model template, followed by
editable fields for that model's parameters.

Changing any plan field instantly recalculates the invoice from existing events.
This is the most important mechanic in the app.

Default state on load: Manual Setup, Tiered model, placeholder company "WidgetCo."

### Center — Event Stream

The live heartbeat of the app. Usage events begin firing automatically on load so the page
feels alive before the user does anything. Events appear as cards in a scrolling live feed.
New cards animate in; older cards fade as they age.

Each card shows the event type, quantity, customer ID, and a human-readable label
(e.g. *"acme_corp ran 12 image generations"*) with an optional toggle to raw JSON for
technical users.

Controls:
- **Fire Event** — manually fires one event
- **Simulate Spike** — fires a rapid burst of events; the most dramatic moment in the app
- **New Billing Period** — resets all events and the invoice

### Right — Live Invoice

The emotional payoff of the app. Recalculates from scratch every time an event fires or
the plan changes. Looks and feels like a real invoice: company name, billing period,
line items with the math shown, subtotal, total.

Key behaviors:
- Numbers animate when they change so the user can see cause and effect
- Tier breakdowns are shown inline so the user can trace exactly how the bill was calculated
- Crossing a pricing tier is a special visual moment — the single most important animation
  in the app, because it makes the complexity of usage-based pricing immediately tangible
- A **"Roast my pricing"** button appears after enough events have fired. Calls Claude,
  which analyzes the plan and observed usage and returns a short opinionated critique
  displayed as a callout on the invoice

---

## Data Model

### Key principle

The invoice is always **derived**, never stored. It is recalculated from scratch by a pure
function `calculateInvoice(events, plan)` every time state changes. This mirrors Orb's
actual query-based billing architecture and keeps the logic simple and correct by design.

### Core types

```typescript
type UsageEvent = {
  id: string
  timestamp: Date
  customerId: string
  eventType: string       // maps to a LineItem in the Plan
  quantity: number
  metadata?: Record<string, string>
}

type Plan = {
  id: string
  name: string
  companyName: string
  currency: "USD"
  billingPeriod: "monthly"
  baseFee: number
  lineItems: LineItem[]
}

type LineItem = {
  id: string
  eventType: string
  displayName: string
  unit: string
  pricingModel: PricingModel
}

type PricingModel =
  | { type: "flat_per_unit"; pricePerUnit: number }
  | { type: "tiered"; tiers: Tier[] }
  | { type: "volume"; tiers: Tier[] }
  | { type: "stairstep"; tiers: Tier[] }
  | { type: "per_seat"; pricePerSeat: number }
  | {
      type: "prepaid_credits"
      creditPrice: number
      creditsPerUnit: number
      overagePricePerUnit?: number
    }
  | { type: "package"; packageSize: number; packagePrice: number; overage?: number }
  | { type: "flat_overage"; includedUnits: number; baseFee: number; overagePrice: number }

type Tier = {
  upTo: number | "infinity"
  pricePerUnit: number
  flatFee?: number        // used by stairstep
}

type Invoice = {
  customerId: string
  periodStart: Date
  periodEnd: Date
  baseFee: number
  lineItemCharges: LineItemCharge[]
  subtotal: number
  total: number
}

type LineItemCharge = {
  lineItemId: string
  displayName: string
  unit: string
  unitsConsumed: number
  pricingModel: PricingModel
  tierBreakdown?: TierBreakdown[]
  charge: number
  previousCharge?: number       // for animating the change
  crossedTierAt?: number        // unit count when tier was crossed; triggers special UI
}

type TierBreakdown = {
  tierLabel: string
  units: number
  pricePerUnit: number
  subtotal: number
}
```

---

## Pricing Models

Eight models are available in the Plan Builder. The default on load is **Tiered**.

| Model | Demo Company | Description |
|---|---|---|
| Flat per Unit | NovaCast API | Every unit costs the same rate, always |
| Tiered | WidgetCo (default) | Rate decreases at each consumption band; each tier billed at its own rate |
| Volume | PulseDB | Like tiered, but crossing a threshold reprices ALL units retroactively |
| Per Seat | TeamFlow | Fixed price per active user per month |
| Flat + Overage | MailRelay | Monthly base fee includes a quota; usage above that billed per unit |
| Package / Bundles | RenderFast | Units sold in fixed-size blocks; partial blocks round up |
| Stairstep | FormPilot | Each band is a flat fee not a rate; invoice snaps to new tier price |
| Prepaid Credits | Lumina AI | Customer buys a credit balance upfront; usage burns it down |

---

## Claude Integration

Claude is used in two places:

**1. Plan Generation (Plan Builder — AI Setup tab)**
The user describes their product in one sentence. Claude returns a complete structured
`Plan` object — pricing model, rates, tiers, company name, event types — plus a short
reasoning paragraph explaining the choices. The app uses this to fully populate the
Plan Builder and start the event stream with relevant event types.

The API route is `POST /api/generate-plan`. Claude must return valid JSON matching the
`Plan` type. The prompt must enforce strict JSON output with no markdown wrapping.

**2. Pricing Roast (Invoice panel)**
After enough events have fired, a "Roast my pricing" button appears. Claude receives the
current plan and a summary of observed usage, and returns a short opinionated one-to-two
sentence critique. Displayed as a styled callout on the invoice panel.

The API route is `POST /api/roast-plan`.

---

## Animation Philosophy

Animation is not decoration in this app — it is the primary communication mechanism.
The goal is that a user can understand cause and effect (event fires → invoice updates)
purely from watching the motion, without reading anything.

Key moments to prioritize in order of importance:
1. **Tier crossing** — the most important moment; badge appears, price updates visually, toast fires
2. **Invoice number update** — every change highlights and animates so cause and effect is clear
3. **Event card entry** — cards arrive with energy, age gracefully, exit cleanly
4. **Simulate Spike** — should feel dramatic; the most visceral moment in the app
5. **Panel load-in** — first impression; panels stagger in to establish the three-part structure

Use Framer Motion for all animations. Keep timing constants in a single config object.

---

## Build Phases

| Phase | Goal | Shippable? |
|---|---|---|
| 1 — Scaffold | Project setup, all TypeScript types defined, three-column layout shell, static panels | No |
| 2 — Engine | `calculateInvoice` pure function for all 8 models, state wiring, event auto-loop, all controls functional | Yes — functional but unpolished |
| 3 — Polish | All animations, tier-crossing moments, load sequence, visual design finalized | Yes — primary submission version |
| 4 — Claude | AI Setup tab, plan generation, "Why this plan?" reasoning panel | Yes — enhanced version |
| 5 — Roast + Ship | "Roast my pricing" button, final copy, meta tags, Vercel deploy | Yes — final version |

Do not begin Phase 3 until Phase 2's calculation logic is correct for all 8 pricing models.
Animating wrong numbers is worse than no animation.

---
 
## Decisions & Conventions
 
These are explicit decisions made during planning. Do not infer or re-decide these —
treat them as settled.
 
**Invoice scope — one customer, not aggregate**
The invoice panel always represents a single customer's bill. The event stream may contain
events from multiple fictional customers (to feel alive), but the invoice has a customer
selector and displays charges for that customer only. This mirrors how Orb actually works.
 
**Prepaid credits exhaustion — overage is billable**
When a customer's credit balance reaches zero, additional usage becomes billable immediately
at the defined overage rate. Usage is never blocked or ignored. The invoice shows two
distinct line items: credits consumed and overage charges. This is the more honest and
visually interesting behavior.
If `overagePricePerUnit` is undefined, overage is not offered: show a "credits exhausted"
warning on the invoice and do not add additional overage charges.
 
**Stairstep — flat fee only, pricePerUnit is ignored**
For stairstep models, the calculator reads only `flatFee` from the matched tier and ignores
`pricePerUnit` entirely. The `Tier` type retains `pricePerUnit` for consistency with other
tiered models, but stairstep calculators must never use it. Document this clearly in the
types file with a comment.
 
**Tier boundary convention — upTo is inclusive, shared across all tiered models**
`upTo: 1000` means units 1 through 1000 inclusive fall within that tier. The next tier
begins at 1001. This convention applies to tiered, volume, stairstep, and any other
model that uses the `Tier` type. Document this as a comment on the `Tier` type definition.
 
**flat_overage — baseFee lives in the PricingModel only**
For `flat_overage` plans, `Plan.baseFee` must always be zero. The base fee is defined
inside the `flat_overage` PricingModel object. This prevents double-counting. The invoice
calculator should only read `PricingModel.baseFee` for this model type. Document this
convention in the types file.
 
**New Billing Period — preserves the plan, resets events and invoice only**
Clicking "New Billing Period" clears the event stream and recalculates the invoice to zero.
The currently configured plan (model, rates, tiers, company name) is preserved exactly.
The user configured that plan intentionally — resetting it would be frustrating and unhelpful.
 
**AI plan guardrails — auto-correct where possible, reject only if structurally broken**
After Claude returns a plan, run it through a `validateAndSanitizePlan()` function before
applying it to state. This function should silently clamp negative or zero prices to a
minimum of zero, cap tier count at 5, and fix other recoverable issues. Only reject and
show a user-facing error if the output is structurally invalid (wrong JSON shape, missing
required fields). Never expose raw Claude errors to the user. The friendly error message
should be: *"Couldn't generate a plan for that — try describing your product differently."*
`validateAndSanitizePlan()` must be a standalone testable function, separate from the
API route.
 
**Roast trigger threshold — 15 events AND at least 2 distinct event types**
The "Roast my pricing" button only appears once the current billing period has accumulated
at least 15 events representing at least 2 different event types. A count-only threshold
would allow shallow roasts from repetitive single-event usage. Both conditions must be
met simultaneously.

---

## What This Demonstrates to Orb

| Their value | How this app shows it |
|---|---|
| Attention to detail | The math is correct, tier edge cases are handled, the invoice shows its work |
| Customer empathy | Legible to a non-technical person within seconds of landing |
| Architectural understanding | Event → calculate → invoice loop mirrors Orb's query-based billing architecture |
| Full-stack thinking | Event ingestion, calculation engine, and UI surface are all present and connected |
| AI-native thinking | Claude is used for a genuinely useful purpose; Anthropic SDK used directly |
| Product thinking | "Roast my pricing" shows awareness of real customer problems, not just engineering execution |
| Minutes matter | The app is live and interactive within seconds; no onboarding friction |
