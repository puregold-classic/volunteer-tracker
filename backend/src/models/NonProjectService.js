// src/models/NonProjectService.js
import mongoose from 'mongoose';

const nonProjectServiceSchema = new mongoose.Schema({
  // 核心标识
  serviceId: {
    type: String,
    required: [true, '服务记录ID是必需的'],
    unique: true,
    trim: true,
    match: [/^NPS-[A-Z]+-\d{3,}$/, '服务ID格式: NPS-{volunteerId}-{seq}']
  },
  
  // 志愿者信息
  volunteerId: {
    type: String,
    required: [true, '志愿者ID是必需的'],
    trim: true,
    match: [/^[A-Z]+-\d+$/, '志愿者ID格式: 前缀-数字']
  },
  
  volunteerName: {
    type: String,
    required: [true, '志愿者姓名是必需的'],
    trim: true
  },
  
  // 服务详情
  serviceDate: {
    type: Date,
    required: [true, '服务日期是必需的'],
    validate: {
      validator: function(value) {
        // 服务日期不能是未来
        return value <= new Date();
      },
      message: '服务日期不能是未来日期'
    }
  },
  
  serviceType: {
    type: String,
    required: [true, '服务类型是必需的'],
    enum: {
      values: ['翻译', '校对', '项目培训', '非项目培训', '受训'],
      message: '服务类型必须是: 翻译, 校对, 项目培训, 非项目培训, 受训'
    }
  },
  
  duration: {
    type: Number,
    required: [true, '服务时长是必需的'],
    min: [0.5, '服务时长至少0.5小时'],
    validate: {
      validator: function(value) {
        // 必须是0.5的倍数
        return value % 0.5 === 0;
      },
      message: '服务时长必须是0.5小时的倍数'
    }
  },
  
  description: {
    type: String,
    required: [true, '服务描述是必需的'],
    trim: true,
    minlength: [5, '服务描述至少5个字符'],
    maxlength: [1000, '服务描述最多1000个字符']
  },
  
  // 审核历史（记录每次审核）
  auditHistory: [{
    auditId: {
      type: String,
      required: [true, '审计ID是必需的']
    },
    auditTime: {
      type: Date,
      required: [true, '审核时间是必需的']
    },
    auditResult: {
      type: String,
      required: [true, '审核结果是必需的'],
      enum: ['approved', 'rejected']
    },
    reviewerId: {
      type: String,
      required: [true, '审核人ID是必需的']
    },
    reviewerName: {
      type: String,
      required: [true, '审核人姓名是必需的']
    },
    auditNote: {
      type: String,
      required: [true, '审核备注是必需的'],
      trim: true,
      maxlength: [500, '审核备注最多500个字符']
    },
    applicationId: {
      type: String,
      required: [true, '关联申请ID是必需的']
    },
    _id: false
  }],
  
  // 软删除标记
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 索引字段
  indexedVolunteerId: {
    type: String,
    required: true
  },
  
  indexedServiceDate: {
    type: Date,
    required: true
  },
  
  indexedServiceType: {
    type: String,
    required: true
  },
  
  indexedIsActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// 创建索引
nonProjectServiceSchema.index({ serviceId: 1 }, { unique: true });
nonProjectServiceSchema.index({ indexedVolunteerId: 1, indexedServiceDate: -1 }); // 按志愿者和时间查询
nonProjectServiceSchema.index({ indexedServiceType: 1 }); // 按服务类型查询
nonProjectServiceSchema.index({ indexedIsActive: 1 }); // 软删除过滤
nonProjectServiceSchema.index({ serviceDate: 1 }); // 时间范围查询
nonProjectServiceSchema.index({ 
  volunteerId: 1, 
  isActive: 1, 
  serviceDate: -1 
}); // 统计查询优化

// 预保存钩子：同步索引字段
nonProjectServiceSchema.pre('save', function(next) {
  this.indexedVolunteerId = this.volunteerId;
  this.indexedServiceDate = this.serviceDate;
  this.indexedServiceType = this.serviceType;
  this.indexedIsActive = this.isActive;
  next();
});

// 静态方法：获取志愿者最新的序号
nonProjectServiceSchema.statics.getNextSequence = async function(volunteerId) {
  const lastRecord = await this.findOne(
    { volunteerId },
    { serviceId: 1 }
  ).sort({ createdAt: -1 });
  
  if (!lastRecord) {
    return 1; // 第一个记录
  }
  
  // 从 serviceId 中提取序号: NPS-PG-0001-001 -> 1
  const match = lastRecord.serviceId.match(/\d+$/);
  return match ? parseInt(match[0]) + 1 : 1;
};

export default mongoose.model('NonProjectService', nonProjectServiceSchema);