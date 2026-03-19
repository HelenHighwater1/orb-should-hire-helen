import type { Transition, Variants } from "framer-motion";

// ─── Timing Constants ────────────────────────────────────────────────────────

export const PANEL_STAGGER_DELAY = 0.15;
export const PANEL_ENTER_DURATION = 0.4;

export const EVENT_CARD_ENTER: Transition = {
  type: "spring",
  damping: 22,
  stiffness: 300,
};
export const EVENT_CARD_EXIT: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const NUMBER_CHANGE_DURATION = 0.3;

export const TIER_CROSS_FLASH_DURATION = 0.6;

export const SPIKE_STAGGER_DELAY = 0.05;

export const MAX_VISIBLE_EVENTS = 50;

// ─── Panel Load-In ──────────────────────────────────────────────────────────

export const panelContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: PANEL_STAGGER_DELAY,
    },
  },
};

export const panelItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: PANEL_ENTER_DURATION, ease: "easeOut" },
  },
};

// ─── Event Card ─────────────────────────────────────────────────────────────

export const eventCardVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: EVENT_CARD_ENTER,
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: EVENT_CARD_EXIT,
  },
};

// ─── Tier Crossing ──────────────────────────────────────────────────────────

export const tierCrossFlash: Variants = {
  idle: { backgroundColor: "rgba(109, 40, 217, 0)" },
  flash: {
    backgroundColor: [
      "rgba(109, 40, 217, 0.15)",
      "rgba(109, 40, 217, 0)",
    ],
    transition: { duration: TIER_CROSS_FLASH_DURATION },
  },
};

export const tierBadgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 15, stiffness: 400 },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.2 },
  },
};

// ─── Number Highlight ───────────────────────────────────────────────────────

export const numberHighlightVariants: Variants = {
  idle: { backgroundColor: "rgba(237, 233, 254, 0)" },
  highlight: {
    backgroundColor: [
      "rgba(237, 233, 254, 1)",
      "rgba(237, 233, 254, 0)",
    ],
    transition: { duration: 0.5 },
  },
};
