#!/bin/bash
# ============================================
# QiJia Finance System - 数据备份脚本
# ============================================
# 使用方式：
#   ./deploy/scripts/backup.sh [选项]
#
# 选项：
#   --auto        自动模式（更新脚本调用，不提示）
#   --output DIR  指定备份目录
#   --db-only     只备份数据库
#   --help        显示帮助信息
#
# 说明：
#   备份 PostgreSQL 数据库和 Redis 数据
#   默认保留最近 7 天的备份
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 显示帮助
show_help() {
    echo "用法: ./deploy/scripts/backup.sh [选项]"
    echo ""
    echo "数据备份脚本 - 备份 PostgreSQL 和 Redis 数据"
    echo ""
    echo "选项:"
    echo "  --auto        自动模式（跳过确认提示）"
    echo "  --output DIR  指定备份目录（默认: ./backups/db）"
    echo "  --db-only     只备份数据库"
    echo "  --keep N      保留最近 N 天的备份（默认: 7）"
    echo "  --help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy/scripts/backup.sh                  # 交互式备份"
    echo "  ./deploy/scripts/backup.sh --auto           # 自动备份"
    echo "  ./deploy/scripts/backup.sh --output /data   # 指定备份目录"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 默认参数
AUTO_MODE=false
BACKUP_DIR="$PROJECT_ROOT/backups/db"
DB_ONLY=false
KEEP_DAYS=7

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto)
            AUTO_MODE=true
            shift
            ;;
        --output)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --db-only)
            DB_ONLY=true
            shift
            ;;
        --keep)
            KEEP_DAYS="$2"
            shift 2
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

# 生成备份文件名
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DATE_TAG=$(date '+%Y-%m-%d')

log_info "=========================================="
log_info "QiJia Finance System - 数据备份"
log_info "时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "备份目录: $BACKUP_DIR"
log_info "=========================================="

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查 PostgreSQL 容器
if ! docker ps --format '{{.Names}}' | grep -q "finance-postgres"; then
    log_error "PostgreSQL 容器未运行"
    exit 1
fi

# 加载环境变量获取数据库信息
ENV_FILE="deploy/env/.env.prod"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -E '^(POSTGRES_USER|POSTGRES_DB)=' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-finance_user}
POSTGRES_DB=${POSTGRES_DB:-finance_system}

# 备份 PostgreSQL
log_info "正在备份 PostgreSQL..."
PG_BACKUP_FILE="$BACKUP_DIR/postgres_${TIMESTAMP}.sql"
PG_BACKUP_FILE_GZ="${PG_BACKUP_FILE}.gz"

docker exec finance-postgres pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    > "$PG_BACKUP_FILE"

# 压缩备份文件
gzip -f "$PG_BACKUP_FILE"
PG_SIZE=$(du -h "$PG_BACKUP_FILE_GZ" | cut -f1)
log_success "PostgreSQL 备份完成: $PG_BACKUP_FILE_GZ ($PG_SIZE)"

# 备份 Redis（如果不是 db-only 模式）
if [ "$DB_ONLY" = false ]; then
    if docker ps --format '{{.Names}}' | grep -q "finance-redis"; then
        log_info "正在备份 Redis..."
        REDIS_BACKUP_FILE="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
        
        # 触发 Redis BGSAVE
        docker exec finance-redis redis-cli BGSAVE > /dev/null 2>&1 || true
        sleep 2
        
        # 复制 RDB 文件
        docker cp finance-redis:/data/dump.rdb "$REDIS_BACKUP_FILE" 2>/dev/null || {
            log_warn "Redis 备份失败（可能没有数据）"
            REDIS_BACKUP_FILE=""
        }
        
        if [ -n "$REDIS_BACKUP_FILE" ] && [ -f "$REDIS_BACKUP_FILE" ]; then
            gzip -f "$REDIS_BACKUP_FILE"
            REDIS_SIZE=$(du -h "${REDIS_BACKUP_FILE}.gz" | cut -f1)
            log_success "Redis 备份完成: ${REDIS_BACKUP_FILE}.gz ($REDIS_SIZE)"
        fi
    else
        log_warn "Redis 容器未运行，跳过 Redis 备份"
    fi
fi

# 创建备份清单
MANIFEST_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.manifest"
cat > "$MANIFEST_FILE" << EOF
# Backup Manifest
# Created: $(date '+%Y-%m-%d %H:%M:%S')
# System: QiJia Finance System

TIMESTAMP=$TIMESTAMP
DATE=$DATE_TAG
POSTGRES_BACKUP=$PG_BACKUP_FILE_GZ
POSTGRES_SIZE=$PG_SIZE
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
EOF

if [ -f "${REDIS_BACKUP_FILE}.gz" ] 2>/dev/null; then
    echo "REDIS_BACKUP=${REDIS_BACKUP_FILE}.gz" >> "$MANIFEST_FILE"
    echo "REDIS_SIZE=$REDIS_SIZE" >> "$MANIFEST_FILE"
fi

log_success "备份清单: $MANIFEST_FILE"

# 清理旧备份
log_info "清理超过 $KEEP_DAYS 天的旧备份..."
find "$BACKUP_DIR" -name "postgres_*.sql.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "redis_*.rdb.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "backup_*.manifest" -mtime +$KEEP_DAYS -delete 2>/dev/null || true

# 统计当前备份
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

log_success "=========================================="
log_success "✅ 备份完成！"
log_success "=========================================="
log_info "备份目录: $BACKUP_DIR"
log_info "备份数量: $BACKUP_COUNT 个"
log_info "总大小: $TOTAL_SIZE"
echo ""
log_info "恢复命令: ./deploy/scripts/restore.sh $PG_BACKUP_FILE_GZ"
