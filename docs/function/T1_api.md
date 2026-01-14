# 📋 录入审核功能API接口设计

以下按功能模块组织：

## 📝 **1. 申请管理模块（ServiceApplication）**

### **1.1 申请验证与提交**
```
POST   /api/v1/applications/validate      # 申请预验证
POST   /api/v1/applications               # 提交申请
POST   /api/v1/applications/batch         # 批量提交申请（可选）
```

### **1.2 申请查询**
```
GET    /api/v1/applications               # 获取申请列表（带筛选）
GET    /api/v1/applications/my            # 获取我的申请列表
GET    /api/v1/applications/:applicationId # 获取申请详情
GET    /api/v1/applications/volunteer/:volunteerId # 获取志愿者相关申请
```

### **1.3 申请维护**
```
PATCH  /api/v1/applications/:applicationId # 修改申请内容（审核前）
DELETE /api/v1/applications/:applicationId # 撤销申请
```

## 👮 **2. 审核管理模块**

### **2.1 审核查询**
```
GET    /api/v1/reviews/pending            # 获取待审核列表
GET    /api/v1/reviews/processed          # 获取已处理列表
GET    /api/v1/reviews/stats              # 审核统计信息
GET    /api/v1/reviews/timeout            # 获取超时待处理申请（可选）
```

### **2.2 审核操作（按类型分开）**
```
POST   /api/v1/reviews/create/:applicationId  # 审核创建申请
POST   /api/v1/reviews/update/:applicationId  # 审核更新申请  
POST   /api/v1/reviews/delete/:applicationId  # 审核删除申请
POST   /api/v1/reviews/batch                  # 批量审核（可选）
```

### **2.3 审核重审与撤回**
```
POST   /api/v1/reviews/:reviewId/reopen       # 重新开启审核（被拒后）
DELETE /api/v1/reviews/:reviewId              # 撤回审核结果（审核后短时间内）
```

## 📊 **3. 正式数据模块（NonProjectService）**

### **3.1 服务记录查询**
```
GET    /api/v1/services                      # 获取服务记录列表
GET    /api/v1/services/:serviceId           # 获取服务记录详情
GET    /api/v1/services/volunteer/:volunteerId # 获取志愿者服务记录
GET    /api/v1/services/search               # 搜索服务记录
```

### **3.2 服务记录统计**
```
GET    /api/v1/services/stats/summary        # 服务记录总览统计
GET    /api/v1/services/stats/volunteer/:volunteerId # 志愿者服务统计
GET    /api/v1/services/stats/region/:region # 地区服务统计
GET    /api/v1/services/stats/trend          # 服务趋势统计
```

### **3.3 数据导出**
```
GET    /api/v1/services/export               # 导出服务记录
GET    /api/v1/services/export/template      # 下载导入模板（未来扩展）
```

## 📋 **4. 审计日志模块（AuditLog）**

### **4.1 审计查询**
```
GET    /api/v1/audit/logs                    # 获取审计日志列表
GET    /api/v1/audit/:auditId                # 获取审计详情
GET    /api/v1/audit/target/:targetType/:targetId # 获取目标审计历史
```

### **4.2 审计分析**
```
GET    /api/v1/audit/stats/summary           # 审计统计总览
GET    /api/v1/audit/stats/operator/:operatorId # 操作人审计统计
GET    /api/v1/audit/stats/timeline          # 审计时间线分析
```

### **4.3 审计导出**
```
GET    /api/v1/audit/export                  # 导出审计日志
```

## 👥 **5. 志愿者模块（Volunteer）**

### **5.1 志愿者查询**
```
GET    /api/v1/volunteers                    # 获取志愿者列表
GET    /api/v1/volunteers/:volunteerId       # 获取志愿者详情
GET    /api/v1/volunteers/search             # 搜索志愿者
```

### **5.2 志愿者统计**
```
GET    /api/v1/volunteers/stats/summary      # 志愿者总览统计
GET    /api/v1/volunteers/stats/region       # 志愿者地区分布
GET    /api/v1/volunteers/stats/activity     # 志愿者活跃度统计
GET    /api/v1/volunteers/stats/service      # 志愿者服务能力统计
```

### **5.3 志愿者服务记录关联**
```
GET    /api/v1/volunteers/:volunteerId/services # 获取志愿者的服务记录
GET    /api/v1/volunteers/:volunteerId/applications # 获取志愿者的申请记录
```

## ⚙️ **6. 系统管理模块**

### **6.1 系统健康与配置**
```
GET    /api/v1/system/health                 # 系统健康检查
GET    /api/v1/system/config                 # 获取系统配置
PUT    /api/v1/system/config                 # 更新系统配置（审核超时时间等）
```

### **6.2 数据维护**
```
POST   /api/v1/system/cleanup/applications   # 清理过期申请
POST   /api/v1/system/cleanup/audit          # 清理旧审计日志
POST   /api/v1/system/backup                 # 数据备份（可选）
POST   /api/v1/system/restore                # 数据恢复（可选）
```

### **6.3 统计报表**
```
GET    /api/v1/system/reports/daily          # 每日统计报表
GET    /api/v1/system/reports/monthly        # 月度统计报表
GET    /api/v1/system/reports/audit          # 审计分析报表
```

## 🔄 **7. 关联查询接口**

### **7.1 跨模块关联查询**
```
GET    /api/v1/relations/application/:applicationId/audit # 申请对应的审计记录
GET    /api/v1/relations/service/:serviceId/applications # 服务记录对应的申请历史
GET    /api/v1/relations/volunteer/:volunteerId/full     # 志愿者完整信息（含申请和服务记录）
```

### **7.2 时间线查询**
```
GET    /api/v1/timeline/volunteer/:volunteerId # 志愿者时间线（申请+服务记录）
GET    /api/v1/timeline/service/:serviceId     # 服务记录时间线
```

## 📱 **8. 前端辅助接口**

### **8.1 枚举值与配置**
```
GET    /api/v1/enums/application-types       # 申请类型枚举
GET    /api/v1/enums/service-types           # 服务类型枚举
GET    /api/v1/enums/regions                 # 地区枚举
GET    /api/v1/enums/status                  # 状态枚举
```

### **8.2 表单验证规则**
```
GET    /api/v1/validations/rules             # 获取验证规则
POST   /api/v1/validations/check             # 实时验证数据
```

## 🎯 **核心业务流程对应的API链**

### **场景A：用户提交创建申请**
```
1. POST /applications/validate     # 预验证
2. POST /applications              # 提交申请
3. GET  /applications/my           # 查看我的申请列表
```

### **场景B：管理员审核申请**
```
1. GET  /reviews/pending           # 查看待审核列表
2. GET  /applications/:id          # 查看申请详情
3. POST /reviews/create/:id        # 审核创建申请
4. GET  /audit/logs                # 查看审计记录
```

### **场景C：查询志愿者完整记录**
```
1. GET  /volunteers/:id            # 基本信息
2. GET  /volunteers/:id/services   # 服务记录
3. GET  /volunteers/:id/stats      # 统计信息
4. GET  /relations/volunteer/:id/full # 完整信息（可选）
```

## 📋 **接口分组建议（按开发优先级）**

### **第一期：核心业务流程**
```
✅ 申请提交：/applications/validate, /applications
✅ 申请查询：/applications/my, /applications/:id
✅ 审核操作：/reviews/pending, /reviews/create/:id, /reviews/update/:id, /reviews/delete/:id
✅ 服务记录：/services, /services/:id
✅ 志愿者统计：/volunteers/:id/stats
```

### **第二期：增强功能**
```
🔧 批量操作：/applications/batch, /reviews/batch
🔧 审计查询：/audit/logs, /audit/:id
🔧 高级统计：/services/stats, /volunteers/stats
🔧 数据导出：/services/export, /audit/export
```

### **第三期：优化与扩展**
```
📦 系统管理：/system/config, /system/cleanup
📦 关联查询：/relations/*
📦 报表功能：/system/reports/*
📦 实时通知：WebSocket接口
```

这个API设计覆盖了从申请提交到数据查询的完整业务流程。您觉得这个颗粒度合适吗？哪些接口需要调整或补充？