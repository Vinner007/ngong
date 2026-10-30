"use client"

import { m, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useEffect } from "react"

/**
 * A number that rolls to its new value instead of jumping. Shows the value directly when the
 * viewer prefers reduced motion. Must be rendered inside LazyMotion.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  const spring = useSpring(value, { stiffness: 90, damping: 18 })
  const rounded = useTransform(spring, (latest) => Math.round(latest))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  if (reduceMotion) return <span className={className}>{value}</span>
  return <m.span className={className}>{rounded}</m.span>
}
