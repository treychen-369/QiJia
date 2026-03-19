# ============================================
# QiJia (齐家) - Docker 多阶段构建
# ============================================
# 优化说明：
# 1. 使用国内可访问的系统字体，避免 Google Fonts 超时
# 2. 禁用 Next.js 遥测数据
# 3. 使用 node:18-slim (Debian + glibc) 兼容 Prisma
# ============================================

# ================================
# 阶段 1: 依赖安装
# ================================
FROM node:18-slim AS deps
WORKDIR /app

# 安装必要工具
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装所有依赖（包括 dev 依赖用于构建）
# 使用 --prefer-offline 优先使用缓存，加快安装速度
RUN echo "📦 开始安装依赖..." && npm ci --prefer-offline && echo "✅ 依赖安装完成"

# ================================
# 阶段 2: 构建
# ================================
FROM node:18-slim AS builder
WORKDIR /app

# 安装必要工具
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码
COPY . .

# ⚠️ 清除可能存在的旧构建缓存
RUN rm -rf .next && rm -rf node_modules/.cache

# 生成 Prisma 客户端（使用本地安装的 prisma，避免 npx 重新下载）
RUN echo "🔧 生成 Prisma 客户端..." && ./node_modules/.bin/prisma generate && echo "✅ Prisma 客户端生成完成"

# 构建 Next.js 应用
# 注意：禁用遥测 + 设置虚拟环境变量避免构建警告
ENV NEXT_TELEMETRY_DISABLED=1

# ⚠️ 重要：NEXTAUTH_URL 必须在构建时设置为生产环境的真实地址
# 因为 Next.js 会在构建时将某些配置烘焙到客户端 JavaScript 中
# 使用 ARG 允许在构建时动态传入（默认为生产环境地址）
ARG NEXTAUTH_URL_BUILD=http://localhost:3000
ENV NEXTAUTH_URL=${NEXTAUTH_URL_BUILD}

ENV NEXTAUTH_SECRET=build-time-placeholder-secret
# DATABASE_URL 占位符（构建时 Prisma 需要，运行时会被实际值覆盖）
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

# 构建 Next.js 应用
RUN echo "🏗️ 开始构建 Next.js 应用..." && npm run build && echo "✅ Next.js 构建完成"

# ================================
# 阶段 3: 运行
# ================================
FROM node:18-slim AS runner

# 安装 OpenSSL 和其他必要依赖
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制 Prisma 相关文件（运行时必需）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 复制 Prisma CLI（用于数据库迁移）
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
