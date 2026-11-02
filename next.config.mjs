/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/**': ['./prisma/dev.db', './dev.db', './prisma/migrations/**/*'],
  },
  experimental: {
    agentUpgrade: 'security',
  },
}

export default nextConfig

