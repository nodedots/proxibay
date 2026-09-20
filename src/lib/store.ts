import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { ProjectListEntry } from './contracts'
import type { ConnectorInstance, MetricType, Project } from '../types'

/**
 * Direct-Firestore data layer. The API_CONTRACT allows clients to read
 * projects/buckets directly; create/update are permitted by firestore.rules
 * (owner-scoped). Used as the offline/demo fallback when the Functions API
 * is unreachable, and useful against backends that only deploy rules.
 */

function uid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in.')
  return u.uid
}

function toEntry(project: Project, connectorStatuses: Array<'connected' | 'error' | 'pending'>, buckets: Array<{ metricType: string; key: string; date: string; dailyAggregate?: { last?: number } }>): ProjectListEntry {
  const seen = new Set<string>()
  const keyMetrics: ProjectListEntry['keyMetrics'] = []
  const sorted = [...buckets].sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const b of sorted) {
    const k = `${b.metricType}/${b.key}`
    if (seen.has(k) || b.dailyAggregate?.last === undefined) continue
    seen.add(k)
    keyMetrics.push({ metricType: b.metricType as MetricType, key: b.key, value: b.dailyAggregate.last, at: b.date })
    if (keyMetrics.length >= 3) break
  }
  const homeStatus =
    connectorStatuses.includes('error') ? 'amber'
    : connectorStatuses.includes('pending') ? 'gray'
    : connectorStatuses.length > 0 ? 'green' : 'gray'
  return { project, connectorStatuses, keyMetrics, homeStatus }
}

export async function listProjectsDirect(): Promise<ProjectListEntry[]> {
  const id = uid()
  const snap = await getDocs(query(collection(db, 'projects'), where('ownerId', '==', id)))
  const entries = await Promise.all(
    snap.docs.map(async (d) => {
      const project = { ...(d.data() as Project), id: d.id }
      try {
        const conns = await getDocs(collection(db, 'projects', d.id, 'connectors'))
        const statuses = conns.docs.map((c) => (c.data() as ConnectorInstance).status)
        // Single-field query (no composite index) + client-side sort/newest-first.
        const m = await getDocs(
          query(collection(db, 'metrics'), where('projectId', '==', d.id), limit(50)),
        )
        return toEntry(project, statuses, m.docs.map((b) => b.data() as never))
      } catch {
        return toEntry(project, [], [])
      }
    }),
  )
  entries.sort((a, b) => (b.project.updatedAt?.seconds ?? 0) - (a.project.updatedAt?.seconds ?? 0))
  return entries
}

export async function createProjectDirect(body: {
  name: string; description?: string; stackTags?: string[]; repoUrl?: string;
  liveUrl?: string; environment?: string; notes?: string;
}): Promise<Project> {
  const ref = doc(collection(db, 'projects'))
  const now = Timestamp.now()
  const project = {
    id: ref.id, ownerId: uid(), name: body.name.trim(), status: 'active',
    createdAt: now, updatedAt: now, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined && v !== '')),
  } as Project
  await setDoc(ref, project)
  return project
}

export async function patchProjectDirect(projectId: string, body: Record<string, unknown>): Promise<Project> {
  const ref = doc(db, 'projects', projectId)
  const update: Record<string, unknown> = { updatedAt: Timestamp.now() }
  for (const [k, v] of Object.entries(body)) update[k] = v === null ? deleteField() : v
  await updateDoc(ref, update)
  const { getDoc } = await import('firebase/firestore')
  return { ...((await getDoc(ref)).data() as Project), id: projectId }
}

/** Demo-grade archive: flips project status; connector disable needs the API. */
export async function archiveProjectDirect(projectId: string): Promise<void> {
  await updateDoc(doc(db, 'projects', projectId), { status: 'archived', updatedAt: Timestamp.now() })
}

export interface DirectBucket { date: string; points: Array<{ time: string; value: number }>; dailyAggregate?: { sum?: number; last?: number } }

export async function getMetricsDirect(
  projectId: string, metricType: string, key: string, from: string, to: string,
): Promise<DirectBucket[]> {
  const snap = await getDocs(
    query(
      collection(db, 'metrics'),
      where('projectId', '==', projectId),
      where('metricType', '==', metricType),
      where('key', '==', key),
      limit(100),
    ),
  );
  const rows = snap.docs.map((d) => {
    const b = d.data() as { date: string; points: Array<{ time: Timestamp; value: number }>; dailyAggregate?: { sum?: number; last?: number } }
    return {
      date: b.date,
      points: b.points.map((p) => ({ time: p.time.toDate().toISOString(), value: p.value })),
      dailyAggregate: b.dailyAggregate,
    }
  }).filter((b) => b.date >= from && b.date <= to)
  rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  return rows
}

/** Tries the Functions API first, falls back to direct Firestore reads/writes. */
export async function withFallback<T>(apiCall: () => Promise<T>, directCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall()
  } catch {
    return directCall()
  }
}
