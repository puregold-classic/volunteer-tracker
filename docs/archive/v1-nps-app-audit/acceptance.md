# 设计思路

**返回主文档：** [Task1-README](./README.md)

## 1. 核心设计原则

### 1.1 志愿者状态放宽
- `volunteerId` 为 "不在职" 状态时也可以提交申请和记录服务
- 更符合实际情况（离职志愿者可能补录历史服务）

### 1.2 ID生成策略
- `APP-{submitterId}-{seq}` (例: `APP-PG-0001-001`)
- `NPS-{volunteerId}-{seq}` (例: `NPS-PG-0001-001`)
- `AUDIT-{reviewerId}-{seq}` (例: `AUDIT-PG-0003-001`)
- **序号永不重置**，每个提交者/志愿者/审核员的序号独立递增

### 1.3 删除策略
- **软删除**：在 `NonProjectService` 中添加 `isActive: { type: Boolean, default: true }` 字段
- 删除申请通过后，将对应记录的 `isActive` 设为 `false`
- 所有查询默认过滤 `isActive: true` 的记录
- 数据恢复时只需将 `isActive` 改回 `true`

### 1.4 开发范围
- **单条操作优先**，批量操作后续扩展
- **验证失败**：立即返回第一个错误，停止后续验证

## 2. 技术设计实现

### 2.1 字段验证映射表

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

### 2.2 ID生成器实现

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

### 2.3 软删除查询处理

```javascript
// 在NonProjectService的查询中默认过滤
NonProjectService.find({ isActive: true, ...otherConditions });

// 如果需要查询已删除的记录（如管理后台）
NonProjectService.find({ isActive: false });
```

### 2.4 实时统计API调整

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

## 3. 验收标准清单

### 3.1 数据模型要求
- **四个Mongoose模型**：
  - `Volunteer` (已有，需补充字段)
  - `ServiceApplication` (申请缓冲区)
  - `NonProjectService` (正式服务记录，含`isActive`和`auditHistory`)
  - `AuditLog` (完整审计日志)

### 3.2 业务流程要求
- **三个核心业务流程**：
  - 申请提交（含预验证）
  - 审核处理（通过/拒绝的不同处理）
  - 数据同步与审计记录

### 3.3 技术实现要求
- **ID生成策略**：复合键（前缀-关联ID-序号）
- **数据一致性保证**：通过`AuditLog.modifiedId`建立申请、正式记录、审计的三者关联
- **错误处理**：立即返回首个错误

**返回主文档：** [Task1-README](./README.md)
