/**
 * Netlify Function: NPS relay for standalone hives (hivecommons/hive#9619).
 *
 * Thin wrapper: all logic, security notes and operator setup live in
 * ../nps-relay/relay.ts. Routes: POST /api/nps (hives submit), and the
 * hub-only GET /api/nps/pending and POST /api/nps/ack. No public read path.
 */

import { getStore } from '@netlify/blobs'
import {
  HUB_SECRET_HASH_ENV,
  INSTALL_TOKENS_ENV,
  STORE_NAME,
  handleRelayRequest,
  type RelayStore,
} from '../nps-relay/relay'

/** The part of the Netlify function context the relay reads. */
interface RelayContext {
  ip?: string
}

export default async (req: Request, context: RelayContext): Promise<Response> => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' }) as unknown as RelayStore
  return handleRelayRequest(req, {
    store,
    env: {
      installTokens: process.env[INSTALL_TOKENS_ENV],
      hubSecretHash: process.env[HUB_SECRET_HASH_ENV],
    },
    clientIp: context.ip || req.headers.get('x-nf-client-connection-ip') || undefined,
  })
}

// Literal paths: Netlify reads this config statically. They must match
// RELAY_BASE_PATH, PENDING_PATH and ACK_PATH in ../nps-relay/relay.ts (a test
// there checks it).
export const config = {
  path: ['/api/nps', '/api/nps/pending', '/api/nps/ack'],
}
