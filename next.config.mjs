/** @type {import('next').NextConfig} */
const nextConfig = {
  // OSTEOFLOW_PROXY_SECRET doit être intégré au bundle au moment du build CI
  // (voir .github/workflows/build.yml) car l'app packagée ne reçoit jamais de
  // vraies variables d'environnement au runtime sur la machine de l'utilisateur.
  env: {
    OSTEOFLOW_PROXY_SECRET: process.env.OSTEOFLOW_PROXY_SECRET,
  },
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
  serverExternalPackages: ['better-sqlite3', 'nodemailer', 'imapflow', '@huggingface/transformers'],
  // driver.js name contains a dot which confuses Turbopack resolution
  transpilePackages: ['driver.js'],
}

export default nextConfig
