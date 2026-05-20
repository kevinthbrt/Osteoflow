/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Skip server-side image optimization — images are served directly from
  // /_next/static/media/ which is handled by the custom Electron HTTP server.
  // The /_next/image optimization endpoint can fail in the packaged Electron app.
  images: {
    unoptimized: true,
  },
  // Exclude native modules from webpack bundling (they're loaded by Node.js directly)
  serverExternalPackages: ['better-sqlite3', 'nodemailer', 'imapflow'],
  // driver.js name contains a dot which confuses Turbopack resolution
  transpilePackages: ['driver.js'],
}

export default nextConfig
