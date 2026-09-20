import { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'

export interface AuthedRequest extends Request {
  uid?: string
}

/** Verifies Firebase Auth ID token; attaches uid. Public paths bypass. */
export function authMiddleware(publicPaths: RegExp[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (publicPaths.some((re) => re.test(req.path))) return next()
    const header = req.header('Authorization') ?? ''
    const m = header.match(/^Bearer (.+)$/)
    if (!m) return res.status(401).json({ error: { code: 'unauthenticated', message: 'Missing Bearer ID token.' } })
    try {
      const decoded = await getAuth().verifyIdToken(m[1])
      req.uid = decoded.uid
      return next()
    } catch {
      return res.status(401).json({ error: { code: 'unauthenticated', message: 'Invalid ID token.' } })
    }
  }
}

export function err(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } })
}
