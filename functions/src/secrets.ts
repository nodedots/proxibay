import crypto from 'crypto'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Credential storage (D4): Secret Manager in prod; Firestore-backed fallback
 * (`_secrets/{name}`) when running on the emulator where Secret Manager
 * doesn't exist. credentialsRef is the secret resource name in prod, or
 * `emulator:_secrets/{name}` locally — always opaque to clients.
 */
const client = new SecretManagerServiceClient()
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

function secretName(connectorId: string, version = 'latest'): string {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'proxibay-dev'
  return `projects/${project}/secrets/proxibay-${connectorId}/versions/${version}`
}

function emulatorRef(connectorId: string): string {
  return `emulator:_secrets/proxibay-${connectorId}`
}

export async function storeSecret(connectorId: string, payload: string): Promise<string> {
  if (isEmulator) {
    const ref = emulatorRef(connectorId)
    await getFirestore().doc(`_secrets/proxibay-${connectorId}`).set({
      payload,
      updatedAt: new Date(),
    })
    return ref
  }
  const project = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'proxibay-dev'
  const parent = `projects/${project}`
  try {
    await client.createSecret({
      parent,
      secretId: `proxibay-${connectorId}`,
      secret: { replication: { automatic: {} } },
    })
  } catch (e: unknown) {
    // 6 = ALREADY_EXISTS — adding a version to the existing secret
    if (typeof e !== 'object' || (e as { code?: number }).code !== 6) throw e
  }
  const [version] = await client.addSecretVersion({
    parent: `${parent}/secrets/proxibay-${connectorId}`,
    payload: { data: Buffer.from(payload, 'utf8') },
  })
  return version.name as string
}

export async function accessSecret(credentialsRef: string): Promise<string> {
  if (credentialsRef.startsWith('emulator:')) {
    const doc = credentialsRef.slice('emulator:'.length)
    const snap = await getFirestore().doc(doc).get()
    if (!snap.exists) throw new Error(`secret not found: ${credentialsRef}`)
    return (snap.data() as { payload: string }).payload
  }
  const [version] = await client.accessSecretVersion({ name: credentialsRef })
  return (version.payload?.data as Buffer).toString('utf8')
}

/** Generates a webhook signing secret (shown once). */
export function generateSigningSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}

/** HMAC-SHA256 hex of raw body — must match X-Proxibay-Signature (timing-safe). */
export function verifySignature(rawBody: Buffer, secret: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature.trim(), 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
