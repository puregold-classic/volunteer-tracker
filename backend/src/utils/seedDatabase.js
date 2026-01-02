const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const volunteerData = [
  {
    id: 'VM-0001',
    chineseName: '张三',
    englishName: 'Zhang San',
    avatar: '/assets/images/avatars/default.jpg',
    status: 'active',
    region: 'mainland-china',
    services: ['translation', 'proofreading'],
    totalHours: 120.5,
    serviceCount: 45,
    email: 'zhangsan@example.com',
    phone: '+86 13800138000',
    description: '热爱翻译工作，擅长中英互译',
    timezone: 'Asia/Shanghai',
    currentLocation: {
      country: '中国',
      city: '北京',
      coordinates: { lat: 39.9042, lng: 116.4074 }
    }
  },
  {
    id: 'VM-0002',
    chineseName: '李四',
    englishName: 'Li Si',
    avatar: '/assets/images/avatars/default.jpg',
    status: 'inactive',
    region: 'taiwan',
    services: ['management', 'technical'],
    totalHours: 85.0,
    serviceCount: 32,
    email: 'lisi@example.com',
    phone: '+886 912345678',
    description: '项目管理经验丰富，技术能力强',
    timezone: 'Asia/Taipei',
    currentLocation: {
      country: '中国台湾',
      city: '台北',
      coordinates: { lat: 25.0330, lng: 121.5654 }
    }
  },
  {
    id: 'VM-0003',
    chineseName: '王五',
    englishName: 'Wang Wu',
    avatar: '/assets/images/avatars/default.jpg',
    status: 'active',
    region: 'southeast-asia',
    services: ['translation', 'other'],
    totalHours: 210,
    serviceCount: 67,
    email: 'wangwu@example.com',
    phone: '+65 91234567',
    description: '热心社区服务，擅长跨文化交流',
    timezone: 'Asia/Singapore',
    currentLocation: {
      country: '新加坡',
      city: '新加坡',
      coordinates: { lat: 1.3521, lng: 103.8198 }
    }
  },
  {
    id: 'VM-0004',
    chineseName: '赵六',
    englishName: 'Zhao Liu',
    avatar: '/assets/images/avatars/default.jpg',
    status: 'active',
    region: 'usa',
    services: ['technical', 'management'],
    totalHours: 95.5,
    serviceCount: 38,
    email: 'zhaoliu@example.com',
    phone: '+1 555-0123',
    description: '软件工程师，擅长技术支持和培训',
    timezone: 'America/New_York',
    currentLocation: {
      country: '美国',
      city: '纽约',
      coordinates: { lat: 40.7128, lng: -74.0060 }
    }
  },
  {
    id: 'VM-0005',
    chineseName: '钱七',
    englishName: 'Qian Qi',
    avatar: '/assets/images/avatars/default.jpg',
    status: 'pending',
    region: 'europe',
    services: ['proofreading', 'other'],
    totalHours: 45,
    serviceCount: 18,
    email: 'qianqi@example.com',
    phone: '+44 20 7123 4567',
    description: '语言爱好者，擅长校对和文案工作',
    timezone: 'Europe/London',
    currentLocation: {
      country: '英国',
      city: '伦敦',
      coordinates: { lat: 51.5074, lng: -0.1278 }
    }
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 开始导入种子数据...');
    
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
    
    // 连接数据库
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');
    
    // 导入 Volunteer 模型
    const Volunteer = require('../models/Volunteer');
    
    // 清空现有数据
    await Volunteer.deleteMany({});
    console.log('🗑️  已清空现有数据');
    
    // 插入种子数据
    await Volunteer.insertMany(volunteerData);
    console.log(`✅ 已插入 ${volunteerData.length} 条志愿者记录`);
    
    // 验证数据
    const count = await Volunteer.countDocuments();
    console.log(`📊 数据库现在共有 ${count} 条记录`);
    
    // 显示统计
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
    
    // 显示地区分布
    const regions = await Volunteer.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n🗺️  地区分布:');
    regions.forEach(region => {
      console.log(`  ${region._id}: ${region.count} 人`);
    });
    
    await mongoose.disconnect();
    console.log('\n🎉 种子数据导入完成！');
    
  } catch (error) {
    console.error('❌ 种子数据导入失败:', error);
    process.exit(1);
  }
}

// 运行种子函数
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
