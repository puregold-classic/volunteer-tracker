import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Volunteer from '../models/Volunteer.js';

dotenv.config();

const simpleVolunteers = [
  {
    id: "VM-0001",
    chineseName: "张三",
    englishName: "Zhang San",
    avatar: "https://i.pravatar.cc/150?img=1",
    status: "在职",
    region: "中国大陆",
    services: ["翻译", "管理"],
    nonProjectHours: 85,
    nonProjectCount: 32,
    email: "zhang.san@example.com",
    phone: "+86 13800138001"
  },
  {
    id: "VM-0002",
    chineseName: "李四",
    englishName: "Li Si",
    avatar: "https://i.pravatar.cc/150?img=2",
    status: "在职",
    region: "中国台湾",
    services: ["校对", "技术"],
    nonProjectHours: 120,
    nonProjectCount: 45,
    email: "li.si@example.com",
    phone: "+886 912345678"
  },
  {
    id: "VM-0003",
    chineseName: "王五",
    englishName: "Wang Wu",
    avatar: "https://i.pravatar.cc/150?img=3",
    status: "不在职",
    region: "东南亚",
    services: ["管理"],
    nonProjectHours: 65,
    nonProjectCount: 25,
    email: "wang.wu@example.com",
    phone: "+65 81234567"
  },
  {
    id: "VM-0004",
    chineseName: "赵六",
    englishName: "Zhao Liu",
    avatar: "https://i.pravatar.cc/150?img=4",
    status: "在职",
    region: "美国",
    services: ["技术", "翻译"],
    nonProjectHours: 150,
    nonProjectCount: 55,
    email: "zhao.liu@example.com",
    phone: "+1 2125550123"
  },
  {
    id: "VM-0005",
    chineseName: "孙七",
    englishName: "Sun Qi",
    avatar: "https://i.pravatar.cc/150?img=5",
    status: "在职",
    region: "欧洲",
    services: ["技术", "管理"],
    nonProjectHours: 95,
    nonProjectCount: 38,
    email: "sun.qi@example.com",
    phone: "+44 7911123456"
  }
];

const seedSimple = async () => {
  try {
    console.log('🌱 开始初始化简单数据库...');
    
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_demo');
    
    // 删除现有数据
    await Volunteer.deleteMany({});
    console.log('🗑️  已清除现有数据');
    
    // 插入简单数据
    await Volunteer.insertMany(simpleVolunteers);
    console.log(`✅ 成功创建 ${simpleVolunteers.length} 条志愿者数据`);
    
    // 显示统计
    const total = await Volunteer.countDocuments();
    const active = await Volunteer.countDocuments({ status: '在职' });
    const totalHours = await Volunteer.aggregate([
      { $group: { _id: null, total: { $sum: '$nonProjectHours' } } }
    ]);
    
    console.log('\n📊 数据库统计:');
    console.log(`  总志愿者数: ${total}`);
    console.log(`  在职志愿者: ${active}`);
    console.log(`  非在职志愿者: ${total - active}`);
    console.log(`  总服务时长: ${totalHours[0]?.total || 0} 小时`);
    
    console.log('\n📋 所有志愿者:');
    const allVolunteers = await Volunteer.find({}).select('id chineseName englishName status region');
    allVolunteers.forEach(v => {
      console.log(`  ${v.id}: ${v.chineseName} (${v.englishName}) - ${v.status} - ${v.region}`);
    });
    
    console.log('\n🎉 数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
};

// 运行
seedSimple();
