const mongoose = require('mongoose');
const Database = require('./database');
const Volunteer = require('../models/Volunteer');

const seedData = [
  {
    id: 'VM-0001',
    chineseName: '张三',
    englishName: 'Zhang San',
    status: 'active',
    region: 'mainland-china',
    services: ['translation', 'proofreading'],
    totalHours: 120.5,
    serviceCount: 45,
    email: 'zhangsan@example.com',
    currentLocation: {
      country: '中国',
      city: '北京'
    }
  },
  {
    id: 'VM-0002',
    chineseName: '李四',
    englishName: 'Li Si',
    status: 'inactive',
    region: 'taiwan',
    services: ['management', 'technical'],
    totalHours: 85,
    serviceCount: 32,
    email: 'lisi@example.com'
  },
  {
    id: 'VM-0003',
    chineseName: '王五',
    englishName: 'Wang Wu',
    status: 'active',
    region: 'southeast-asia',
    services: ['translation', 'other'],
    totalHours: 210,
    serviceCount: 67,
    email: 'wangwu@example.com'
  },
  {
    id: 'VM-0004',
    chineseName: '赵六',
    englishName: 'Zhao Liu',
    status: 'active',
    region: 'usa',
    services: ['technical', 'management'],
    totalHours: 95.5,
    serviceCount: 38,
    email: 'zhaoliu@example.com'
  },
  {
    id: 'VM-0005',
    chineseName: '钱七',
    englishName: 'Qian Qi',
    status: 'pending',
    region: 'europe',
    services: ['proofreading'],
    totalHours: 45,
    serviceCount: 18,
    email: 'qianqi@example.com'
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 开始数据库种子数据...');
    
    await Database.connect();
    
    // 清空现有数据
    await Volunteer.deleteMany({});
    console.log('🗑️  已清空现有志愿者数据');
    
    // 插入种子数据
    await Volunteer.insertMany(seedData);
    console.log(`✅ 已插入 ${seedData.length} 条志愿者记录`);
    
    // 验证数据
    const count = await Volunteer.countDocuments();
    console.log(`📊 数据库现在共有 ${count} 条记录`);
    
    // 显示统计信息
    const stats = await Volunteer.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$totalHours' }
        }
      }
    ]);
    
    console.log('\n📈 统计数据:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} 人, ${stat.totalHours} 小时`);
    });
    
    await mongoose.disconnect();
    console.log('\n🎉 种子数据完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 种子数据失败:', error);
    process.exit(1);
  }
}

// 如果是直接运行此文件
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
