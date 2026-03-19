#!/bin/sh
# 数据库初始化脚本

echo "=== 等待数据库就绪 ==="
until nc -z postgres 5432; do
  echo "等待 PostgreSQL..."
  sleep 2
done

echo "=== 运行数据库迁移 ==="
cd /app
./node_modules/.bin/prisma db push --accept-data-loss

echo "=== 数据库初始化完成 ==="
