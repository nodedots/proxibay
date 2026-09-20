import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { MetricBucket, MetricType, NormalizedEvent, metricBucketId, toDateString } from './types.js'

const MAX_POINTS_PER_BUCKET = 5000

/** Appends events to their day-buckets, recomputing dailyAggregate. One read/write per bucket. */
export async function writeEventsToBuckets(events: NormalizedEvent[]): Promise<string[]> {
  const db = getFirestore()
  const byBucket = new Map<string, NormalizedEvent[]>()
  for (const e of events) {
    const id = metricBucketId(e.projectId, e.metricType, e.key, toDateString(e.timestamp.toDate()))
    const list = byBucket.get(id) ?? []
    list.push(e)
    byBucket.set(id, list)
  }
  const ids: string[] = []
  for (const [id, list] of byBucket) {
    const ref = db.doc(`metrics/${id}`)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const first = list[0]
      const existing = (snap.exists ? (snap.data() as MetricBucket) : undefined) as MetricBucket | undefined
      const points = [...(existing?.points ?? []), ...list.map((e) => ({ time: e.timestamp, value: e.value }))]
        .sort((a, b) => a.time.toMillis() - b.time.toMillis())
        .slice(-MAX_POINTS_PER_BUCKET)
      const values = points.map((p) => p.value)
      const sum = values.reduce((a, b) => a + b, 0)
      const bucket: MetricBucket = {
        projectId: first.projectId,
        metricType: first.metricType,
        key: first.key,
        date: toDateString(first.timestamp.toDate()),
        points,
        dailyAggregate: {
          sum,
          avg: values.length ? sum / values.length : undefined,
          max: values.length ? Math.max(...values) : undefined,
          min: values.length ? Math.min(...values) : undefined,
          last: values.length ? values[values.length - 1] : undefined,
        },
        updatedAt: Timestamp.now(),
      }
      tx.set(ref, bucket)
    })
    ids.push(id)
  }
  return ids
}

/** Reads day-buckets for one metric key in [from, to] (max 90d), ascending. */
export async function readBuckets(
  projectId: string,
  metricType: MetricType,
  key: string,
  from: string,
  to: string,
): Promise<MetricBucket[]> {
  const db = getFirestore()
  const snap = await db
    .collection('metrics')
    .where('projectId', '==', projectId)
    .where('metricType', '==', metricType)
    .where('key', '==', key)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .orderBy('date', 'asc')
    .get()
  return snap.docs.map((d) => d.data() as MetricBucket)
}
