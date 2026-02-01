import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude native modules from webpack bundling (they're loaded by Node.js directly)
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
