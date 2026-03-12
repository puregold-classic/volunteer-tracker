console.log('🧪 开始测试后端API连接...\n');

async function testAPI() {
  try {
    // 测试健康检查
    console.log('1. 测试健康检查...');
    const healthRes = await fetch('http://localhost:5000/api/health');
    if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log(`✅ ${healthData.message}`);
    console.log(`   PostgreSQL状态: ${healthData.postgresql}`);
    
    // 测试志愿者API
    console.log('\n2. 测试志愿者API...');
    const volunteersRes = await fetch('http://localhost:5000/api/v1/volunteers');
    if (!volunteersRes.ok) throw new Error(`HTTP ${volunteersRes.status}`);
    const volunteersData = await volunteersRes.json();
    
    console.log(`✅ 获取到 ${volunteersData.total} 位志愿者`);
    
    if (volunteersData.data && volunteersData.data.length > 0) {
      console.log('\n📋 志愿者列表:');
      volunteersData.data.forEach((volunteer, index) => {
        console.log(`  ${index + 1}. ${volunteer.id} - ${volunteer.chineseName}`);
        console.log(`     英文名: ${volunteer.englishName}`);
        console.log(`     状态: ${volunteer.status}, 地区: ${volunteer.region}`);
        console.log(`     服务方向: ${volunteer.services.join(', ')}`);
        console.log(`     服务时长: ${volunteer.nonProjectHours}小时 (${volunteer.nonProjectCount}次)\n`);
      });
    }
    
    console.log('🎉 API测试成功！');
    
  } catch (error) {
    console.error('\n❌ API测试失败:', error.message);
    console.log('\n💡 解决方案:');
    console.log('   1. 确保服务器运行: npm run dev');
    console.log('   2. 检查PostgreSQL连接');
  }
}

// 等待服务器启动
setTimeout(() => {
  testAPI();
}, 2000);
