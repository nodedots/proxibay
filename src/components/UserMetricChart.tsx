import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { humanKeyLabel } from '../lib/format'
import type { AlertRule, FirebaseTimestamp } from '../types'

export interface ChartBucket { date: string; points: Array<{ time: string; value: number }>; dailyAggregate?: { sum?: number; last?: number } }
interface FlatPoint { t: number; v: number }

function toMs(ts: FirebaseTimestamp | undefined): number | null { return ts ? ts.seconds * 1000 : null }
function friendlyDay(ms: number): string { return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) }
function shortTick(ms: number, rangeHours: number): string {
  const d = new Date(ms)
  if (rangeHours === 24) return d.toLocaleTimeString(undefined, { hour: 'numeric' })
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}
function useCountUp(target: number | undefined, duration = 650): number | undefined {
  const [display, setDisplay] = useState<number | undefined>(undefined)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (target === undefined) { setDisplay(undefined); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return display
}
function FriendlyTooltip(props: { active?: boolean; payload?: Array<{ payload: FlatPoint }>; noun: string }) {
  const { active, payload, noun } = props
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  return (
    <div className="font-inter rounded-lg border border-line bg-elevated px-3 py-2 text-sm" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <p className="font-medium text-ink">{pt.v.toLocaleString()} {noun} on {friendlyDay(pt.t)}</p>
    </div>
  )
}
export default function UserMetricChart(props: {
  metricType: string
  metricKey: string
  buckets: ChartBucket[]
  rangeHours: 24 | 168 | 720
  rules: AlertRule[]
}) {
  const { metricType, metricKey, buckets, rangeHours, rules } = props
  const noun = humanKeyLabel(metricKey).toLowerCase()
  const title = humanKeyLabel(metricKey)
  const rangeLabel = rangeHours === 24 ? 'last 24 hours' : rangeHours === 168 ? 'last 7 days' : 'last 30 days'
  const compareLabel = rangeHours === 24 ? 'yesterday' : 'last week'

  const points = useMemo<FlatPoint[]>(() => {
    const flat = buckets.flatMap((b) => b.points.map((p) => ({ t: new Date(p.time).getTime(), v: p.value })))
    flat.sort((a, b) => a.t - b.t)
    return flat.filter((p) => Number.isFinite(p.t))
  }, [buckets])

  const current = points.length ? points[points.length - 1].v : undefined
  const animated = useCountUp(current)

  const delta = useMemo(() => {
    if (points.length < 2 || current === undefined) return null
    const windowMs = rangeHours === 24 ? 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000
    const cutoff = points[points.length - 1].t - windowMs
    // Fall back to the earliest point when the whole range is younger than
    // the comparison window — still tells the growth story honestly.
    const baseline = [...points].reverse().find((p) => p.t <= cutoff) ?? points[0]
    const diff = current - baseline.v
    if (diff === 0) return { diff: 0, up: null as boolean | null }
    return { diff, up: diff > 0 }
  }, [points, current, rangeHours])

  const alertMarks = useMemo(() => {
    const windowStart = points.length ? points[0].t : Date.now() - rangeHours * 3600 * 1000
    return rules
      .filter((r) => r.metricType === metricType && r.key === metricKey)
      .map((r) => toMs(r.lastTriggeredAt))
      .filter((ms): ms is number => ms !== null && ms >= windowStart)
      .map((ms) => {
        let nearest = points[0]
        for (const p of points) { if (Math.abs(p.t - ms) < Math.abs(nearest.t - ms)) nearest = p }
        return { ms, point: nearest }
      })
      .filter((m) => m.point)
  }, [rules, metricType, metricKey, points, rangeHours])

  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-line p-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-ink-muted">Users</p>
        <div className="mt-3 rounded-lg bg-inset px-4 py-6 text-center">
          <p className="font-inter text-sm font-medium">Still gathering data — check back tomorrow.</p>
          <p className="mt-1 text-xs text-ink-muted">
            {points.length === 0 ? `No ${noun} in the ${rangeLabel} yet.` : 'One reading so far — the trend appears once there are a couple more.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="font-inter text-2xl font-semibold tabular-nums" aria-live="polite">
          {(animated ?? 0).toLocaleString()} <span className="text-sm font-normal text-ink-muted">{noun}</span>
        </p>
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <span>Users</span>
        {delta && delta.diff !== 0 && (
          <span className={delta.up ? 'font-medium text-[#147a5c] dark:text-mint-pulse' : 'font-medium text-coral-emphasis'} title={`Compared with ${compareLabel}`}>
            <span aria-hidden="true">{delta.up ? '▲ ' : '▼ '}</span>{delta.up ? '+' : ''}{delta.diff.toLocaleString()} {delta.up ? 'this week' : `vs ${compareLabel}`}
          </span>
        )}
        {delta && delta.diff === 0 && <span className="font-medium">steady vs {compareLabel}</span>}
      </p>
      <div key={rangeHours} className="fade-swap">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`userArea-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#86e0c1" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#86e0c1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-slate)" strokeOpacity={0.18} vertical={false} />
            <XAxis dataKey="t" tickFormatter={(t: number) => shortTick(t, rangeHours)} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)', fontFamily: 'Inter, sans-serif' }} stroke="var(--color-line)" minTickGap={48} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted)', fontFamily: 'Inter, sans-serif' }} stroke="transparent" width={44} tickLine={false} allowDecimals={false} />
            <Tooltip content={<FriendlyTooltip noun={noun} />} cursor={{ stroke: 'var(--color-slate)', strokeOpacity: 0.35 }} />
            <Area type="monotone" dataKey="v" stroke="var(--color-ink)" strokeWidth={2} fill={`url(#userArea-${metricKey})`} dot={false} activeDot={{ r: 4, fill: 'var(--color-ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} animationDuration={600} animationEasing="ease-out" />
            {alertMarks.map((m, i) => (
              <ReferenceDot key={`${m.ms}-${i}`} x={m.point.t} y={m.point.v} r={5} fill="var(--color-coral-emphasis)" stroke="var(--color-surface)" strokeWidth={2} label={{ value: '⚠', position: 'top', fontSize: 12, fill: 'var(--color-coral-emphasis)' }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {alertMarks.length > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--color-coral-emphasis)' }} aria-hidden="true" />
          Red dot marks when an alert fired — details in the Alerts feed below.
        </p>
      )}
    </div>
  )
}

