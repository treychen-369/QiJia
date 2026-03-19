#!/bin/bash
# ============================================
# SSL 证书设置脚本（Let's Encrypt）
# ============================================
# 使用方式：
#   ./deploy/scripts/setup-ssl.sh [域名]
# ============================================

set -e

DOMAIN=${1:-your-domain.example.com}
EMAIL=${2:-admin@example.com}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "=========================================="
log_info "SSL 证书设置脚本"
log_info "域名: $DOMAIN"
log_info "邮箱: $EMAIL"
log_info "=========================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# 创建 certbot 目录
log_info "创建证书目录..."
mkdir -p certbot/conf certbot/www

# 检查是否已有证书
if [ -d "certbot/conf/live/$DOMAIN" ]; then
    log_warn "已存在证书，尝试续期..."
    docker run --rm \
        -v "$PROJECT_ROOT/certbot/conf:/etc/letsencrypt" \
        -v "$PROJECT_ROOT/certbot/www:/var/www/certbot" \
        certbot/certbot renew
    log_success "证书续期完成"
    exit 0
fi

# 首先启动 nginx（HTTP 模式）以便进行域名验证
log_info "启动临时 HTTP 服务..."
docker-compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.http.yml up -d nginx

sleep 5

# 申请证书
log_info "申请 Let's Encrypt 证书..."
docker run --rm \
    -v "$PROJECT_ROOT/certbot/conf:/etc/letsencrypt" \
    -v "$PROJECT_ROOT/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# 停止临时服务
docker-compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.http.yml down

log_success "=========================================="
log_success "SSL 证书申请成功！"
log_success "证书位置: certbot/conf/live/$DOMAIN/"
log_success "=========================================="
log_info "现在可以使用生产环境配置启动服务："
log_info "  ./deploy/scripts/deploy.sh prod"
