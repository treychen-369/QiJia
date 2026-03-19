#!/bin/bash
# ============================================
# QiJia Finance System - 数据恢复脚本
# ============================================
# 使用方式：
#   ./deploy/scripts/restore.sh <备份文件>
#   ./deploy/scripts/restore.sh --list
#
# 选项：
#   --list        列出所有可用备份
#   --force       跳过确认提示
#   --help        显示帮助信息
#
# 说明：
#   从备份文件恢复 PostgreSQL 数据库
#   ⚠️ 警告：恢复操作会覆盖当前数据库数据
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 显示帮助
show_help() {
    echo "用法: ./deploy/scripts/restore.sh <备份文件|选项>"
    echo ""
    echo "数据恢复脚本 - 从备份恢复 PostgreSQL 数据库"
    echo ""
    echo "选项:"
    echo "  --list        列出所有可用备份"
    echo "  --latest      恢复最新备份"
    echo "  --force       跳过确认提示"
    echo "  --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy/scripts/restore.sh --list"
    echo "  ./deploy/scripts/restore.sh backups/db/postgres_20260205_120000.sql.gz"
    echo "  ./deploy/scripts/restore.sh --latest"
    echo "  ./deploy/scripts/restore.sh --latest --force"
    echo ""
    echo "⚠️  警告：恢复操作会覆盖当前数据库中的数据！"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups/db"

# 默认参数
FORCE_MODE=false
LIST_MODE=false
LATEST_MODE=false
BACKUP_FILE=""

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            LIST_MODE=true
            shift
            ;;
        --latest)
            LATEST_MODE=true
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
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 列出备份模式
if [ "$LIST_MODE" = true ]; then
    log_info "可用的 PostgreSQL 备份:"
    echo ""
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | while read line; do
            echo "  $line"
        done
        echo ""
        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | wc -l)
        log_info "共 $BACKUP_COUNT 个备份"
    else
        log_warn "备份目录不存在: $BACKUP_DIR"
    fi
    exit 0
fi

# 最新备份模式
if [ "$LATEST_MODE" = true ]; then
    if [ -d "$BACKUP_DIR" ]; then
        BACKUP_FILE=$(ls -t "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | head -1)
        if [ -z "$BACKUP_FILE" ]; then
            log_error "没有找到备份文件"
            exit 1
        fi
        log_info "选择最新备份: $BACKUP_FILE"
    else
        log_error "备份目录不存在: $BACKUP_DIR"
        exit 1
    fi
fi

# 检查是否指定了备份文件
if [ -z "$BACKUP_FILE" ]; then
    log_error "请指定备份文件或使用 --latest"
    show_help
    exit 1
fi

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    # 尝试在备份目录中查找
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
fi

log_info "=========================================="
log_info "QiJia Finance System - 数据恢复"
log_info "时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "备份文件: $BACKUP_FILE"
log_info "=========================================="

# 检查 PostgreSQL 容器
if ! docker ps --format '{{.Names}}' | grep -q "finance-postgres"; then
    log_error "PostgreSQL 容器未运行"
    log_info "请先启动容器: docker-compose up -d postgres"
    exit 1
fi

# 加载环境变量
ENV_FILE="deploy/env/.env.prod"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -E '^(POSTGRES_USER|POSTGRES_DB)=' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-finance_user}
POSTGRES_DB=${POSTGRES_DB:-finance_system}

# 显示备份信息
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
BACKUP_DATE=$(stat -c %y "$BACKUP_FILE" 2>/dev/null | cut -d' ' -f1 || stat -f %Sm "$BACKUP_FILE" 2>/dev/null)

log_info "备份大小: $BACKUP_SIZE"
log_info "备份日期: $BACKUP_DATE"
log_info "目标数据库: $POSTGRES_DB"

# 确认恢复
if [ "$FORCE_MODE" = false ]; then
    echo ""
    log_warn "⚠️  警告：此操作将覆盖当前数据库中的所有数据！"
    echo ""
    read -p "确定要继续恢复吗？(输入 yes 确认): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "已取消恢复操作"
        exit 0
    fi
fi

# 恢复前备份当前数据
log_info "恢复前先备份当前数据..."
CURRENT_BACKUP="$BACKUP_DIR/pre_restore_$(date '+%Y%m%d_%H%M%S').sql.gz"
docker exec finance-postgres pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-privileges \
    2>/dev/null | gzip > "$CURRENT_BACKUP"
log_success "当前数据已备份: $CURRENT_BACKUP"

# 解压备份文件（如果是 .gz）
RESTORE_FILE="$BACKUP_FILE"
TEMP_FILE=""

if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "解压备份文件..."
    TEMP_FILE="/tmp/restore_$(date '+%Y%m%d_%H%M%S').sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
fi

# 执行恢复
log_info "正在恢复数据库..."

# 停止应用以避免连接冲突
log_info "暂停应用服务..."
docker stop finance-app 2>/dev/null || true

# 恢复数据
cat "$RESTORE_FILE" | docker exec -i finance-postgres psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --quiet \
    2>&1 | grep -v "^SET$" | grep -v "^COMMENT$" || true

# 重启应用
log_info "重启应用服务..."
docker start finance-app 2>/dev/null || true

# 清理临时文件
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

# 验证恢复
log_info "验证数据库..."
TABLE_COUNT=$(docker exec finance-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

log_success "=========================================="
log_success "✅ 数据恢复完成！"
log_success "=========================================="
log_info "数据库表数量: $TABLE_COUNT"
log_info "恢复前备份: $CURRENT_BACKUP"
echo ""
log_info "如果恢复后有问题，可以回滚:"
log_info "  ./deploy/scripts/restore.sh $CURRENT_BACKUP --force"
