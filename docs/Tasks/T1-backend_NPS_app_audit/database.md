# 数据模型文档

---

## 1. 📋 **Volunteer（志愿者）**

### **数据结构**
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

## 2. 📝 **ServiceApplication（服务申请缓冲区）**

### **数据结构**
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

## 3. 📊 **NonProjectService（正式服务记录库）**

### **数据结构**
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

## 4. 🔍 **AuditLog（审计日志）**

### **数据结构**
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

## 5. 🔄 **变更模型格式**

### **创建操作**
```json
{ "field": "duration", "from": null, "to": 3.5 }
```

### **更新操作**
```json
{ "field": "duration", "from": 2.0, "to": 3.5 }
```

### **删除操作**
```json
{ "field": "duration", "from": 3.5, "to": null }
```

---

## 📋 **核心字段说明**

### **ID生成规则**
- **Volunteer**: `PG-{4位数字}` → `PG-0001`
- **ServiceApplication**: `APP-{志愿者ID}-{3位序号}` → `APP-PG-0001-001`
- **NonProjectService**: `NPS-{志愿者ID}-{3位序号}` → `NPS-PG-0001-001`
- **AuditLog**: `AUDIT-{审核员ID}-{3位序号}` → `AUDIT-PG-0003-001`

### **状态流转**
```
申请提交 → pending → 审核处理 → approved/rejected → 记录创建/更新
```

### **角色权限**
- **user**: 普通志愿者，可提交申请
- **c_admin**: 审核员，可审核申请
- **admin**: 管理员，全系统权限