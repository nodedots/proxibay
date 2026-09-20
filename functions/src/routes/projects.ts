import { Router } from 'express'
import { Timestamp, FieldValue, getFirestore } from 'firebase-admin/firestore'
import { AuthedRequest, err } from '../auth.js'
import { Project, ProjectStatus } from '../types.js'

const ALLOWED_STATUS: ProjectStatus[] = ['active', 'paused', 'archived']

export const projectsRouter = Router()

/** POST /v1/projects — name only required, status starts "active". */
projectsRouter.post('/', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const { name, description, stackTags, repoUrl, liveUrl, environment, notes } = req.body ?? {}
  if (typeof name !== 'string' || !name.trim()) {
    return err(res, 400, 'invalid_argument', 'Project "name" is required.')
  }
  const db = getFirestore()
  const ref = db.collection('projects').doc()
  const now = Timestamp.now()
  const project: Project = {
    id: ref.id,
    ownerId: uid,
    name: name.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  if (description !== undefined) project.description = description
  if (stackTags !== undefined) project.stackTags = stackTags
  if (repoUrl !== undefined) project.repoUrl = repoUrl
  if (liveUrl !== undefined) project.liveUrl = liveUrl
  if (environment !== undefined) project.environment = environment
  if (notes !== undefined) project.notes = notes
  await ref.set(project)
  return res.status(201).json({ project })
})

/** GET /v1/projects — enriched list for Portfolio cards (avoids N+1 reads). */
projectsRouter.get('/', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const statusFilter = req.query.status as string | undefined
  const db = getFirestore()
  let q = db.collection('projects').where('ownerId', '==', uid)
  if (statusFilter && ALLOWED_STATUS.includes(statusFilter as ProjectStatus)) {
    q = q.where('status', '==', statusFilter) as typeof q
  }
  const snap = await q.get()
  const projects = await Promise.all(
    snap.docs.map(async (d) => {
      const project = d.data() as Project
      const conns = await d.ref.collection('connectors').get()
      const connectorStatuses = conns.docs.map((c) => (c.data() as { status: string }).status)
      // Latest key metric per (metricType,key): newest bucket's aggregate.last
      const buckets = await db
        .collection('metrics')
        .where('projectId', '==', project.id)
        .orderBy('date', 'desc')
        .limit(25)
        .get()
      const seen = new Set<string>()
      const keyMetrics: Array<{ metricType: string; key: string; value: number; at: string }> = []
      for (const b of buckets.docs) {
        const data = b.data() as { metricType: string; key: string; date: string; dailyAggregate?: { last?: number } }
        const k = `${data.metricType}/${data.key}`
        if (seen.has(k) || data.dailyAggregate?.last === undefined) continue
        seen.add(k)
        keyMetrics.push({ metricType: data.metricType, key: data.key, value: data.dailyAggregate.last, at: data.date })
        if (keyMetrics.length >= 3) break
      }
      const homeStatus =
        connectorStatuses.includes('error') ? 'amber'
        : connectorStatuses.includes('pending') ? 'gray'
        : connectorStatuses.length > 0 ? 'green'
        : 'gray' // D10: no connector = neutral gray, distinct from healthy green
      return { project, connectorStatuses, keyMetrics, homeStatus }
    }),
  )
  // Default sort: most-recently-updated first (alerts-first comes in Phase 2).
  projects.sort(
    (a, b) => (b.project.updatedAt?.toMillis() ?? 0) - (a.project.updatedAt?.toMillis() ?? 0),
  )
  return res.json({ projects })
})

/** PATCH /v1/projects/:projectId — inline editing, any subset; null clears. */
projectsRouter.patch('/:projectId', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const db = getFirestore()
  const ref = db.doc(`projects/${req.params.projectId}`)
  const snap = await ref.get()
  if (!snap.exists || (snap.data() as Project).ownerId !== uid) {
    return err(res, 404, 'not_found', 'Project not found.')
  }
  const allowed = ['name', 'description', 'stackTags', 'repoUrl', 'liveUrl', 'environment', 'notes', 'status'] as const
  const update: Record<string, unknown> = { updatedAt: Timestamp.now() }
  for (const field of allowed) {
    if (!(field in (req.body ?? {}))) continue
    const v = req.body[field]
    if (field === 'name' && (typeof v !== 'string' || !v.trim())) {
      return err(res, 400, 'invalid_argument', 'Project "name" must not be blank.')
    }
    if (field === 'status' && !ALLOWED_STATUS.includes(v as ProjectStatus)) {
      return err(res, 400, 'invalid_argument', 'Invalid status.')
    }
    update[field] = v === null ? FieldValue.delete() : v
  }
  await ref.update(update)
  const after = await ref.get()
  return res.json({ project: after.data() })
})

/** DELETE /v1/projects/:projectId — soft-archive per D8; ingest goes 410. */
projectsRouter.delete('/:projectId', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const db = getFirestore()
  const ref = db.doc(`projects/${req.params.projectId}`)
  const snap = await ref.get()
  if (!snap.exists || (snap.data() as Project).ownerId !== uid) {
    return err(res, 404, 'not_found', 'Project not found.')
  }
  const conns = await ref.collection('connectors').get()
  const batch = db.batch()
  batch.update(ref, { status: 'archived', updatedAt: Timestamp.now() })
  for (const c of conns.docs) batch.update(c.ref, { status: 'error' })
  await batch.commit()
  return res.json({
    project: { ...(snap.data() as Project), status: 'archived' as const },
    disabledConnectors: conns.size,
    note: 'Ingest URLs now return 410 Gone.',
  })
})
