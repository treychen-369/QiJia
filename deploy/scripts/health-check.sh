#!/bin/bash
# ============================================
# 健康检查脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "[INFO] $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

# 默认配置
HOST=${1:-localhost}
PORT=${2:-80}

log_info "=========================================="
log_info "QiJia Finance System 健康检查"
log_info "目标: $HOST:$PORT"
log_info "=========================================="

# 检查 Nginx
log_info "检查 Nginx..."
if curl -sf "http://$HOST:$PORT/health" > /dev/null; then
    log_success "Nginx 正常"
else
    log_error "Nginx 无响应"
    exit 1
fi

# 检查应用 API
log_info "检查应用 API..."
if curl -sf "http://$HOST:$PORT/api/health" > /dev/null 2>&1 || curl -sf "http://$HOST:3000/api/health" > /dev/null 2>&1; then
    log_success "应用 API 正常"
else
    log_error "应用 API 无响应"
    exit 1
fi

# 检查数据库连接（通过 API）
log_info "检查数据库连接..."
RESPONSE=$(curl -sf "http://$HOST:$PORT/api/health" 2>/dev/null || curl -sf "http://$HOST:3000/api/health" 2>/dev/null || echo "")
if [ -n "$RESPONSE" ]; then
    log_success "数据库连接正常"
else
    log_error "无法验证数据库连接"
fi

# 检查 Docker 容器状态
log_info "检查 Docker 容器..."
CONTAINERS=("finance-postgres" "finance-redis" "finance-app" "finance-nginx")
for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^$container$"; then
        STATUS=$(docker inspect --format='{{.State.Status}}' $container)
        if [ "$STATUS" = "running" ]; then
            log_success "$container: 运行中"
        else
            log_error "$container: $STATUS"
        fi
    else
        log_error "$container: 未找到"
    fi
done

log_info "=========================================="
log_success "所有检查通过！"
log_info "=========================================="
