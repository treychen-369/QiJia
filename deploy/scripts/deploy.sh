#!/bin/bash
# ============================================
# QiJia Finance System - 首次安装/全新部署脚本
# ============================================
# 使用方式：
#   ./deploy/scripts/deploy.sh [环境] [选项]
#
# 环境参数：
#   dev   - 开发环境
#   prod  - 生产环境（HTTPS，默认）
#   http  - HTTP 模式（无 SSL）
#
# 选项：
#   --clean       清理所有容器和数据卷（危险！）
#   --keep-data   保留已有数据卷
#   --force       跳过确认提示
#   --help        显示帮助信息
#
# ⚠️ 重要提示：
#   此脚本用于首次安装或全新部署
#   如果只需要更新应用代码，请使用 update.sh
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
    echo "用法: ./deploy/scripts/deploy.sh [环境] [选项]"
    echo ""
    echo "首次安装/全新部署脚本"
    echo ""
    echo "环境参数:"
    echo "  dev         开发环境（暴露端口，无 Nginx）"
    echo "  prod        生产环境（HTTPS，默认）"
    echo "  http        HTTP 模式（无 SSL，适合内网/测试）"
    echo ""
    echo "选项:"
    echo "  --clean       清理所有容器和数据卷（⚠️ 会删除所有数据！）"
    echo "  --keep-data   保留已有数据卷（增量安装）"
    echo "  --force       跳过确认提示"
    echo "  --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy/scripts/deploy.sh prod              # 首次生产环境部署"
    echo "  ./deploy/scripts/deploy.sh http --keep-data  # HTTP 模式，保留数据"
    echo ""
    echo "⚠️  如果只需要更新代码，请使用:"
    echo "  ./deploy/scripts/update.sh"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 默认参数
ENV="prod"
CLEAN_MODE=false
KEEP_DATA=false
FORCE_MODE=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|prod|http)
            ENV="$1"
            shift
            ;;
        --clean)
            CLEAN_MODE=true
            shift
            ;;
        --keep-data)
            KEEP_DATA=true
            shift
            ;;
        --force)
            FORCE_MODE=true
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
log_info "QiJia Finance System - 首次安装部署"
log_info "=========================================="
log_info "环境: $ENV"
log_info "项目目录: $PROJECT_ROOT"
log_info "时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "=========================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 docker-compose 是否安装（支持新版 docker compose 和旧版 docker-compose）
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

# 检测已有的数据容器
check_existing_data() {
    local has_data=false
    
    # 检查 PostgreSQL 数据卷
    if docker volume ls | grep -q "finance-postgres-data"; then
        has_data=true
        log_warn "检测到已存在的 PostgreSQL 数据卷"
    fi
    
    # 检查 Redis 数据卷
    if docker volume ls | grep -q "finance-redis-data"; then
        has_data=true
        log_warn "检测到已存在的 Redis 数据卷"
    fi
    
    # 检查运行中的容器
    if docker ps --format '{{.Names}}' | grep -qE "^finance-(postgres|redis)$"; then
        has_data=true
        log_warn "检测到运行中的数据容器"
    fi
    
    echo "$has_data"
}

# 根据环境选择配置
# 使用 --project-directory 确保 context 路径正确解析
COMPOSE_PROJECT_DIR="--project-directory $PROJECT_ROOT"

case $ENV in
    dev)
        log_info "使用开发环境配置"
        COMPOSE_FILES="$COMPOSE_PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.dev.yml"
        ENV_FILE="deploy/env/.env.dev"
        ;;
    prod)
        log_info "使用生产环境配置 (HTTPS)"
        COMPOSE_FILES="$COMPOSE_PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.prod.yml"
        ENV_FILE="deploy/env/.env.prod"
        ;;
    http)
        log_info "使用 HTTP 模式配置 (无 SSL)"
        COMPOSE_FILES="$COMPOSE_PROJECT_DIR -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.http.yml"
        ENV_FILE="deploy/env/.env.prod"
        ;;
    *)
        log_error "未知环境: $ENV"
        exit 1
        ;;
esac

# 检查环境变量文件
if [ -f "$ENV_FILE" ]; then
    log_info "加载环境变量: $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    log_warn "环境变量文件不存在: $ENV_FILE"
    log_info "请复制模板文件并配置："
    log_info "  cp deploy/env/.env.$ENV.example $ENV_FILE"
    
    if [ "$FORCE_MODE" = false ]; then
        exit 1
    fi
fi

# 检查已有数据
HAS_EXISTING_DATA=$(check_existing_data)

if [ "$HAS_EXISTING_DATA" = "true" ]; then
    echo ""
    log_warn "=========================================="
    log_warn "⚠️  检测到已有的部署数据"
    log_warn "=========================================="
    echo ""
    
    if [ "$CLEAN_MODE" = true ]; then
        log_warn "你选择了 --clean 模式，将清除所有数据！"
        if [ "$FORCE_MODE" = false ]; then
            read -p "确定要删除所有数据吗？(输入 DELETE 确认): " CONFIRM
            if [ "$CONFIRM" != "DELETE" ]; then
                log_info "已取消操作"
                exit 0
            fi
        fi
    elif [ "$KEEP_DATA" = true ]; then
        log_info "你选择了 --keep-data 模式，将保留已有数据"
    else
        log_info "建议选项:"
        log_info "  1. 使用 update.sh 仅更新应用（推荐）"
        log_info "  2. 使用 --keep-data 保留数据重新部署"
        log_info "  3. 使用 --clean 全新安装（删除所有数据）"
        echo ""
        
        if [ "$FORCE_MODE" = false ]; then
            read -p "选择操作 (1/2/3): " CHOICE
            case $CHOICE in
                1)
                    log_info "切换到更新模式..."
                    exec "$SCRIPT_DIR/update.sh"
                    ;;
                2)
                    KEEP_DATA=true
                    log_info "保留数据，继续部署..."
                    ;;
                3)
                    CLEAN_MODE=true
                    read -p "确定要删除所有数据吗？(输入 DELETE 确认): " CONFIRM
                    if [ "$CONFIRM" != "DELETE" ]; then
                        log_info "已取消操作"
                        exit 0
                    fi
                    ;;
                *)
                    log_info "已取消操作"
                    exit 0
                    ;;
            esac
        fi
    fi
fi

# 执行清理（如果选择）
if [ "$CLEAN_MODE" = true ]; then
    log_step "清理所有容器和数据..."
    $DOCKER_COMPOSE $COMPOSE_FILES down -v --remove-orphans 2>/dev/null || true
    docker volume rm finance-postgres-data finance-redis-data 2>/dev/null || true
    log_success "清理完成"
elif [ "$KEEP_DATA" = true ]; then
    log_step "停止容器（保留数据卷）..."
    $DOCKER_COMPOSE $COMPOSE_FILES down --remove-orphans 2>/dev/null || true
else
    log_step "停止旧容器..."
    $DOCKER_COMPOSE $COMPOSE_FILES down --remove-orphans 2>/dev/null || true
fi

# 构建镜像
log_step "构建 Docker 镜像..."
$DOCKER_COMPOSE $COMPOSE_FILES build --no-cache

# 启动容器
log_step "启动容器..."
$DOCKER_COMPOSE $COMPOSE_FILES up -d

# 等待数据库就绪
log_step "等待数据库就绪..."
for i in {1..30}; do
    if docker exec finance-postgres pg_isready -U ${POSTGRES_USER:-finance_user} > /dev/null 2>&1; then
        log_success "数据库已就绪"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# 运行数据库迁移（如果是新安装）
if [ "$CLEAN_MODE" = true ] || [ "$HAS_EXISTING_DATA" = "false" ]; then
    log_step "运行数据库迁移..."
    docker exec finance-app npx prisma migrate deploy 2>/dev/null || {
        log_warn "迁移可能已执行或无需迁移"
    }
fi

# 等待应用启动
log_step "等待应用启动..."
sleep 5

# 健康检查
log_step "执行健康检查..."
HEALTH_CHECK_PASSED=false
for i in {1..10}; do
    if curl -sf http://localhost/health > /dev/null 2>&1 || \
       curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        HEALTH_CHECK_PASSED=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$HEALTH_CHECK_PASSED" = true ]; then
    log_success "健康检查通过"
else
    log_warn "健康检查超时"
    log_info "查看日志: $DOCKER_COMPOSE $COMPOSE_FILES logs"
fi

# 显示容器状态
echo ""
log_info "容器状态："
$DOCKER_COMPOSE $COMPOSE_FILES ps

log_success "=========================================="
log_success "✅ 部署完成！"
log_success "=========================================="

# 显示访问地址
case $ENV in
    dev)
        log_info "开发环境访问地址: http://localhost:3000"
        ;;
    prod)
        log_info "生产环境访问地址: https://your-domain.example.com"
        ;;
    http)
        log_info "HTTP 模式访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
        ;;
esac

echo ""
log_info "=========================================="
log_info "📋 后续操作指南"
log_info "=========================================="
log_info "日常更新代码:  ./deploy/scripts/update.sh"
log_info "备份数据库:    ./deploy/scripts/backup.sh"
log_info "恢复数据库:    ./deploy/scripts/restore.sh --list"
log_info "查看日志:      docker logs -f finance-app"
log_info "健康检查:      ./deploy/scripts/health-check.sh"
