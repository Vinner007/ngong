import type { RoomDO } from "./room-do"

// The bindings from wrangler.jsonc (generated into cloudflare-env.d.ts), with the Durable Object
// namespace typed so RPC calls are checked, plus the secret that `wrangler types` cannot see.
export interface Env extends Omit<CloudflareEnv, "ROOM" | "ENVIRONMENT"> {
  ROOM: DurableObjectNamespace<RoomDO>
  ENVIRONMENT: string
  ANTHROPIC_API_KEY?: string
}

export function isDevelopment(env: Env): boolean {
  return env.ENVIRONMENT === "development"
}
