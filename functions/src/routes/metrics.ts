import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { AuthedRequest, err } from '../auth.js'
import { MetricType } from '../types.js'
import { readBuckets } from '../buckets.js'

export const metricsRouter = Router({ mergeParams: true })

/** GET /v1/projects/:projectId/metrics?metricType=&key=[&from=&to=] — max 90d. */
metricsRouter.get('/', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const { metricType, key, from, to } = req.query as Record<string, string | undefined>
  if (!metricType || !key) return err(res, 400, 'invalid_argument', '"metricType" and "key" are required.')
  const projectId = req.params.projectId as string
  const proj = await getFirestore().doc(`projects/${projectId}`).get()
  if (!proj.exists || (proj.data() as { ownerId: string }).ownerId !== uid) {
    return err(res, 404, 'not_found', 'Project not found.')
  }
  const end = to ?? new Date().toISOString().slice(0, 10)
  const start = from ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  if (Number.isNaN(days) || days < 0 || days > 90) {
    return err(res, 400, 'invalid_argument', 'Date range must span 0–90 days (YYYY-MM-DD).')
  }
  const buckets = await readBuckets(projectId, metricType as MetricType, key, start, end)
  return res.json({
    buckets: buckets.map((b) => ({
      date: b.date,
      points: b.points.map((p) => ({ time: p.time.toDate().toISOString(), value: p.value })),
      dailyAggregate: b.dailyAggregate,
    })),
  })
})
