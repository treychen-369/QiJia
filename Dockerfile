# 多阶段构建 Dockerfile
# 使用 node:18-slim (Debian + glibc) 以兼容 Prisma

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
RUN npm ci

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

# 生成 Prisma 客户端（确保引擎正确）
RUN npx prisma generate

# 构建 Next.js 应用
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

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
