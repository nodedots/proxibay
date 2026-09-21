import express from 'express'
import cors from 'cors'
import { authMiddleware } from './auth.js'
import { projectsRouter } from './routes/projects.js'
import { connectorsRouter } from './routes/connectors.js'
import { metricsRouter } from './routes/metrics.js'
import { ingestRouter } from './routes/ingest.js'
import { integrationsRouter } from './routes/integrations.js'
import { stripeRouter } from './routes/stripe.js'

export function buildApp() {
  const app = express()
  app.use(cors({ origin: true }))
  app.get('/v1/health', (_req, res) => res.json({ ok: true }))

  // Ingest endpoints need the RAW body for signature verification — mount before json parser.
  app.use('/v1/ingest', express.raw({ type: 'application/json', limit: '1mb' }), ingestRouter)
  app.use('/v1/stripe', express.raw({ type: 'application/json', limit: '1mb' }), stripeRouter)

  app.use(express.json({ limit: '1mb' }))
  app.use(authMiddleware([/^\/v1\/health$/, /^\/v1\/ingest\//, /^\/v1\/stripe\//]))

  app.use('/v1/projects', projectsRouter)
  app.use('/v1/projects/:projectId/connectors', connectorsRouter)
  app.use('/v1/projects/:projectId/metrics', metricsRouter)
  app.use('/v1/integrations', integrationsRouter)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((e: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(e)
    res.status(500).json({ error: { code: 'internal', message: 'Unexpected error.' } })
  })
  return app
}
