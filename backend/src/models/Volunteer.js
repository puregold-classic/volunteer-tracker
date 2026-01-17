// src/models/Volunteer.js (更新版)
import mongoose from 'mongoose';

const volunteerSchema = new mongoose.Schema({
  // 核心标识
  id: {
    type: String,
    required: [true, '志愿者ID是必需的'],
    unique: true,
    trim: true,
    match: [/^[A-Z]+-\d{4}$/, 'ID格式必须是 前缀-4位数字']
  },
  
  // 姓名信息
  chineseName: {
    type: String,
    required: [true, '中文姓名是必需的'],
    trim: true,
    minlength: [2, '中文姓名至少2个字符'],
    maxlength: [50, '中文姓名最多50个字符']
  },
  
  englishName: {
    type: String,
    required: [true, '英文姓名是必需的'],
    trim: true,
    minlength: [2, '英文姓名至少2个字符'],
    maxlength: [100, '英文姓名最多100个字符']
  },
  
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=Unknown&background=random',
    trim: true
  },
  
  // 状态和地区
  status: {
    type: String,
    required: true,
    enum: {
      values: ['在职', '不在职'],
      message: '状态必须是"在职"或"不在职"'
    },
    default: '在职'
  },
  
  region: {
    type: String,
    required: [true, '地区是必需的'],
    trim: true,
    enum: ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']
  },
  
  province: {
    type: String,
    trim: true
  },
  
  subRegion: {
    type: String,
    trim: true
  },
  
  // 服务信息
  services: [{
    type: String,
    enum: ['翻译', '校对', '项目培训', '非项目培训', '受训', '管理', '技术', '社区服务']
  }],
  
  // 非项目服务统计（缓存字段，可通过实时计算更新）
  nonProjectHours: {
    type: Number,
    default: 0,
    min: 0
  },
  
  nonProjectCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // 活跃度评估
  activityLevel: {
    type: String,
    enum: ['高', '中', '低'],
    default: '中'
  },
  
  // 联系信息
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  // 角色权限
  role: {
    type: String,
    enum: ['user', 'admin', 'c_admin'],
    default: 'user'
  },
  
  // 时间信息
  joinDate: {
    type: Date,
    default: Date.now
  },
  
  // 索引字段
  indexedStatus: {
    type: String,
    enum: ['在职', '不在职'],
    default: '在职'
  },
  
  indexedRegion: {
    type: String,
    required: true
  },
  
  indexedActivityLevel: {
    type: String,
    enum: ['高', '中', '低'],
    default: '中'
  }
  
}, {
  timestamps: true
});

// 创建索引
volunteerSchema.index({ indexedStatus: 1 }); // 按状态筛选
volunteerSchema.index({ indexedRegion: 1 }); // 按地区筛选
volunteerSchema.index({ indexedActivityLevel: 1 }); // 按活跃度筛选
volunteerSchema.index({ nonProjectHours: -1 }); // 按服务时长排序
volunteerSchema.index({ chineseName: 'text', englishName: 'text' }); // 文本搜索

// 预保存钩子：同步索引字段
volunteerSchema.pre('save', function(next) {
  this.indexedStatus = this.status;
  this.indexedRegion = this.region || '其他';  // 添加默认值
  this.indexedActivityLevel = this.activityLevel;
  next();
});

// 实例方法：更新统计信息（从NonProjectService实时计算）
volunteerSchema.methods.updateStatistics = async function() {
  const stats = await mongoose.model('NonProjectService').aggregate([
    {
      $match: {
        volunteerId: this.id,
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$duration' },
        totalCount: { $sum: 1 }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.nonProjectHours = stats[0].totalHours;
    this.nonProjectCount = stats[0].totalCount;
  } else {
    this.nonProjectHours = 0;
    this.nonProjectCount = 0;
  }
  
  // 根据时长更新活跃度
  if (this.nonProjectHours >= 100) {
    this.activityLevel = '高';
  } else if (this.nonProjectHours >= 30) {
    this.activityLevel = '中';
  } else {
    this.activityLevel = '低';
  }
  
  return this.save();
};

export default mongoose.model('Volunteer', volunteerSchema);