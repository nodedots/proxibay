import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** Rare UI's interaction curve, shared by all motion in the app. */
export const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1]

/**
 * Scroll-triggered reveal: fades up once when entering the viewport.
 * Renders a plain div when the user prefers reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Route transition: subtle fade-rise on navigation. Key by pathname where used.
 */
export function PageFade({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}
