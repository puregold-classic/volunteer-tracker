## 📋 **test_example: 创建"create"，并得到管理员"approved"**

**返回主文档：** [Task1-README](./README.md)

### **前置条件**
✅ 服务器运行在 `http://localhost:5000`  
✅ 数据库已连接  

## 👥 志愿者数据创建脚本

```javascript
// 一次性创建三个志愿者
const createVolunteers = async () => {
  const volunteers = [
    {
      id: "PG-0001",
      chineseName: "张三",
      englishName: "Zhang San",
      avatar: "https://i.pravatar.cc/150?img=1",
      status: "在职",
      region: "中国大陆",
      indexedRegion: "中国大陆",
      indexedStatus: "在职",
      indexedActivityLevel: "中",
      services: ["翻译"],
      role: "user",
      email: "zhang.san@example.com",
      phone: "+86 13800138001"
    },
    {
      id: "PG-0002",
      chineseName: "李四", 
      englishName: "Li Si",
      avatar: "https://i.pravatar.cc/150?img=2",
      status: "在职",
      region: "中国大陆",
      indexedRegion: "中国大陆",
      indexedStatus: "在职",
      indexedActivityLevel: "中",
      services: ["校对"],
      role: "user",
      email: "li.si@example.com",
      phone: "+86 13700137001"
    },
    {
      id: "PG-0003",
      chineseName: "王五",
      englishName: "Wang Wu", 
      avatar: "https://i.pravatar.cc/150?img=3",
      status: "在职",
      region: "中国大陆",
      indexedRegion: "中国大陆",
      indexedStatus: "在职",
      indexedActivityLevel: "中",
      services: ["管理"],
      role: "c_admin",
      email: "wang.wu@example.com",
      phone: "+86 13900139001"
    }
  ];

  for (const volunteer of volunteers) {
    const response = await fetch('http://localhost:5000/api/v1/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(volunteer)
    });
    const result = await response.json();
    console.log(`创建 ${volunteer.id} ${volunteer.chineseName}:`, result.success ? '成功' : '失败');
  }
};

// 运行创建
createVolunteers();
```

---

## 🧪 **第一阶段：申请提交测试**

### **步骤1：验证申请数据**
```javascript
// 标准测试数据
const testData = {
  "applicationType": "create",
  "volunteerId": "PG-0001",
  "volunteerName": "张三",
  "changes": [
    {
      "field": "serviceDate",
      "from": null,
      "to": "2026-01-16"
    },
    {
      "field": "serviceType",
      "from": null,
      "to": "翻译"
    },
    {
      "field": "duration",
      "from": null,
      "to": 2.0
    },
    {
      "field": "description",
      "from": null,
      "to": "测试服务描述，至少5个字符以上"
    }
  ],
  "submittedBy": {
    "id": "PG-0001",
    "name": "张三",
    "role": "user"
  }
};

// 运行验证
const validateApplication = async () => {
  console.log('🔍 步骤1: 验证申请数据...');
  
  const response = await fetch('http://localhost:5000/api/v1/applications/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });
  
  const result = await response.json();
  console.log('状态码:', response.status);
  console.log('是否有效:', result.isValid);
  
  if (!result.isValid) {
    throw new Error('验证失败: ' + result.error);
  }
  
  console.log('✅ 验证通过');
  return true;
};

validateApplication();
```

### **步骤2：提交申请**
```javascript
// 提交申请
const submitApplication = async () => {
  console.log('\n📤 步骤2: 提交申请...');
  
  const response = await fetch('http://localhost:5000/api/v1/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData)
  });
  
  const result = await response.json();
  console.log('状态码:', response.status);
  
  if (!response.ok) {
    throw new Error('提交失败: ' + result.error);
  }
  
  console.log('✅ 提交成功');
  console.log('申请ID:', result.data.applicationId);
  return result.data.applicationId;
};

const applicationId = await submitApplication();
```

### **步骤3：验证申请已保存**
```javascript
// 查看我的申请
const verifyApplicationSaved = async (applicationId) => {
  console.log('\n📋 步骤3: 验证申请已保存...');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const response = await fetch('http://localhost:5000/api/v1/applications/my?submittedById=PG-0001');
  const result = await response.json();
  
  console.log('我的申请总数:', result.data.pagination.total);
  
  const foundApp = result.data.applications.find(app => app.applicationId === applicationId);
  if (!foundApp) {
    throw new Error('申请未找到');
  }
  
  console.log('✅ 申请已保存');
  console.log('申请状态:', foundApp.status);
  console.log('申请类型:', foundApp.applicationType);
  
  return foundApp;
};

const savedApp = await verifyApplicationSaved(applicationId);
```

---

## 🧪 **第二阶段：审核流程测试**

### **步骤4：检查审核人权限**
```javascript
// 确保审核人存在
const checkReviewer = async () => {
  console.log('\n👮 步骤4: 检查审核人权限...');
  
  const response = await fetch('http://localhost:5000/api/v1/volunteers/PG-0003');
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error('审核人不存在');
  }
  
  console.log('审核人:', result.data.chineseName);
  console.log('角色:', result.data.role);
  
  if (result.data.role !== 'c_admin') {
    throw new Error('审核人没有权限');
  }
  
  console.log('✅ 审核人权限正常');
  return true;
};

checkReviewer();
```

### **步骤5：查看待审核申请**
```javascript
// 获取待审核列表
const getPendingApplications = async () => {
  console.log('\n📋 步骤5: 查看待审核申请...');
  
  const response = await fetch('http://localhost:5000/api/v1/reviews/pending', {
    headers: { 'x-reviewer-id': 'PG-0003' }
  });
  
  const result = await response.json();
  console.log('状态码:', response.status);
  
  if (!response.ok) {
    throw new Error('获取待审核失败: ' + (result.error || '未知错误'));
  }
  
  console.log('待审核申请数量:', result.data?.length || 0);
  
  if (!result.data || result.data.length === 0) {
    throw new Error('没有待审核申请');
  }
  
  const pendingApp = result.data[0];
  console.log('✅ 找到待审核申请');
  console.log('申请ID:', pendingApp.applicationId);
  console.log('志愿者:', pendingApp.volunteerName);
  console.log('类型:', pendingApp.applicationType);
  
  return pendingApp.applicationId;
};

const pendingAppId = await getPendingApplications();
```

### **步骤6：查看申请详情**
```javascript
// 查看申请详情
const getApplicationDetails = async (applicationId) => {
  console.log(`\n🔍 步骤6: 查看申请 ${applicationId} 详情...`);
  
  const response = await fetch(`http://localhost:5000/api/v1/reviews/application/${applicationId}`, {
    headers: { 'x-reviewer-id': 'PG-0003' }
  });
  
  const result = await response.json();
  console.log('状态码:', response.status);
  
  if (!response.ok) {
    throw new Error('获取详情失败: ' + result.error);
  }
  
  console.log('✅ 申请详情获取成功');
  
  const app = result.data.application;
  console.log('变更数量:', app.changes.length);
  app.changes.forEach((change, i) => {
    console.log(`${i+1}. ${change.field}: ${change.from} → ${change.to}`);
  });
  
  return result.data;
};

const appDetails = await getApplicationDetails(pendingAppId);
```

### **步骤7：执行审核**
```javascript
// 执行审核
const reviewApplication = async (applicationId) => {
  console.log(`\n⚖️ 步骤7: 审核申请 ${applicationId}...`);
  
  const reviewData = {
    result: "approved",
    notes: "申请信息完整，服务记录符合要求，批准创建。"
  };
  
  const response = await fetch(`http://localhost:5000/api/v1/reviews/${applicationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-reviewer-id': 'PG-0003'
    },
    body: JSON.stringify(reviewData)
  });
  
  const result = await response.json();
  console.log('状态码:', response.status);
  
  if (!response.ok) {
    throw new Error('审核失败: ' + result.error);
  }
  
  console.log('✅ 审核成功');
  console.log('审核结果:', result.data?.reviewResult);
  console.log('生成的服务记录ID:', result.data?.modifiedId);
  
  return result.data;
};

const reviewResult = await reviewApplication(pendingAppId);
```

---

## 🧪 **第三阶段：数据同步验证**

### **步骤8：验证申请状态更新**
```javascript
// 验证申请状态
const verifyApplicationStatus = async (applicationId) => {
  console.log('\n📊 步骤8: 验证申请状态更新...');
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const response = await fetch('http://localhost:5000/api/v1/applications/my?submittedById=PG-0001');
  const result = await response.json();
  
  const reviewedApp = result.data.applications.find(app => app.applicationId === applicationId);
  
  if (!reviewedApp) {
    throw new Error('申请未找到');
  }
  
  console.log('当前申请状态:', reviewedApp.status);
  
  if (reviewedApp.status !== 'approved') {
    throw new Error('申请状态未正确更新');
  }
  
  console.log('✅ 申请状态已更新为 approved');
  return reviewedApp;
};

const updatedApp = await verifyApplicationStatus(pendingAppId);
```

### **步骤9：验证服务记录创建**
```javascript
// 验证服务记录
const verifyServiceRecord = async () => {
  console.log('\n📋 步骤9: 验证服务记录创建...');
  
  const response = await fetch('http://localhost:5000/api/v1/services');
  const result = await response.json();
  
  console.log('服务记录总数:', result.data?.length || 0);
  
  if (!result.data || result.data.length === 0) {
    throw new Error('没有找到服务记录');
  }
  
  const serviceRecord = result.data[0];
  console.log('✅ 服务记录已创建');
  console.log('服务记录ID:', serviceRecord.serviceId);
  console.log('服务类型:', serviceRecord.serviceType);
  console.log('服务时长:', serviceRecord.duration);
  console.log('志愿者:', serviceRecord.volunteerName);
  
  return serviceRecord;
};

const serviceRecord = await verifyServiceRecord();
```

### **步骤10：验证审计日志**
```javascript
// 验证审计日志
const verifyAuditLog = async () => {
  console.log('\n📜 步骤10: 验证审计日志...');
  
  const response = await fetch('http://localhost:5000/api/v1/audit/logs');
  const result = await response.json();
  
  console.log('审计日志总数:', result.data?.length || 0);
  
  if (!result.data || result.data.length === 0) {
    throw new Error('没有找到审计日志');
  }
  
  const auditLog = result.data[0];
  console.log('✅ 审计日志已创建');
  console.log('审计ID:', auditLog.auditId);
  console.log('操作类型:', auditLog.action);
  console.log('审核人:', auditLog.operator?.name);
  console.log('操作时间:', auditLog.timestamp);
  
  return auditLog;
};

const auditLog = await verifyAuditLog();
```

### **步骤11：验证志愿者统计更新**
```javascript
// 验证志愿者统计
const verifyVolunteerStats = async () => {
  console.log('\n📈 步骤11: 验证志愿者统计更新...');
  
  const response = await fetch('http://localhost:5000/api/v1/volunteers/PG-0001');
  const result = await response.json();
  
  const volunteer = result.data;
  console.log('志愿者:', volunteer.chineseName);
  console.log('累计服务时长:', volunteer.nonProjectHours);
  console.log('服务次数:', volunteer.nonProjectCount);
  
  if (volunteer.nonProjectHours !== 2.0) {
    console.log('⚠️ 服务时长统计可能未更新');
  } else {
    console.log('✅ 志愿者统计已更新');
  }
  
  return volunteer;
};

const volunteerStats = await verifyVolunteerStats();
```

---

## 🎉 **最终验证**

```javascript
// 最终验证总结
const finalVerification = async () => {
  console.log('\n🎯 ========== 最终验证 ==========');
  
  try {
    // 执行所有测试
    await validateApplication();
    const appId = await submitApplication();
    await verifyApplicationSaved(appId);
    await checkReviewer();
    const pendingId = await getPendingApplications();
    await getApplicationDetails(pendingId);
    await reviewApplication(pendingId);
    await verifyApplicationStatus(pendingId);
    await verifyServiceRecord();
    await verifyAuditLog();
    await verifyVolunteerStats();
    
    console.log('\n🎉 ========== 所有测试通过！ ==========');
    console.log('✅ 申请流程: 提交 → 验证 → 保存');
    console.log('✅ 审核流程: 权限 → 查看 → 审核');
    console.log('✅ 数据同步: 服务记录 + 审计日志 + 统计更新');
    console.log('\n📊 请在MongoDB Compass中验证:');
    console.log('  1. serviceapplications: 1条记录，状态=approved');
    console.log('  2. nonprojectservices: 1条服务记录');
    console.log('  3. auditlogs: 至少1条审计记录');
    console.log('  4. volunteers: PG-0001统计已更新');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log('请检查对应步骤的代码和错误信息');
  }
};

// 运行完整测试
finalVerification();
```

## 📋 **测试检查清单**

请按顺序运行以上步骤，并验证：

- [ ] **步骤1-3**: 申请提交流程正常
- [ ] **步骤4**: 审核人权限正常  
- [ ] **步骤5-7**: 审核流程正常
- [ ] **步骤8**: 申请状态更新
- [ ] **步骤9**: 服务记录创建
- [ ] **步骤10**: 审计日志记录
- [ ] **步骤11**: 志愿者统计更新

**返回主文档：** [Task1-README](./README.md)