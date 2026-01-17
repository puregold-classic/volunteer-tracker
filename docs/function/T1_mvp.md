好的，收到修正！思路完全清晰了。让我们基于你的修正，重新梳理和确认最终的设计思路。

## 🔄 基于修正的最终设计思路

### 1. **审核后处理逻辑（关键修正）**

**审核结果处理矩阵**：

| 申请类型 | 审核结果 | NonProjectService 处理 | AuditLog.modifiedId | 说明 |
|---------|---------|----------------------|-------------------|------|
| `create` | `approved` | **创建新记录** | 新创建的 `serviceId` | 正常通过 |
| `create` | `rejected` | **不创建** | `null` | 拒绝创建，没有对应正式记录 |
| `update` | `approved` | **更新现有记录** | 被更新的 `targetId` (`serviceId`) | 正常更新 |
| `update` | `rejected` | **不更新，但记录存在** | 原本的 `targetId` (`serviceId`) | 拒绝更新，但原记录还在 |
| `delete` | `approved` | **软删除**（`isActive: false`） | 被删除的 `targetId` (`serviceId`) | 通过删除 |
| `delete` | `rejected` | **不删除，记录存在** | 原本的 `targetId` (`serviceId`) | 拒绝删除，记录保持激活 |

**核心原则**：`AuditLog.modifiedId` 永远指向 `NonProjectService` 中**实际受影响的那个文档的ID**。如果没有文档被影响（create被拒），则为 `null`。

### 2. **志愿者状态放宽**
- `volunteerId` 为 "不在职" 状态时也可以提交申请和记录服务。
- 这更符合实际情况（离职志愿者可能补录历史服务）。

### 3. **ID生成策略**
- `APP-{submitterId}-{seq}` (例: `APP-PG-0001-001`)
- `NPS-{volunteerId}-{seq}` (例: `NPS-PG-0001-001`)
- `AUDIT-{reviewerId}-{seq}` (例: `AUDIT-PG-0003-001`)
- **序号永不重置**，每个提交者/志愿者/审核员的序号独立递增。

### 4. **删除策略**
- **软删除**：在 `NonProjectService` 中添加 `isActive: { type: Boolean, default: true }` 字段。
- 删除申请通过后，将对应记录的 `isActive` 设为 `false`。
- 所有查询默认过滤 `isActive: true` 的记录。
- 数据恢复时只需将 `isActive` 改回 `true`。

### 5. **开发范围**
- **单条操作优先**，批量操作后续扩展。
- **验证失败**：立即返回第一个错误，停止后续验证。

## 📋 最终MVP核心流程（以update为例）

**场景**：用户 PG-0001 想更新自己之前的服务记录 `NPS-PG-0001-001` 的时长。

1. **用户提交更新申请** (`POST /applications`)
```json
{
  "applicationType": "update",
  "targetType": "NonProjectService",
  "targetId": "NPS-PG-0001-001",
  "volunteerId": "PG-0001",
  "volunteerName": "张三",
  "changes": [
    { "field": "duration", "from": 3.5, "to": 4.0 }
  ]
}
```

2. **系统预验证**：
   - 检查 `targetId` 是否存在且 `isActive: true`
   - 检查 `volunteerId` 是否存在（无论状态）
   - 检查 `from` 值是否与当前记录中的值匹配
   - 检查 `to` 值是否符合业务规则（0.5倍数）

3. **创建申请记录** (`ServiceApplication`)：
   - 生成 `applicationId`: `APP-PG-0001-002`
   - 状态: `pending`

4. **管理员审核** (`POST /reviews/update/APP-PG-0001-002`)：
```json
{
  "reviewResult": "approved",  // 或 "rejected"
  "reviewNotes": "同意延长服务时长"
}
```

5. **审核通过后处理**：
   - 更新 `ServiceApplication.status = "approved"`
   - 更新 `NonProjectService.duration = 4.0`
   - 在 `NonProjectService.auditHistory` 中追加审核记录
   - 创建 `AuditLog`：
     - `auditId`: `AUDIT-PG-0003-001`
     - `targetId`: `APP-PG-0001-002`
     - `modifiedId`: `NPS-PG-0001-001` (指向被修改的正式记录)
     - `changes`: 同上

6. **审核拒绝后处理**：
   - 更新 `ServiceApplication.status = "rejected"`
   - **不修改** `NonProjectService` 记录
   - 创建 `AuditLog`：
     - `modifiedId`: `NPS-PG-0001-001` (仍指向原本的记录)
     - `actionDetails.reviewResult`: "rejected"

## 🛠️ 需要补充的技术设计点

### 1. **字段验证映射表**
```javascript
const fieldValidators = {
  serviceDate: (value) => {
    // 必须是有效日期，不能是未来日期
    const date = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return !isNaN(date) && date <= today;
  },
  serviceType: (value) => {
    return ["翻译", "校对", "项目培训", "非项目培训", "受训"].includes(value);
  },
  duration: (value) => {
    return typeof value === 'number' && value > 0 && value % 0.5 === 0;
  },
  description: (value) => {
    return typeof value === 'string' && value.trim().length >= 5;
  }
};
```

### 2. **ID生成器实现思路**
```javascript
class IDGenerator {
  static async getNextApplicationId(submitterId) {
    const lastApp = await ServiceApplication.findOne(
      { applicationId: new RegExp(`^APP-${submitterId}-`) },
      { applicationId: 1 }
    ).sort({ createdAt: -1 });
    
    const nextSeq = lastApp 
      ? parseInt(lastApp.applicationId.split('-').pop()) + 1
      : 1;
    
    return `APP-${submitterId}-${nextSeq.toString().padStart(3, '0')}`;
  }
  
  // 类似实现 getNextServiceId, getNextAuditId
}
```

### 3. **软删除的查询处理**
```javascript
// 在NonProjectService的查询中默认过滤
NonProjectService.find({ isActive: true, ...otherConditions });

// 如果需要查询已删除的记录（如管理后台）
NonProjectService.find({ isActive: false });
```

### 4. **实时统计API的调整**
由于使用软删除，统计时需要：
```javascript
const stats = await NonProjectService.aggregate([
  { $match: { 
    volunteerId: volunteerId,
    isActive: true  // 只统计活跃记录
  }},
  // ... 后续聚合
]);
```

## ✅ 最终确认清单

基于所有讨论，我们最终的MVP设计包含：

1. **四个Mongoose模型**：
   - `Volunteer` (已有，需补充字段)
   - `ServiceApplication` (申请缓冲区)
   - `NonProjectService` (正式服务记录，含`isActive`和`auditHistory`)
   - `AuditLog` (完整审计日志)

2. **三个核心业务流程**：
   - 申请提交（含预验证）
   - 审核处理（通过/拒绝的不同处理）
   - 数据同步与审计记录

3. **ID生成策略**：复合键（前缀-关联ID-序号）

4. **数据一致性保证**：通过`AuditLog.modifiedId`建立申请、正式记录、审计的三者关联

5. **错误处理**：立即返回首个错误

---

**现在可以开始具体设计了！** 

你希望我先从哪个部分开始提供具体的设计方案？
1. 完整的 **Mongoose Schema 定义**（四个模型）
2. **ID生成器**的完整实现代码
3. 第一个核心API **`POST /api/v1/applications`** 的详细Controller设计

请告诉我你的偏好，我将开始提供具体的技术设计方案。