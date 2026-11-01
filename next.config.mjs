/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    agentUpgrade: 'security',
  },
  outputFileTracingIncludes: {
    '/**': ['./prisma/dev.db', './prisma/schema.prisma'],
  },
}

export default nextConfig

