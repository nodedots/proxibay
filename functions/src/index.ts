/**
 * Stackduck Cloud Functions — Phase 1 + Stripe revenue + Supabase users.
 * Deferred: Alerting (Phase 2+).
 */
import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import { buildApp } from './app.js'
import { firebaseFetchMetrics } from './firebaseConnector.js'
import { stripeReconcile } from './stripeConnector.js'
import { supabaseFetchMetrics } from './supabaseConnector.js'
import { externalFetchMetrics } from './externalConnectors.js'
import { writeEventsToBuckets } from './buckets.js'
import { ConnectorInstance } from './types.js'

initializeApp()
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

export const api = onRequest({ invoker: 'public' }, buildApp())

/**
 * Nightly reconciliation (D23): aggregate gauges per stripe connector.
 * Push owns per-event keys, so nothing here double-counts.
 */
export const pollStripeMetrics = onSchedule({ schedule: 'every 24 hours' }, async () => {
  const db = getFirestore()
  const projects = await db.collection('projects').where('status', 'in', ['active', 'paused']).get()
  for (const p of projects.docs) {
    const conns = await p.ref.collection('connectors').where('type', '==', 'stripe').get()
    for (const c of conns.docs) {
      const conn = c.data() as ConnectorInstance
      try {
        const events = await stripeReconcile(conn.credentialsRef, p.id, conn.id)
        await writeEventsToBuckets(events)
        await c.ref.update({ lastFetchedAt: Timestamp.now(), status: 'connected', lastError: FieldValue.delete() })
      } catch (e) {
        console.error(`stripe reconcile failed ${p.id}/${conn.id}`, e)
        await c.ref.update({ status: 'error', lastError: 'Automatic sync failed. Check the provider connection and permissions.' })
      }
    }
  }
})
/**
 * Scheduled poll (D7: every 30 min). Iterates firebase connectors on active/paused
 * projects, runs fetchMetrics(since=lastFetchedAt ?? 24h ago), buckets events.
 */
export const pollFirebaseMetrics = onSchedule({ schedule: 'every 30 minutes' }, async () => {
  const db = getFirestore()
  const projects = await db.collection('projects').where('status', 'in', ['active', 'paused']).get()
  for (const p of projects.docs) {
    const conns = await p.ref.collection('connectors').where('type', '==', 'firebase').get()
    for (const c of conns.docs) {
      const conn = c.data() as ConnectorInstance
      const since =
        conn.lastFetchedAt?.toDate() ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
      try {
        const events = await firebaseFetchMetrics(conn.credentialsRef, p.id, conn.id, since)
        await writeEventsToBuckets(events)
        await c.ref.update({ lastFetchedAt: Timestamp.now(), status: 'connected', lastError: FieldValue.delete() })
      } catch (e) {
        console.error(`poll failed ${p.id}/${conn.id}`, e)
        await c.ref.update({ status: 'error', lastError: 'Automatic sync failed. Check the provider connection and permissions.' })
      }
    }
  }
})

/**
 * Scheduled poll (D7 cadence): supabase connectors, same bucketing.
 * user_metrics only — error logs need a separate management token (D24).
 */
export const pollSupabaseMetrics = onSchedule({ schedule: 'every 30 minutes' }, async () => {
  const db = getFirestore()
  const projects = await db.collection('projects').where('status', 'in', ['active', 'paused']).get()
  for (const p of projects.docs) {
    const conns = await p.ref.collection('connectors').where('type', '==', 'supabase').get()
    for (const c of conns.docs) {
      const conn = c.data() as ConnectorInstance
      const since =
        conn.lastFetchedAt?.toDate() ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
      try {
        const events = await supabaseFetchMetrics(conn.credentialsRef, p.id, conn.id, since)
        await writeEventsToBuckets(events)
        await c.ref.update({ lastFetchedAt: Timestamp.now(), status: 'connected', lastError: FieldValue.delete() })
      } catch (e) {
        console.error(`supabase poll failed ${p.id}/${conn.id}`, e)
        await c.ref.update({ status: 'error', lastError: 'Automatic sync failed. Check the provider connection and permissions.' })
      }
    }
  }
})

/** Poll API-backed monitoring, analytics, uptime, and deployment connectors. */
export const pollExternalMetrics = onSchedule({ schedule: 'every 30 minutes' }, async () => {
  const db = getFirestore()
  const projects = await db.collection('projects').where('status', 'in', ['active', 'paused']).get()
  for (const p of projects.docs) {
    const conns = await p.ref.collection('connectors')
      .where('type', 'in', ['sentry', 'github-actions', 'posthog', 'betterstack', 'vercel']).get()
    for (const c of conns.docs) {
      const conn = c.data() as ConnectorInstance
      try {
        const events = await externalFetchMetrics(
          conn.type as 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel',
          conn.credentialsRef,
          p.id,
          conn.id,
        )
        await writeEventsToBuckets(events)
        await c.ref.update({ lastFetchedAt: Timestamp.now(), status: 'connected', lastError: FieldValue.delete() })
      } catch (e) {
        console.error(`external poll failed (${conn.type}) ${p.id}/${conn.id}`, e)
        await c.ref.update({ status: 'error', lastError: 'Automatic sync failed. Check the provider connection and permissions.' })
      }
    }
  }
})
