# 券商管理功能实现

## 📋 问题解决

### 需求
1. ✅ **添加中银国际券商** - 已添加到数据库
2. ✅ **实现自定义券商功能** - UI支持用户自定义添加

---

## 🎯 实现功能

### 1. 券商数据库扩充

#### 当前券商总数：**54个**

**按国家/地区分布**：
- 🇨🇳 **中国**: 27个券商
  - 中信证券、华泰证券、招商证券、广发证券
  - 国泰君安、海通证券、东方财富
  - **中银国际** ⭐ 新增
  - 申万宏源、兴业证券、东吴证券
  - 中金公司、光大证券、方正证券
  - 银河证券、国信证券、中泰证券
  - 东兴证券、华西证券、西南证券
  - 中原证券、国元证券、东北证券
  - 富途证券、老虎证券、Tiger Brokers
  - 长桥证券、平安证券

- 🇭🇰 **香港**: 14个券商
  - 中银国际证券、工银国际、建银国际
  - 农银国际、交银国际、招银国际
  - 华泰国际、中信证券(香港)
  - 国泰君安(香港)、海通国际
  - 盈透证券、辉立证券、尚乘证券

- 🇺🇸 **美国**: 10个券商
  - Interactive Brokers、Charles Schwab
  - TD Ameritrade、E*TRADE、Robinhood
  - Fidelity、Vanguard、Merrill Lynch
  - Morgan Stanley、Goldman Sachs

- 🇯🇵 **日本**: 3个券商
  - Nomura、Daiwa Securities、SBI Securities

---

### 2. UI功能实现

#### 新增组件：`AddBrokerDialog`
**位置**：`src/components/brokers/add-broker-dialog.tsx`

**功能**：
- ✅ 用户自定义添加券商
- ✅ 输入券商名称、代码、国家地区
- ✅ 实时验证（防止重复）
- ✅ 自动转换券商代码为大写
- ✅ 支持12个国家/地区选择

**表单字段**：
```typescript
{
  name: string;      // 券商名称（必填）
  code: string;      // 券商代码（必填，自动大写）
  country: string;   // 国家地区（必填）
}
```

**支持的国家/地区**：
- 🇨🇳 中国 (CN)
- 🇭🇰 香港 (HK)
- 🇺🇸 美国 (US)
- 🇬🇧 英国 (UK)
- 🇯🇵 日本 (JP)
- 🇸🇬 新加坡 (SG)
- 🇹🇼 台湾 (TW)
- 🇰🇷 韩国 (KR)
- 🇦🇺 澳大利亚 (AU)
- 🇨🇦 加拿大 (CA)
- 🇩🇪 德国 (DE)
- 🇫🇷 法国 (FR)

#### 修改组件：`AddAccountDialog`
**位置**：`src/components/holdings/add-account-dialog.tsx`

**新增功能**：
- ✅ 在券商选择器下方添加 **"+ 添加自定义券商"** 链接
- ✅ 点击后弹出自定义券商对话框
- ✅ 添加成功后自动刷新券商列表
- ✅ 提示用户新券商已可用

**UI改进**：
```tsx
<Select>
  {/* 券商列表 */}
</Select>

<div className="flex items-center justify-between">
  <p className="text-xs text-gray-500">
    找不到您的券商？
  </p>
  <Button variant="link" onClick={() => setShowAddBroker(true)}>
    + 添加自定义券商
  </Button>
</div>
```

---

### 3. 后端API

#### GET `/api/brokers`
**功能**：获取券商列表

**查询参数**：
- `includeInactive`: 是否包含停用的券商
- `q`: 搜索关键词（支持名称和代码）

**返回示例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "中银国际",
      "code": "BOCI",
      "country": "CN",
      "isActive": true,
      "createdAt": "2026-01-25T...",
      "_count": {
        "investmentAccounts": 3
      }
    }
  ],
  "count": 54
}
```

#### POST `/api/brokers`
**功能**：创建新券商

**请求体**：
```json
{
  "name": "华西证券",
  "code": "HUAXI",
  "country": "CN"
}
```

**验证规则**：
- `name`: 1-100字符，必填
- `code`: 1-20字符，必填，唯一
- `country`: 2位国家代码，必填

**返回示例**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "华西证券",
    "code": "HUAXI",
    "country": "CN",
    "isActive": true
  },
  "message": "券商创建成功"
}
```

**错误处理**：
- `409`: 券商名称或代码已存在
- `400`: 输入验证失败
- `401`: 未授权

---

## 📁 修改的文件

### 新建文件
1. **`src/components/brokers/add-broker-dialog.tsx`** ⭐ 核心组件
   - 自定义券商对话框
   - 表单验证和提交
   - 友好的用户提示

2. **`scripts/add-boci-broker.js`**
   - 单独添加中银国际券商
   - 可重复运行（检查已存在）

3. **`scripts/seed-more-brokers.js`** ⭐ 推荐使用
   - 批量添加36个常用券商
   - 支持中国、香港、美国、日本券商
   - 自动去重，统计报告

### 修改文件
1. **`src/components/holdings/add-account-dialog.tsx`**
   - 导入 `AddBrokerDialog` 组件
   - 添加 `showAddBroker` 状态
   - 添加 `handleBrokerAdded` 回调
   - 在券商选择器下方添加自定义按钮
   - 渲染自定义券商对话框

### 已有文件（无修改）
- `src/app/api/brokers/route.ts` - API端点已完善

---

## 🚀 使用流程

### 场景一：使用预置券商（推荐）

1. **导入券商数据**（已完成）
   ```bash
   node scripts/seed-more-brokers.js
   ```
   结果：54个券商可用

2. **创建账户**
   - 点击"添加账户"
   - 选择"券商"下拉框
   - 找到并选择"中银国际"
   - 填写其他信息
   - 点击"创建账户"

### 场景二：添加自定义券商

#### 步骤1：打开自定义券商对话框
- 在"添加账户"界面
- 点击券商选择器下方的 **"+ 添加自定义券商"** 链接

#### 步骤2：填写券商信息
```
券商名称: 华西证券
券商代码: HUAXI
国家地区: 中国 (CN)
```

#### 步骤3：提交创建
- 点击"创建券商"按钮
- 系统验证数据（检查重复）
- 创建成功后自动关闭对话框
- 券商列表自动刷新
- 新券商立即可选

#### 步骤4：使用新券商
- 在券商下拉框中选择刚创建的券商
- 继续完成账户创建

---

## 💾 数据库Schema

### Broker 表
```prisma
model Broker {
  id                String              @id @default(uuid()) @db.Uuid
  name              String              @db.VarChar(100)
  code              String              @db.VarChar(20)
  country           String              @db.Char(2)
  apiEndpoint       String?             @map("api_endpoint") @db.VarChar(255)
  apiKeyEncrypted   String?             @map("api_key_encrypted") @db.Text
  isActive          Boolean             @default(true) @map("is_active")
  createdAt         DateTime            @default(now()) @map("created_at")
  investmentAccounts InvestmentAccount[]

  @@unique([name], name: "broker_name_key")
  @@unique([code], name: "broker_code_key")
  @@map("brokers")
}
```

**重要字段**：
- `name`: 券商名称（唯一）
- `code`: 券商代码（唯一）
- `country`: 2位国家代码
- `isActive`: 是否启用

---

## ⚠️ 注意事项

### 1. 券商代码唯一性
- **问题**：券商代码必须全局唯一
- **解决**：
  - UI自动转换为大写
  - 后端验证防止重复
  - 错误提示明确

### 2. 券商名称规范
- **建议**：
  - 使用官方全称（如：中银国际）
  - 避免简称或缩写
  - 区分不同地区券商（如：中信证券 vs 中信证券(香港)）

### 3. 数据一致性
- **自定义券商限制**：
  - 不能删除已有账户的券商
  - 不能修改券商代码
  - 可以停用券商（设置 `isActive=false`）

### 4. API权限
- **当前**：任何登录用户都可创建券商
- **未来优化**：
  - 考虑添加管理员角色
  - 限制普通用户只能创建自己的自定义券商
  - 审核机制

---

## 📊 测试验证

### 1. 验证券商数据
```bash
# 查看所有券商
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.broker.findMany().then(d=>{console.log('券商总数:',d.length);d.forEach(b=>console.log('-',b.name,b.code,b.country));p.\$disconnect()});"

# 搜索中银国际
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.broker.findFirst({where:{name:'中银国际'}}).then(d=>{console.log(JSON.stringify(d,null,2));p.\$disconnect()});"
```

### 2. UI测试步骤

#### 测试1：验证预置券商
1. 访问：http://localhost:3000
2. 点击"添加持仓" → "添加账户"
3. 打开"券商"下拉框
4. 验证：能看到"中银国际"选项
5. 预期：54个券商按名称排序

#### 测试2：创建自定义券商
1. 在"添加账户"界面
2. 点击"+ 添加自定义券商"
3. 填写：
   - 券商名称：测试券商
   - 券商代码：TEST
   - 国家地区：中国
4. 点击"创建券商"
5. 预期：
   - 提示"券商已添加"
   - 券商列表自动刷新
   - 新券商出现在下拉框

#### 测试3：重复券商验证
1. 尝试创建已存在的券商（如：中银国际）
2. 预期：显示错误"券商名称已存在"

#### 测试4：券商代码验证
1. 输入小写代码：boci
2. 预期：自动转换为大写：BOCI

---

## 🎉 总结

### 已完成功能
1. ✅ **中银国际已添加** - 数据库中可用
2. ✅ **54个券商预置** - 覆盖中国、香港、美国、日本
3. ✅ **自定义券商功能** - UI支持用户添加
4. ✅ **自动刷新列表** - 添加后立即可用
5. ✅ **数据验证** - 防止重复和错误
6. ✅ **友好提示** - 完整的用户反馈

### 核心优势
- **即插即用**：预置54个常用券商
- **灵活扩展**：用户可自定义添加
- **数据安全**：唯一性约束防止重复
- **用户友好**：清晰的提示和反馈

### 下一步优化
- [ ] 添加券商Logo图标
- [ ] 支持券商信息编辑
- [ ] 添加券商管理页面
- [ ] 实现券商停用/启用功能
- [ ] 添加券商API集成（自动同步持仓）

---

**文档更新时间**: 2026-01-25  
**开发者**: AI Assistant  
**版本**: v1.0  
**券商总数**: 54个
