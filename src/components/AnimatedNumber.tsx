"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { NUMBER_CHANGE_DURATION } from "@/lib/animation";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  format?: (value: number) => string;
};

const defaultFormat = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export function AnimatedNumber({
  value,
  className = "",
  format = defaultFormat,
}: AnimatedNumberProps) {
  const spring = useSpring(value, {
    duration: NUMBER_CHANGE_DURATION * 1000,
    bounce: 0,
  });
  const display = useTransform(spring, (latest) => format(latest));
  const prevValue = useRef(value);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    spring.set(value);
    if (prevValue.current !== value) {
      setHighlight(true);
      const timeout = setTimeout(() => setHighlight(false), 500);
      prevValue.current = value;
      return () => clearTimeout(timeout);
    }
  }, [value, spring]);

  return (
    <motion.span
      className={`inline-block rounded px-1 -mx-1 transition-colors duration-500 ${
        highlight ? "bg-accent-light" : ""
      } ${className}`}
    >
      {display}
    </motion.span>
  );
}
