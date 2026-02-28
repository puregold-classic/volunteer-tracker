import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Volunteer from '../src/models/Volunteer.js';
import Account from '../src/models/Account.js';
import NonProjectService from '../src/models/NonProjectService.js';
import ServiceApplication from '../src/models/ServiceApplication.js';
import AuditLog from '../src/models/AuditLog.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_tracker';
const DEFAULT_VOLUNTEER_PASSWORD = process.env.DEFAULT_VOLUNTEER_PASSWORD || 'Volunteer@123';

const volunteers = [
  {
    id: 'PG-0001',
    chineseName: '张三',
    englishName: 'Zhang San',
    avatar: 'https://i.pravatar.cc/150?img=11',
    status: '在职',
    region: '中国大陆',
    province: '上海市',
    subRegion: '浦东新区',
    services: ['翻译', '管理'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'zhangsan@example.com',
    phone: '+86 13800138001'
  },
  {
    id: 'PG-0002',
    chineseName: '李四',
    englishName: 'Li Si',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: '在职',
    region: '中国大陆',
    province: '北京市',
    subRegion: '海淀区',
    services: ['校对', '技术'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'lisi@example.com',
    phone: '+86 13900139001'
  },
  {
    id: 'PG-0003',
    chineseName: '王五',
    englishName: 'Wang Wu',
    avatar: 'https://i.pravatar.cc/150?img=13',
    status: '在职',
    region: '中国台湾',
    province: '台湾省',
    subRegion: '信义区',
    services: ['翻译', '受训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'wangwu@example.com',
    phone: '+886 912345678'
  },
  {
    id: 'PG-0004',
    chineseName: '赵六',
    englishName: 'Zhao Liu',
    avatar: 'https://i.pravatar.cc/150?img=14',
    status: '在职',
    region: '东南亚',
    services: ['非项目培训', '项目培训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'zhaoliu@example.com',
    phone: '+65 81234567'
  },
  {
    id: 'PG-0005',
    chineseName: '孙七',
    englishName: 'Sun Qi',
    avatar: 'https://i.pravatar.cc/150?img=15',
    status: '不在职',
    region: '美国',
    services: ['校对'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'sunqi@example.com',
    phone: '+1 2125550138'
  },
  {
    id: 'PG-0006',
    chineseName: '周八',
    englishName: 'Zhou Ba',
    avatar: 'https://i.pravatar.cc/150?img=16',
    status: '在职',
    region: '欧洲',
    services: ['翻译', '项目培训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'zhouba@example.com',
    phone: '+44 7911123456'
  },
  {
    id: 'PG-0007',
    chineseName: '陈晨',
    englishName: 'Chen Chen',
    avatar: 'https://i.pravatar.cc/150?img=17',
    status: '在职',
    region: '中国大陆',
    province: '广东省',
    subRegion: '深圳市',
    services: ['技术', '项目培训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'chenchen@example.com',
    phone: '+86 13600136001'
  },
  {
    id: 'PG-0008',
    chineseName: '刘洋',
    englishName: 'Liu Yang',
    avatar: 'https://i.pravatar.cc/150?img=18',
    status: '在职',
    region: '中国大陆',
    province: '四川省',
    subRegion: '成都市',
    services: ['翻译', '社区服务'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'liuyang@example.com',
    phone: '+86 13700137002'
  },
  {
    id: 'PG-0009',
    chineseName: '黄敏',
    englishName: 'Huang Min',
    avatar: 'https://i.pravatar.cc/150?img=19',
    status: '在职',
    region: '东南亚',
    services: ['校对', '管理'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'huangmin@example.com',
    phone: '+66 812345678'
  },
  {
    id: 'PG-0010',
    chineseName: '林雪',
    englishName: 'Lin Xue',
    avatar: 'https://i.pravatar.cc/150?img=20',
    status: '在职',
    region: '美国',
    services: ['翻译', '非项目培训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'linxue@example.com',
    phone: '+1 6465550188'
  },
  {
    id: 'PG-0011',
    chineseName: '谢鹏',
    englishName: 'Xie Peng',
    avatar: 'https://i.pravatar.cc/150?img=21',
    status: '在职',
    region: '欧洲',
    services: ['技术', '受训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'xiepeng@example.com',
    phone: '+49 1701234567'
  },
  {
    id: 'PG-0012',
    chineseName: '吴婷',
    englishName: 'Wu Ting',
    avatar: 'https://i.pravatar.cc/150?img=22',
    status: '在职',
    region: '中国台湾',
    province: '台湾省',
    subRegion: '前金区',
    services: ['校对', '项目培训'],
    nonProjectHours: 0,
    nonProjectCount: 0,
    email: 'wuting@example.com',
    phone: '+886 978123456'
  }
];

const serviceBlueprints = [
  { volunteerId: 'PG-0001', volunteerName: '张三', serviceDate: '2026-01-05', serviceType: '翻译', duration: 3.5, description: '志愿者手册英译中修订' },
  { volunteerId: 'PG-0001', volunteerName: '张三', serviceDate: '2026-01-18', serviceType: '非项目培训', duration: 2.0, description: '新人术语规范培训' },
  { volunteerId: 'PG-0002', volunteerName: '李四', serviceDate: '2026-01-10', serviceType: '校对', duration: 2.5, description: '双语文档校对与一致性检查' },
  { volunteerId: 'PG-0002', volunteerName: '李四', serviceDate: '2026-02-02', serviceType: '项目培训', duration: 3.0, description: '项目流程培训支持' },
  { volunteerId: 'PG-0003', volunteerName: '王五', serviceDate: '2026-01-14', serviceType: '翻译', duration: 2.0, description: '活动海报繁体中文翻译' },
  { volunteerId: 'PG-0003', volunteerName: '王五', serviceDate: '2026-02-11', serviceType: '受训', duration: 1.5, description: '质量控制规范受训' },
  { volunteerId: 'PG-0004', volunteerName: '赵六', serviceDate: '2026-01-20', serviceType: '项目培训', duration: 2.5, description: '志愿者系统操作培训' },
  { volunteerId: 'PG-0004', volunteerName: '赵六', serviceDate: '2026-02-03', serviceType: '非项目培训', duration: 2.0, description: '跨区域协作交流培训' },
  { volunteerId: 'PG-0005', volunteerName: '孙七', serviceDate: '2026-01-09', serviceType: '校对', duration: 1.5, description: 'FAQ文档英文校对' },
  { volunteerId: 'PG-0006', volunteerName: '周八', serviceDate: '2026-02-08', serviceType: '翻译', duration: 3.0, description: '多语言志愿者指南翻译' },
  { volunteerId: 'PG-0007', volunteerName: '陈晨', serviceDate: '2026-02-12', serviceType: '项目培训', duration: 2.5, description: '数据录入流程培训' },
  { volunteerId: 'PG-0007', volunteerName: '陈晨', serviceDate: '2026-02-20', serviceType: '受训', duration: 1.5, description: '审核规范专项受训' },
  { volunteerId: 'PG-0008', volunteerName: '刘洋', serviceDate: '2026-01-22', serviceType: '翻译', duration: 2.0, description: '社区公告中英互译' },
  { volunteerId: 'PG-0008', volunteerName: '刘洋', serviceDate: '2026-02-16', serviceType: '非项目培训', duration: 2.0, description: '社区活动组织培训' },
  { volunteerId: 'PG-0009', volunteerName: '黄敏', serviceDate: '2026-02-05', serviceType: '校对', duration: 1.5, description: '活动内容本地化校对' },
  { volunteerId: 'PG-0009', volunteerName: '黄敏', serviceDate: '2026-02-21', serviceType: '项目培训', duration: 2.5, description: '多地区协作项目培训' },
  { volunteerId: 'PG-0010', volunteerName: '林雪', serviceDate: '2026-01-25', serviceType: '翻译', duration: 3.0, description: '北美项目资料翻译支持' },
  { volunteerId: 'PG-0010', volunteerName: '林雪', serviceDate: '2026-02-14', serviceType: '非项目培训', duration: 2.0, description: '志愿者沟通技巧培训' },
  { volunteerId: 'PG-0011', volunteerName: '谢鹏', serviceDate: '2026-01-28', serviceType: '受训', duration: 1.5, description: '平台新功能受训' },
  { volunteerId: 'PG-0011', volunteerName: '谢鹏', serviceDate: '2026-02-18', serviceType: '项目培训', duration: 2.5, description: '技术志愿者项目流程培训' },
  { volunteerId: 'PG-0012', volunteerName: '吴婷', serviceDate: '2026-02-09', serviceType: '校对', duration: 2.0, description: '繁体文案质量校对' },
  { volunteerId: 'PG-0012', volunteerName: '吴婷', serviceDate: '2026-02-24', serviceType: '项目培训', duration: 2.5, description: '活动执行项目培训' }
];

const serviceIdFrom = (volunteerId, sequence) =>
  `NPS-${volunteerId}-${String(sequence).padStart(3, '0')}`;

async function seedQualityDataset() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });

  try {
    console.log('Cleaning old temporary data...');
    await Promise.all([
      ServiceApplication.deleteMany({}),
      NonProjectService.deleteMany({}),
      AuditLog.deleteMany({}),
      Account.deleteMany({}),
      Volunteer.deleteMany({})
    ]);

    console.log('Seeding volunteers...');
    await Volunteer.insertMany(
      volunteers.map((v) => ({
        ...v,
        indexedStatus: v.status,
        indexedRegion: v.region || '其他',
        indexedActivityLevel: '中'
      }))
    );

    console.log('Seeding non-project service records...');
    const records = serviceBlueprints.map((item, idx) => {
      const sequenceMap = serviceBlueprints
        .slice(0, idx + 1)
        .filter((s) => s.volunteerId === item.volunteerId).length;
      const serviceDate = new Date(`${item.serviceDate}T09:00:00.000Z`);
      return {
        serviceId: serviceIdFrom(item.volunteerId, sequenceMap),
        volunteerId: item.volunteerId,
        volunteerName: item.volunteerName,
        serviceDate,
        serviceType: item.serviceType,
        duration: item.duration,
        description: item.description,
        auditHistory: [
          {
            auditId: `AUDIT-${item.volunteerId}-${String(sequenceMap).padStart(3, '0')}`,
            auditTime: new Date(`${item.serviceDate}T10:00:00.000Z`),
            auditResult: 'approved',
            reviewerId: 'PG-9000',
            reviewerName: 'System Reviewer',
            auditNote: 'seed import approved',
            applicationId: `APP-${item.volunteerId}-${String(sequenceMap).padStart(3, '0')}`
          }
        ],
        isActive: true,
        indexedVolunteerId: item.volunteerId,
        indexedServiceDate: serviceDate,
        indexedServiceType: item.serviceType,
        indexedIsActive: true
      };
    });
    await NonProjectService.insertMany(records);

    console.log('Seeding audit logs for imported service records...');
    const auditLogs = records.map((record, idx) => {
      const seq = String(idx + 1).padStart(3, '0');
      const ts = new Date(record.serviceDate);
      return {
        auditId: `AUDIT-PG-0000-${seq}`,
        targetType: 'NonProjectService',
        targetId: record.serviceId,
        action: 'seed_import',
        actionDetails: {
          applicationType: 'system',
          reviewResult: 'seeded',
          reviewNote: 'seed-quality-dataset import'
        },
        modifiedId: record.serviceId,
        changes: [
          { field: 'serviceDate', from: null, to: record.serviceDate },
          { field: 'serviceType', from: null, to: record.serviceType },
          { field: 'duration', from: null, to: record.duration },
          { field: 'description', from: null, to: record.description }
        ],
        operator: {
          id: 'PG-0000',
          name: 'System Admin',
          role: 'admin'
        },
        submitter: {
          id: record.volunteerId,
          name: record.volunteerName,
          role: 'user'
        },
        timestamp: ts,
        indexedDate: ts,
        indexedOperatorId: 'PG-0000',
        indexedTargetId: record.serviceId,
        indexedModifiedId: record.serviceId
      };
    });
    await AuditLog.insertMany(auditLogs);

    console.log('Rebuilding volunteer summary stats...');
    for (const volunteer of volunteers) {
      const stats = await NonProjectService.aggregate([
        { $match: { volunteerId: volunteer.id, isActive: true } },
        { $group: { _id: null, hours: { $sum: '$duration' }, count: { $sum: 1 } } }
      ]);
      const hours = stats[0]?.hours || 0;
      const count = stats[0]?.count || 0;
      await Volunteer.updateOne(
        { id: volunteer.id },
        {
          $set: {
            nonProjectHours: hours,
            nonProjectCount: count,
            activityLevel: hours >= 100 ? '高' : hours >= 30 ? '中' : '低'
          }
        }
      );
    }

    console.log('Seeding 1:1 volunteer accounts...');
    const volunteerAccounts = [];
    for (const volunteer of volunteers) {
      const passwordHash = await Account.hashPassword(DEFAULT_VOLUNTEER_PASSWORD);
      volunteerAccounts.push({
        email: volunteer.email,
        passwordHash,
        name: volunteer.chineseName,
        role: volunteer.id === 'PG-0001' ? 'b_admin' : 'user',
        volunteerId: volunteer.id,
        isActive: true
      });
    }

    // Non-volunteer system accounts (allowed by business rule)
    const systemAccounts = [
      {
        email: 'admin@example.com',
        passwordHash: await Account.hashPassword('Admin@12345'),
        name: 'System Admin',
        role: 'admin',
        volunteerId: 'PG-0000',
        isActive: true
      },
      {
        email: 'reviewer@example.com',
        passwordHash: await Account.hashPassword('Reviewer@123'),
        name: 'Review Operator',
        role: 'a_admin',
        volunteerId: 'PG-9999',
        isActive: true
      }
    ];

    await Account.insertMany([...volunteerAccounts, ...systemAccounts]);

    const totalVolunteers = await Volunteer.countDocuments();
    const totalAccounts = await Account.countDocuments();
    const linkedAccounts = await Account.countDocuments({ volunteerId: { $exists: true, $ne: null } });
    const totalServices = await NonProjectService.countDocuments({ isActive: true });

    console.log('Seed completed.');
    console.log({ totalVolunteers, totalAccounts, linkedAccounts, totalServices });
    console.log('Volunteer default password:', DEFAULT_VOLUNTEER_PASSWORD);
    console.log('System accounts: admin@example.com / Admin@12345, reviewer@example.com / Reviewer@123');
  } finally {
    await mongoose.connection.close();
  }
}

seedQualityDataset()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('seed-quality-dataset failed:', error);
    process.exit(1);
  });
