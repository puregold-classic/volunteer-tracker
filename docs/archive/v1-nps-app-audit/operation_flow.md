# 业务流程

**返回主文档：** [Task1-README](./README.md)

## 1. 审计链路说明

```
APP-2024-001 (申请) → NPS-2024-001 (正式记录) → AUDIT-2024-001 (审计记录)
       ↓                        ↓                          ↓
   提交人信息                  审核历史                   审核人信息
```

## 2. 业务流程分解

### 2.1 用户提交申请流程
```
用户界面 → 填写表单 → 提交申请 → 等待审核
API需求：创建申请、验证数据、返回申请ID
```

### 2.2 管理员审核流程
```
审核列表 → 查看申请详情 → 审核操作 → 结果通知
API需求：查询申请、审核操作、状态更新
```

### 2.3 数据同步流程
```
审核通过 → 写入正式库 → 更新统计 → 清理缓冲区
API需求：数据写入、统计更新、清理操作
```

## 3. 核心流程示例（以 update 为例）

**场景**：用户 PG-0001 想更新自己之前的服务记录 `NPS-PG-0001-001` 的时长。

### 3.1 用户提交更新申请 (`POST /api/v1/applications`)

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

### 3.2 系统预验证
- 检查 `targetId` 是否存在且 `isActive: true`
- 检查 `volunteerId` 是否存在（无论状态）
- 检查 `from` 值是否与当前记录中的值匹配
- 检查 `to` 值是否符合业务规则（0.5倍数）

### 3.3 创建申请记录 (`ServiceApplication`)
- 生成 `applicationId`: `APP-PG-0001-002`
- 状态: `pending`

### 3.4 管理员审核 (`POST /api/v1/reviews/APP-PG-0001-002`)

```json
{
  "result": "approved",  // 或 "rejected"
  "notes": "同意延长服务时长"
}
```

### 3.5 审核通过后处理
- 更新 `ServiceApplication.status = "approved"`
- 更新 `NonProjectService.duration = 4.0`
- 在 `NonProjectService.auditHistory` 中追加审核记录
- 创建 `AuditLog`：
  - `auditId`: `AUDIT-PG-0003-001`
  - `targetId`: `APP-PG-0001-002`
  - `modifiedId`: `NPS-PG-0001-001` (指向被修改的正式记录)
  - `changes`: 同上

### 3.6 审核拒绝后处理
- 更新 `ServiceApplication.status = "rejected"`
- **不修改** `NonProjectService` 记录
- 创建 `AuditLog`：
  - `modifiedId`: `NPS-PG-0001-001` (仍指向原本的记录)
  - `actionDetails.reviewResult`: "rejected"

## 4. 审核后处理逻辑矩阵

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

**返回主文档：** [Task1-README](./README.md)
