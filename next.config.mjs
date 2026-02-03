/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude native modules from webpack bundling (they're loaded by Node.js directly)
  serverExternalPackages: ['better-sqlite3', 'nodemailer', 'imapflow'],
}

export default nextConfig
