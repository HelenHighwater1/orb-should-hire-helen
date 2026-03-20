# Pricing Sandbox Demo for Orb

I built this as a supplement to my application for the Software Engineer, Core Product
(Early Career) role at Orb. A resume tells you what I've done. This shows how I think.

The app is an interactive billing sandbox: pick a pricing model, watch usage events stream
in, and see a live invoice recalculate in real time. It covers all eight major pricing
models used in modern SaaS and AI billing: flat per unit, tiered, volume, per seat,
flat + overage, packages, stairstep, and prepaid credits. There's also a Claude-powered
plan generator that takes a one-sentence product description and builds a complete pricing
plan from scratch.

The reason it's relevant to Orb specifically: the core mechanic - ingest raw events, run a
pure calculation, produce an invoice - is a deliberate mirror of how Orb actually works
architecturally. The invoice
shows tier breakdowns, tracks crossing events, and handles edge cases like credit exhaustion
and stairstep snapping because those are the details that matter in production billing, and
attention to detail is the whole job.

Built in a day using Next.js, TypeScript, Tailwind, and Framer Motion, with the Anthropic
SDK for the AI features. Cursor did a lot of the heavy lifting on implementation - which
felt appropriate given Orb explicitly names Claude Code in the job description.

Hope you enjoy this, and feel free to check out my portfolio site [HeyImHelen.com](heyimhelen.com)!
- Helen
