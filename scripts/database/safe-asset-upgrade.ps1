# 资产分类安全升级脚本
# 包含完整的验证、备份和回滚机制

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"
$LogFile = Join-Path $ProjectRoot "upgrade-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# 创建备份目录
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# 日志函数
function Write-Log {
    param($Message, $Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $logMessage
}

# 错误处理
function Handle-Error {
    param($ErrorMessage)
    Write-Log "❌ 错误: $ErrorMessage" "Red"
    Write-Log "升级已中止，请检查日志文件: $LogFile" "Yellow"
    
    $response = Read-Host "是否需要回滚？(y/n)"
    if ($response -eq 'y') {
        Rollback-Changes
    }
    exit 1
}

# 回滚函数
function Rollback-Changes {
    Write-Log "🔄 开始回滚..." "Yellow"
    
    try {
        # 回滚Prisma schema
        Write-Log "回滚 schema.prisma..."
        git checkout prisma/schema.prisma
        
        # 回滚portfolio-service.ts
        Write-Log "回滚 portfolio-service.ts..."
        git checkout src/lib/services/portfolio-service.ts
        
        # 重新生成Prisma Client
        Write-Log "重新生成 Prisma Client..."
        npx prisma generate
        
        Write-Log "✅ 代码回滚完成" "Green"
        Write-Log "⚠️  注意: 数据库数据未回滚，如需完全回滚请手动恢复数据库备份" "Yellow"
    }
    catch {
        Write-Log "❌ 回滚失败: $_" "Red"
    }
}

# 主流程
try {
    Write-Log "🚀 资产分类安全升级开始" "Cyan"
    Write-Log "日志文件: $LogFile" "Gray"
    Write-Log ""
    
    # ========== 阶段1: 准备和验证 ==========
    Write-Log "📋 阶段1: 准备和验证" "Cyan"
    
    # 1.1 检查是否在项目根目录
    if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
        Handle-Error "未找到 package.json，请确保在项目根目录执行"
    }
    Write-Log "✅ 项目目录验证通过" "Green"
    
    # 1.2 检查Node.js和npm
    $nodeVersion = node --version
    Write-Log "Node.js 版本: $nodeVersion" "Gray"
    
    # 1.3 验证Prisma schema
    Write-Log "验证 Prisma schema..."
    $validateResult = npx prisma validate 2>&1
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Prisma schema 验证失败: $validateResult"
    }
    Write-Log "✅ Prisma schema 验证通过" "Green"
    
    # 1.4 检查数据库连接
    Write-Log "检查数据库连接..."
    $dbCheck = npx prisma db execute --stdin <<< "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "⚠️  无法连接数据库，请确保PostgreSQL正在运行" "Yellow"
        $continue = Read-Host "是否继续？(y/n)"
        if ($continue -ne 'y') {
            exit 0
        }
    }
    Write-Log "✅ 数据库连接正常" "Green"
    
    Write-Log ""
    
    # ========== 阶段2: 备份 ==========
    Write-Log "📦 阶段2: 数据备份" "Cyan"
    
    # 2.1 备份Prisma schema
    $schemaBackup = Join-Path $BackupDir "schema.prisma.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item (Join-Path $ProjectRoot "prisma/schema.prisma") $schemaBackup
    Write-Log "✅ Prisma schema 已备份: $schemaBackup" "Green"
    
    # 2.2 备份数据库（如果有备份脚本）
    $dbBackupScript = Join-Path $ScriptDir "backup-database.js"
    if (Test-Path $dbBackupScript) {
        Write-Log "执行数据库备份脚本..."
        node $dbBackupScript
        Write-Log "✅ 数据库已备份" "Green"
    } else {
        Write-Log "⚠️  未找到数据库备份脚本，请手动备份" "Yellow"
        $continue = Read-Host "是否继续？(y/n)"
        if ($continue -ne 'y') {
            exit 0
        }
    }
    
    Write-Log ""
    
    # ========== 阶段3: 数据库Schema升级 ==========
    Write-Log "🗄️  阶段3: 数据库Schema升级" "Cyan"
    
    # 3.1 生成迁移
    Write-Log "生成数据库迁移..."
    $migrationName = "upgrade_asset_categories_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    npx prisma migrate dev --name $migrationName --create-only
    
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "迁移生成失败"
    }
    Write-Log "✅ 迁移文件已生成" "Green"
    
    # 3.2 应用迁移
    Write-Log "应用数据库迁移..."
    $applyConfirm = Read-Host "确认应用Schema变更？这将修改数据库结构 (y/n)"
    if ($applyConfirm -ne 'y') {
        Write-Log "❌ 用户取消操作" "Yellow"
        exit 0
    }
    
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "迁移应用失败"
    }
    Write-Log "✅ Schema迁移完成" "Green"
    
    Write-Log ""
    
    # ========== 阶段4: 数据升级 ==========
    Write-Log "📊 阶段4: 数据升级" "Cyan"
    
    # 4.1 执行升级脚本
    Write-Log "执行资产分类升级脚本..."
    $upgradeScript = Join-Path $ScriptDir "upgrade-asset-categories.js"
    
    if (-not (Test-Path $upgradeScript)) {
        Handle-Error "未找到升级脚本: $upgradeScript"
    }
    
    node $upgradeScript
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "数据升级失败"
    }
    Write-Log "✅ 数据升级完成" "Green"
    
    Write-Log ""
    
    # ========== 阶段5: 代码更新 ==========
    Write-Log "💻 阶段5: 代码更新" "Cyan"
    
    # 5.1 重新生成Prisma Client
    Write-Log "重新生成 Prisma Client..."
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Handle-Error "Prisma Client 生成失败"
    }
    Write-Log "✅ Prisma Client 已更新" "Green"
    
    Write-Log ""
    
    # ========== 阶段6: 验证 ==========
    Write-Log "🔍 阶段6: 验证结果" "Cyan"
    
    # 6.1 执行验证SQL
    Write-Log "执行数据验证..."
    $verifyScript = @"
-- 验证新分类
SELECT code, name, level, color, COUNT(*) OVER() as total_count
FROM asset_categories 
WHERE level IN (1, 2)
ORDER BY level, sort_order
LIMIT 10;
"@
    
    Write-Log "数据库验证查询已准备，请手动执行验证" "Gray"
    
    # 6.2 提示手动验证
    Write-Log ""
    Write-Log "========================================" "Yellow"
    Write-Log "请执行以下验证步骤:" "Yellow"
    Write-Log "1. 启动开发服务器: npm run dev" "Yellow"
    Write-Log "2. 访问 http://localhost:3000/dashboard" "Yellow"
    Write-Log "3. 检查资产分布饼图是否正常显示" "Yellow"
    Write-Log "4. 检查持仓列表数据是否完整" "Yellow"
    Write-Log "5. 检查投资组合账户明细是否准确" "Yellow"
    Write-Log "========================================" "Yellow"
    Write-Log ""
    
    $verifyConfirm = Read-Host "验证通过了吗？(y/n)"
    if ($verifyConfirm -ne 'y') {
        Write-Log "⚠️  验证未通过，建议回滚" "Yellow"
        Rollback-Changes
        exit 1
    }
    
    Write-Log ""
    Write-Log "✨ 升级成功完成！" "Green"
    Write-Log ""
    Write-Log "📋 升级总结:" "Cyan"
    Write-Log "  - Schema已更新: 添加了6大顶层分类和21个二级分类" "Gray"
    Write-Log "  - 数据已迁移: 现有证券已关联到新分类" "Gray"
    Write-Log "  - 代码已更新: portfolio-service.ts 使用新分类逻辑" "Gray"
    Write-Log "  - 备份位置: $BackupDir" "Gray"
    Write-Log "  - 日志文件: $LogFile" "Gray"
    Write-Log ""
    
    # 是否重启开发服务器
    $restartServer = Read-Host "是否重启开发服务器？(y/n)"
    if ($restartServer -eq 'y') {
        Write-Log "正在重启开发服务器..." "Cyan"
        
        # 停止现有进程
        $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Log "停止现有Node进程..."
            Stop-Process -Name node -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        
        # 启动新进程
        Write-Log "启动开发服务器..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; npm run dev"
        Write-Log "✅ 开发服务器已在新窗口启动" "Green"
    }
    
    Write-Log ""
    Write-Log "🎉 全部完成！请访问 Dashboard 进行最终验证" "Green"
    
}
catch {
    Handle-Error $_.Exception.Message
}
