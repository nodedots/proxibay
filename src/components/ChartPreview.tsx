import UserMetricChart, { type ChartBucket } from './UserMetricChart'

export default function ChartPreview() {
  const demoBuckets: ChartBucket[] = [
    { date: '2026-09-17', points: [{ time: '2026-09-17T10:00:00.000Z', value: 203 }, { time: '2026-09-17T18:00:00.000Z', value: 207 }] },
    { date: '2026-09-18', points: [{ time: '2026-09-18T10:00:00.000Z', value: 210 }, { time: '2026-09-18T18:00:00.000Z', value: 214 }] },
    { date: '2026-09-19', points: [{ time: '2026-09-19T10:00:00.000Z', value: 213 }, { time: '2026-09-19T18:00:00.000Z', value: 219 }] },
    { date: '2026-09-20', points: [{ time: '2026-09-20T10:00:00.000Z', value: 221 }, { time: '2026-09-20T18:00:00.000Z', value: 226 }] },
    { date: '2026-09-21', points: [{ time: '2026-09-21T10:00:00.000Z', value: 229 }, { time: '2026-09-21T18:00:00.000Z', value: 233 }] },
    { date: '2026-09-22', points: [{ time: '2026-09-22T10:00:00.000Z', value: 236 }, { time: '2026-09-22T18:00:00.000Z', value: 241 }] },
    { date: '2026-09-23', points: [{ time: '2026-09-23T10:00:00.000Z', value: 243 }, { time: '2026-09-23T18:00:00.000Z', value: 247 }] },
  ]
  const thinBuckets: ChartBucket[] = [
    { date: '2026-09-23', points: [{ time: '2026-09-23T18:00:00.000Z', value: 12 }] },
  ]
  return (
    <div className="min-h-screen bg-canvas p-6 font-inter text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">user_metrics chart — preview</h1>
          <p className="text-sm text-ink-muted">Growing data, alert marker, range animation, and the thin-data empty state.</p>
        </div>
        <section className="card">
          <div className="grid gap-4 lg:grid-cols-2">
            <UserMetricChart
              metricType="user_metrics"
              metricKey="total_users"
              buckets={demoBuckets}
              rangeHours={168}
              rules={[{ id: 'r1', projectId: 'demo', metricType: 'user_metrics', key: 'total_users', condition: 'above', threshold: 230, windowMinutes: 15, channel: 'email', channelTarget: 'you@example.com', status: 'active', lastTriggeredAt: { seconds: new Date('2026-09-21T18:00:00.000Z').getTime() / 1000, nanoseconds: 0 }, createdAt: { seconds: 0, nanoseconds: 0 } }]}
            />
            <UserMetricChart metricType="user_metrics" metricKey="signups" buckets={thinBuckets} rangeHours={168} rules={[]} />
          </div>
        </section>
      </div>
    </div>
  )
}
