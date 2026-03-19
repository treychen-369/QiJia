/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 standalone 输出模式（Docker 部署必需）
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  // 禁用构建时的类型检查（加快构建，运行时检查）
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost', 'avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
    formats: ['image/webp', 'image/avif'],
  },
  // 注意：不要在这里设置 NEXTAUTH_URL，它需要在运行时从环境变量读取
  // 构建时烘焙的环境变量会导致生产环境使用错误的 URL
  env: {
    // NEXTAUTH_URL 和 NEXTAUTH_SECRET 由运行时环境变量提供，不在构建时设置
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // 启用严格模式
  reactStrictMode: true,
  // 启用SWC压缩
  swcMinify: true,
  // 性能优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 禁用构建时的 ESLint 检查（使用开发时的 ESLint）
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 注意：output: 'standalone' 与 i18n 不兼容，已移除 i18n 配置
};

module.exports = nextConfig;