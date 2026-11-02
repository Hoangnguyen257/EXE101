/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/**': ['./prisma/dev.db', './dev.db'],
  },
  experimental: {
    agentUpgrade: 'security',
  },
}

export default nextConfig

