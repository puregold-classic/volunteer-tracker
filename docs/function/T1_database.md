# 服务申请与审计数据库设计文档

---

## 1. ServiceApplication（服务申请缓冲区）

```json
{
  "_id": "ObjectId",
  "applicationId": "APP-2024-001",
  "applicationType": "create",
  "targetType": "NonProjectService",
  "volunteerId": "PG-0001",
  "volunteerName": "张三",
  "changes": [
    {
      "field": "serviceDate",
      "from": null,
      "to": "2024-03-15"
    },
    {
      "field": "serviceType",
      "from": null,
      "to": "社区服务"
    },
    {
      "field": "duration",
      "from": null,
      "to": 3.5
    },
    {
      "field": "description",
      "from": null,
      "to": "为本地社区介绍经典文化"
    }
  ],
  "targetId": null,
  "submittedBy": {
    "id": "PG-0001",
    "name": "张三",
    "role": "user",
    "timestamp": "2024-03-15T14:30:00Z"
  },
  "status": "pending",
  "reviewNotes": "服务记录格式正确",
  "createdAt": "2024-03-15T14:30:00Z",
  "updatedAt": "2024-03-16T09:15:00Z",
  "expiresAt": "2024-03-22T14:30:00Z",
  "indexedStatus": "pending",
  "indexedVolunteerId": "PG-0001",
  "indexedDate": "2024-03-15"
}
```

---

## 2. NonProjectService（正式服务记录库）

```json
{
  "_id": "ObjectId",
  "serviceId": "NPS-2024-001",
  "volunteerId": "PG-0001",
  "volunteerName": "张三",
  "serviceDate": "2024-03-15",
  "serviceType": "社区服务",
  "duration": 3.5,
  "description": "为本地社区介绍经典文化",
  "auditHistory": [
    {
      "auditId": "AUDIT-2024-001",
      "auditTime": "2024-03-16T09:15:00Z",
      "auditResult": "approved",
      "reviewerId": "PG-0003",
      "reviewerName": "王五",
      "auditNote": "审核通过"
    }
  ],
  "createdAt": "2024-03-16T09:15:00Z",
  "updatedAt": "2024-03-16T09:15:00Z",
  "isActive": true
}
```

---

## 3. AuditLog（审计日志）

```json
{
  "_id": "ObjectId",
  "auditId": "AUDIT-2024-001",
  "targetType": "ServiceApplication",
  "targetId": "APP-2024-001",
  "action": "application_review",
  "actionDetails": {
    "applicationType": "create",
    "reviewResult": "approved",
    "reviewNote": "服务记录符合要求"
  },
  "modifiedId": "NPS-2024-001",
  "changes": [
    {
      "field": "serviceDate",
      "from": null,
      "to": "2024-03-15"
    },
    {
      "field": "serviceType",
      "from": null,
      "to": "社区服务"
    },
    {
      "field": "duration",
      "from": null,
      "to": 3.5
    },
    {
      "field": "description",
      "from": null,
      "to": "为本地社区介绍经典文化"
    }
  ],
  "operator": {
    "id": "PG-0003",
    "name": "王五",
    "role": "c_admin"
  },
  "submitter": {
    "id": "PG-0001",
    "name": "张三",
    "role": "user"
  },
  "timestamp": "2024-03-16T09:15:00Z",
  "indexedDate": "2024-03-16"
}
```

---

## 4. 变更模型统一格式

```json
// create: null → value
{ "field": "duration", "from": null, "to": 3.5 }

// update: value1 → value2
{ "field": "duration", "from": 2.0, "to": 3.5 }

// delete: value → null
{ "field": "duration", "from": 3.5, "to": null }
```

---

## 5. 审计链路说明

```
APP-2024-001 (申请) → NPS-2024-001 (正式记录) → AUDIT-2024-001 (审计记录)
       ↓                        ↓                          ↓
   提交人信息                  审核历史                   审核人信息
```

---

## 6. 业务流程示例

### 创建服务记录
```javascript
// 1. 用户提交申请
const createApp = {
  applicationId: "APP-2024-001",
  applicationType: "create",
  targetType: "NonProjectService",
  volunteerId: "PG-0001",
  volunteerName: "张三",
  changes: [
    { field: "duration", from: null, to: 3.5 },
    { field: "description", from: null, to: "社区服务" }
  ],
  submittedBy: { id: "PG-0001", name: "张三", role: "user" }
};

// 2. 审核通过后创建正式记录
const serviceRecord = {
  serviceId: "NPS-2024-001",
  volunteerId: "PG-0001",
  volunteerName: "张三",
  duration: 3.5,
  description: "社区服务",
  auditHistory: [{
    auditId: "AUDIT-2024-001",
    auditTime: "2024-03-16T09:15:00Z",
    auditResult: "approved",
    reviewerId: "PG-0003",
    reviewerName: "王五",
    auditNote: "审核通过"
  }],
  createdAt: "2024-03-16T09:15:00Z",
  isActive: true
};

// 3. 审计记录
const auditLog = {
  auditId: "AUDIT-2024-001",
  targetType: "ServiceApplication",
  targetId: "APP-2024-001",
  action: "application_review",
  actionDetails: {
    applicationType: "create",
    reviewResult: "approved",
    reviewNote: "服务记录符合要求"
  },
  modifiedId: "NPS-2024-001",
  changes: [/* 复制changes */],
  operator: { id: "PG-0003", name: "王五", role: "c_admin" },
  submitter: { id: "PG-0001", name: "张三", role: "user" }
};
```

### 更新服务记录
```javascript
// 1. 用户提交更新申请
const updateApp = {
  applicationId: "APP-2024-002",
  applicationType: "update",
  targetType: "NonProjectService",
  targetId: "NPS-2024-001",
  volunteerId: "PG-0001",
  changes: [
    { field: "duration", from: 3.5, to: 4.0 },
    { field: "serviceType", from: "社区服务", to: "培训指导" }
  ]
};

// 2. 审核通过后更新正式记录
// 3. 审计记录中modifiedId仍是"NPS-2024-001"
```

### 删除服务记录
```javascript
// 1. 用户提交删除申请
const deleteApp = {
  applicationId: "APP-2024-003",
  applicationType: "delete",
  targetType: "NonProjectService",
  targetId: "NPS-2024-001",
  volunteerId: "PG-0001",
  changes: [
    { field: "isActive", from: true, to: null }
  ]
};

// 2. 审核通过后（软删除）
// 3. 审计记录中modifiedId设为null
```

---

## 7. Volunteer 数据模型

```json
{
  "_id": "ObjectId",
  "id": "PG-0001",
  "chineseName": "张三",
  "englishName": "Zhang San",
  "region": "中国大陆",
  "province": "北京市",
  "subRegion": "朝阳区",
  "status": "在职",
  "activityLevel": "高",
  "services": ["翻译", "管理"],
  "nonProjectHours": 120,
  "nonProjectCount": 45,
  "role": "user",
  "email": "zhang.san@example.com",
  "phone": "+86 13800138001",
  "joinDate": "2024-01-15",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "isActive": true
}
```

---

## 8. 业务流程分解

### 1. 用户提交申请流程
```
用户界面 → 填写表单 → 提交申请 → 等待审核
API需求：创建申请、验证数据、返回申请ID
```

### 2. 管理员审核流程
```
审核列表 → 查看申请详情 → 审核操作 → 结果通知
API需求：查询申请、审核操作、状态更新
```

### 3. 数据同步流程
```
审核通过 → 写入正式库 → 更新统计 → 清理缓冲区
API需求：数据写入、统计更新、清理操作
```
