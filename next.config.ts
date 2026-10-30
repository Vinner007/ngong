import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
}

export default nextConfig

// Lets `next dev` read Cloudflare bindings through Wrangler. The room Durable Object and its
// WebSockets only run under `npm run preview`.
initOpenNextCloudflareForDev()
