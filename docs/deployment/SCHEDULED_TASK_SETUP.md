# 定时任务设置指南

## 📅 每日快照自动化

### Windows 任务计划程序设置

#### 方法1：使用PowerShell一键设置（推荐）

```powershell
# 以管理员身份运行PowerShell，执行以下命令：

$action = New-ScheduledTaskAction -Execute "node" -Argument "scripts/create-daily-snapshots.js" -WorkingDirectory "C:\Users\yourname\project-path's finance system"

$trigger = New-ScheduledTaskTrigger -Daily -At "00:30"

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "财务系统-每日快照" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "每日凌晨0:30自动创建投资组合快照"
```

#### 方法2：手动设置

1. **打开任务计划程序**
   - 按 `Win + R`，输入 `taskschd.msc`，回车

2. **创建基本任务**
   - 右键"任务计划程序库" → "创建基本任务"
   - 名称：`财务系统-每日快照`
   - 描述：`每日凌晨自动创建投资组合快照`

3. **触发器设置**
   - 触发器：每天
   - 开始时间：00:30（凌晨0:30）
   - 重复频率：每天

4. **操作设置**
   - 操作：启动程序
   - 程序/脚本：`node`
   - 添加参数：`scripts/create-daily-snapshots.js`
   - 起始于：`C:\Users\yourname\project-path's finance system`

5. **条件设置**
   - ✅ 只有在计算机使用交流电源时才启动
   - ✅ 如果计算机切换到电池电源，停止
   - ✅ 计算机空闲 10 分钟才启动

6. **设置**
   - ✅ 如果任务失败，重新启动（最多3次）
   - ✅ 如果任务运行超过1小时，停止任务

---

## 验证定时任务

### 1. 查看已创建的任务

```powershell
Get-ScheduledTask -TaskName "财务系统-每日快照"
```

### 2. 手动运行测试

```powershell
Start-ScheduledTask -TaskName "财务系统-每日快照"
```

### 3. 查看任务历史

```powershell
Get-ScheduledTaskInfo -TaskName "财务系统-每日快照"
```

---

## 📊 监控和日志

### 查看快照创建日志

快照创建脚本会在控制台输出详细日志，包括：
- 处理的用户数量
- 每个用户的快照创建结果
- 总资产和日收益率
- 失败的详细错误信息

### 日志文件（可选）

如果需要持久化日志，可以修改任务计划程序的操作：

```powershell
# 重定向输出到日志文件
$logFile = "C:\Users\yourname\project-path's finance system\logs\snapshot-$(Get-Date -Format 'yyyyMMdd').log"

node scripts/create-daily-snapshots.js >> $logFile 2>&1
```

---

## 🔧 故障排查

### 问题1：任务未执行

**检查步骤**：
1. 确认Node.js在系统PATH中
2. 确认工作目录正确
3. 确认用户有权限执行脚本

**解决方案**：
```powershell
# 测试Node.js路径
where.exe node

# 手动运行脚本测试
cd "C:\Users\yourname\project-path's finance system"
node scripts/create-daily-snapshots.js
```

### 问题2：数据库连接失败

**检查步骤**：
1. 确认PostgreSQL服务运行中
2. 确认`.env.local`配置正确
3. 确认数据库用户权限

**解决方案**：
```powershell
# 检查PostgreSQL服务
Get-Service -Name postgresql*

# 测试数据库连接
psql -h localhost -U postgres -d finance_system -c "SELECT 1"
```

### 问题3：快照已存在（重复执行）

**说明**：脚本会自动检测今日是否已有快照，重复执行会跳过

**预期输出**：
```
⏭️  今日快照已存在，跳过
```

---

## 📈 快照数据用途

创建的快照数据用于：

1. **历史趋势图**
   - API: `GET /api/portfolio/history?days=30`
   - 显示过去N天的资产变化曲线

2. **性能指标**
   - 总收益率
   - 年化收益率
   - 波动率（Volatility）
   - 夏普比率（Sharpe Ratio）
   - 最大回撤（Max Drawdown）
   - 胜率（Win Rate）

3. **时间段对比**
   - 本周 vs 上周
   - 本月 vs 上月
   - 本年 vs 去年

---

## 🚀 扩展功能

### 添加邮件通知（可选）

修改 `scripts/create-daily-snapshots.js`，在任务完成后发送邮件：

```javascript
// 在main函数末尾添加
const nodemailer = require('nodemailer');

async function sendNotification(summary) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  await transporter.sendMail({
    from: 'Finance System <your-email@gmail.com>',
    to: 'user@example.com',
    subject: `每日快照创建完成 - ${new Date().toLocaleDateString()}`,
    text: `成功: ${summary.success}, 失败: ${summary.failed}`
  });
}
```

### 添加企业微信/钉钉通知（可选）

通过Webhook发送通知到企业微信或钉钉群：

```javascript
const axios = require('axios');

async function sendWeChatNotification(summary) {
  await axios.post('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY', {
    msgtype: 'text',
    text: {
      content: `📸 每日快照创建完成\n✅ 成功: ${summary.success}\n❌ 失败: ${summary.failed}`
    }
  });
}
```

---

## 📝 最佳实践

1. **运行时间选择**
   - 建议：每日凌晨0:30（市场闭市后）
   - 避免：交易时间段（数据可能变化）

2. **错误处理**
   - 任务失败时自动重试（最多3次）
   - 记录详细的错误日志
   - 关键错误时发送通知

3. **数据备份**
   - 定期备份 `portfolio_history` 表
   - 保留至少1年的历史数据

4. **性能优化**
   - 对于大量用户，考虑分批处理
   - 使用事务确保数据一致性

---

## 🔍 监控检查清单

- [ ] 任务计划程序中任务状态为"就绪"
- [ ] 上次运行时间正确（每日更新）
- [ ] 上次运行结果为"成功(0x0)"
- [ ] 数据库中每日都有新的快照记录
- [ ] 快照数据的总资产值合理
- [ ] 日收益率计算正确

---

## 📞 故障联系

如遇问题无法解决，请检查：
1. 系统日志：事件查看器 → Windows日志 → 应用程序
2. 任务计划程序日志：任务计划程序 → 历史记录
3. 应用日志：`logs/snapshot-YYYYMMDD.log`（如已配置）

---

**设置完成后，系统将自动每日创建投资组合快照，无需手动干预！** 🎉
