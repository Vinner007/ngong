import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Every page renders per request (the CSP nonce changes each time), so no incremental cache is needed.
export default defineCloudflareConfig({})
