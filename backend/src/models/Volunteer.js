import mongoose from 'mongoose';

const volunteerSchema = new mongoose.Schema({
  // 基本信息
  id: {
    type: String,
    required: [true, '志愿者ID是必需的'],
    unique: true,
    trim: true,
    match: [/^VM-\d{4}$/, 'ID格式必须是 VM-xxxx']
  },
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
  
  // 服务信息
  services: {
    type: [String],
    required: [true, '至少选择一个服务方向'],
    validate: {
      validator: function(v) {
        return v.length > 0 && v.length <= 5;
      },
      message: '服务方向至少1个，最多5个'
    },
    enum: ['翻译', '校对', '管理', '技术', '培训', '社区服务', '活动组织', '其他']
  },
  
  // 非项目服务统计
  nonProjectHours: {
    type: Number,
    required: [true, '非项目服务时长是必需的'],
    min: [0, '时长不能为负数'],
    default: 0
  },
  nonProjectCount: {
    type: Number,
    required: [true, '非项目服务次数是必需的'],
    min: [0, '次数不能为负数'],
    default: 0
  },
  
  // 扩展信息（可选）
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[+]?[\d\s\-()]{10,20}$/, '请输入有效的电话号码']
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  
  // 元数据
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { 
    createdAt: 'createdAt',
    updatedAt: 'updatedAt' 
  }
});

// 添加索引
volunteerSchema.index({ id: 1 }); // 唯一索引（自动创建）
volunteerSchema.index({ status: 1 });
volunteerSchema.index({ region: 1 });
volunteerSchema.index({ services: 1 });
volunteerSchema.index({ createdAt: -1 });
volunteerSchema.index({ nonProjectHours: -1 });

// 更新updatedAt时间戳的中间件
volunteerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 静态方法
volunteerSchema.statics.findByRegion = function(region) {
  return this.find({ region });
};

volunteerSchema.statics.findActive = function() {
  return this.find({ status: '在职', isActive: true });
};

// 实例方法
volunteerSchema.methods.getSummary = function() {
  return {
    id: this.id,
    name: this.chineseName,
    status: this.status,
    region: this.region,
    services: this.services,
    hours: this.nonProjectHours
  };
};

const Volunteer = mongoose.model('Volunteer', volunteerSchema);

export default Volunteer;