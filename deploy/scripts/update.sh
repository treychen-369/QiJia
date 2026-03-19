#!/bin/bash
# ============================================
# QiJia Finance System - 日常更新脚本
# ============================================
# 使用方式：
#   ./deploy/scripts/update.sh [选项]
#
# 选项：
#   --no-backup   跳过自动备份（不推荐）
#   --force       强制重建镜像（即使没有变化）
#   --help        显示帮助信息
#
# 说明：
#   此脚本用于日常代码更新部署，只会重建和重启 App 容器
#   PostgreSQL 和 Redis 等有状态容器不受影响
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 显示帮助
show_help() {
    echo "用法: ./deploy/scripts/update.sh [选项]"
    echo ""
    echo "日常更新脚本 - 只更新 App 容器，保留数据库数据"
    echo ""
    echo "选项:"
    echo "  --no-backup   跳过自动备份（不推荐）"
    echo "  --force       强制重建镜像"
    echo "  --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy/scripts/update.sh              # 标准更新（含自动备份）"
    echo "  ./deploy/scripts/update.sh --force      # 强制重建镜像"
    echo "  ./deploy/scripts/update.sh --no-backup  # 跳过备份（快速更新）"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 解析参数
SKIP_BACKUP=false
FORCE_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE_BUILD=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 切换到项目根目录
cd "$PROJECT_ROOT"

log_info "=========================================="
log_info "QiJia Finance System - 日常更新"
log_info "项目目录: $PROJECT_ROOT"
log_info "时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "=========================================="

# 检查 docker-compose 命令（支持新版 docker compose 和旧版 docker-compose）
DOCKER_COMPOSE=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    log_error "docker-compose 未安装，请先安装 docker-compose"
    exit 1
fi
log_info "使用 Compose 命令: $DOCKER_COMPOSE"

# 检测使用的 compose 文件
detect_compose_files() {
    # 使用 --project-directory 确保 context 路径正确解析
    local PROJECT_DIR="--project-directory $PROJECT_ROOT"
    
    # 检查哪个环境配置正在使用
    if docker ps --format '{{.Names}}' | grep -q "finance-nginx"; then
        # 检查 nginx 配置判断是 prod 还是 http
        if docker exec finance-nginx cat /etc/nginx/nginx.conf 2>/dev/null | grep -q "ssl_certificate"; then
            echo "$PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.prod.yml"
        else
            echo "$PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.http.yml"
        fi
    else
        # 默认使用 http 模式
        echo "$PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.http.yml"
    fi
}

# 检查容器状态
check_container_status() {
    local container=$1
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "running"
    elif docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "stopped"
    else
        echo "not_found"
    fi
}

# 检查前置条件
log_step "1/6 检查前置条件..."

# 检查数据容器是否存在且运行
POSTGRES_STATUS=$(check_container_status "finance-postgres")
REDIS_STATUS=$(check_container_status "finance-redis")

if [ "$POSTGRES_STATUS" != "running" ]; then
    log_error "PostgreSQL 容器未运行 (状态: $POSTGRES_STATUS)"
    log_info "这似乎不是更新场景，请使用 deploy.sh 进行首次安装"
    exit 1
fi

if [ "$REDIS_STATUS" != "running" ]; then
    log_error "Redis 容器未运行 (状态: $REDIS_STATUS)"
    log_info "请先检查 Redis 容器状态或使用 deploy.sh 重新安装"
    exit 1
fi

log_success "数据容器状态正常: PostgreSQL=$POSTGRES_STATUS, Redis=$REDIS_STATUS"

# 检测 compose 配置
COMPOSE_FILES=$(detect_compose_files)
log_info "使用配置: $COMPOSE_FILES"

# 加载环境变量
ENV_FILE="deploy/env/.env.prod"
if [ -f "$ENV_FILE" ]; then
    log_info "加载环境变量: $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# 执行备份
if [ "$SKIP_BACKUP" = false ]; then
    log_step "2/6 执行数据库备份..."
    if [ -f "$SCRIPT_DIR/backup.sh" ]; then
        "$SCRIPT_DIR/backup.sh" --auto || {
            log_warn "备份失败，但继续更新"
            log_warn "建议手动执行备份: ./deploy/scripts/backup.sh"
        }
    else
        log_warn "备份脚本不存在，跳过备份"
    fi
else
    log_step "2/6 跳过备份 (--no-backup)"
fi

# 拉取最新代码（如果在 git 仓库中）
log_step "3/6 检查代码更新..."
if [ -d ".git" ]; then
    # 检查是否有未提交的更改
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        log_info "尝试拉取最新代码..."
        git pull origin $(git branch --show-current) 2>/dev/null || log_warn "无法拉取最新代码，使用本地代码"
    else
        log_warn "检测到未提交的更改，跳过代码拉取"
    fi
else
    log_info "非 Git 仓库，跳过代码更新检查"
fi

# 只重建 App 镜像
log_step "4/6 重建 App 镜像..."
if [ "$FORCE_BUILD" = true ]; then
    log_info "强制重建镜像 (--force)"
    $DOCKER_COMPOSE $COMPOSE_FILES build --no-cache app
else
    $DOCKER_COMPOSE $COMPOSE_FILES build app
fi

# 只重启 App 和 Nginx 容器
log_step "5/6 重启应用容器..."
log_info "停止旧的 App 和 Nginx 容器..."
$DOCKER_COMPOSE $COMPOSE_FILES stop app nginx 2>/dev/null || true
$DOCKER_COMPOSE $COMPOSE_FILES rm -f app nginx 2>/dev/null || true

log_info "启动新的 App 和 Nginx 容器..."
$DOCKER_COMPOSE $COMPOSE_FILES up -d app nginx

# 等待服务启动
log_step "6/6 验证部署..."
log_info "等待应用启动..."
sleep 8

# 健康检查
HEALTH_CHECK_PASSED=false
for i in {1..5}; do
    if curl -sf http://localhost/health > /dev/null 2>&1 || \
       curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        HEALTH_CHECK_PASSED=true
        break
    fi
    log_info "等待服务响应... ($i/5)"
    sleep 3
done

if [ "$HEALTH_CHECK_PASSED" = true ]; then
    log_success "健康检查通过"
else
    log_warn "健康检查超时，请检查服务日志"
    log_info "查看日志: docker logs finance-app"
fi

# 显示容器状态
echo ""
log_info "当前容器状态:"
$DOCKER_COMPOSE $COMPOSE_FILES ps

log_success "=========================================="
log_success "✅ 更新完成！"
log_success "=========================================="
log_info "- PostgreSQL 数据: 已保留 ✓"
log_info "- Redis 数据: 已保留 ✓"
log_info "- App 容器: 已更新 ✓"
echo ""
log_info "如需查看日志: docker logs -f finance-app"
