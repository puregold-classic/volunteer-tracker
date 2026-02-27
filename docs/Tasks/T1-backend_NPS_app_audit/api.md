# 📋 录入审核功能API接口设计（当前后端实现版）

**返回主文档：** [Task1-README](./README.md)

以下仅保留当前后端已实现接口。

## 📝 1. 申请管理模块（ServiceApplication）

### 1.1 申请验证与提交
```
POST   /api/v1/applications/validate      # 申请预验证
POST   /api/v1/applications               # 提交申请
```

### 1.2 申请查询
```
GET    /api/v1/applications/my            # 获取我的申请列表
```

### 1.3 申请维护
```
DELETE /api/v1/applications/:applicationId # 撤销申请
```

## 👮 2. 审核管理模块

### 2.1 审核查询
```
GET    /api/v1/reviews/pending                    # 获取待审核列表
GET    /api/v1/reviews/processed                  # 获取已处理列表
GET    /api/v1/reviews/stats                      # 审核统计信息
GET    /api/v1/reviews/application/:applicationId # 获取申请详情（审核视角）
```

### 2.2 审核操作
```
POST   /api/v1/reviews/:applicationId         # 通用审核入口
POST   /api/v1/reviews/create/:applicationId  # 审核创建申请（兼容路由）
POST   /api/v1/reviews/update/:applicationId  # 审核更新申请（兼容路由）
POST   /api/v1/reviews/delete/:applicationId  # 审核删除申请（兼容路由）
POST   /api/v1/reviews/batch                  # 批量审核
```

### 2.3 审核重审与撤回
```
POST   /api/v1/reviews/:reviewId/reopen       # 重新开启审核（被拒后）
DELETE /api/v1/reviews/:reviewId              # 撤回审核结果
```

## 📊 3. 正式数据模块（NonProjectService）

### 3.1 服务记录查询
```
GET    /api/v1/services                         # 获取服务记录列表
GET    /api/v1/services/:serviceId              # 获取服务记录详情
GET    /api/v1/services/volunteer/:volunteerId  # 获取志愿者服务记录
GET    /api/v1/services/search                  # 搜索服务记录
```

### 3.2 服务记录统计
```
GET    /api/v1/services/stats/summary           # 服务记录总览统计
GET    /api/v1/services/stats/volunteer/:volunteerId # 志愿者服务统计
GET    /api/v1/services/stats/region/:region    # 地区服务统计
GET    /api/v1/services/stats/trend             # 服务趋势统计
```

### 3.3 数据导出
```
GET    /api/v1/services/export                  # 导出服务记录
GET    /api/v1/services/export/stream           # 流式导出
GET    /api/v1/services/export/stats            # 导出统计
GET    /api/v1/services/export/template         # 下载导入模板
```

## 📋 4. 审计日志模块（AuditLog）

### 4.1 审计查询
```
GET    /api/v1/audit/logs                         # 获取审计日志列表
GET    /api/v1/audit/:auditId                     # 获取审计详情
GET    /api/v1/audit/target/:targetType/:targetId # 获取目标审计历史
```

### 4.2 审计分析
```
GET    /api/v1/audit/stats/summary                # 审计统计总览
GET    /api/v1/audit/stats/operator/:operatorId   # 操作人审计统计
GET    /api/v1/audit/stats/timeline               # 审计时间线分析
```

### 4.3 审计导出
```
GET    /api/v1/audit/export                       # 导出审计日志
```

## 👥 5. 志愿者模块（Volunteer）

### 5.1 志愿者查询与维护
```
GET    /api/v1/volunteers                         # 获取志愿者列表（支持 ?search=）
GET    /api/v1/volunteers/:id                     # 获取志愿者详情
POST   /api/v1/volunteers                         # 创建志愿者
PUT    /api/v1/volunteers/:id                     # 更新志愿者
DELETE /api/v1/volunteers/:id                     # 删除志愿者
GET    /api/v1/volunteers/stats                   # 志愿者统计
```

## ⚙️ 6. 健康检查
```
GET    /api/health                                # 系统健康检查
```

## 🎯 核心业务流程对应API链

### 场景A：用户提交创建申请
```
1. POST /api/v1/applications/validate
2. POST /api/v1/applications
3. GET  /api/v1/applications/my
```

### 场景B：管理员审核申请
```
1. GET  /api/v1/reviews/pending
2. GET  /api/v1/reviews/application/:applicationId
3. POST /api/v1/reviews/:applicationId
4. GET  /api/v1/audit/logs
```

### 场景C：查询志愿者与服务记录
```
1. GET  /api/v1/volunteers/:id
2. GET  /api/v1/services/volunteer/:id
3. GET  /api/v1/services/stats/volunteer/:id
```

**返回主文档：** [Task1-README](./README.md)
