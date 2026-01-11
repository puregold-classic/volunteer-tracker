import mongoose from 'mongoose';

const nonProjectServiceSchema = new mongoose.Schema({
  // 关联志愿者 ID (对应 Volunteer 模型中的 id 字段)
  volunteerId: {
    type: String,
    required: [true, '志愿者ID是必需的'],
    trim: true,
    ref: 'Volunteer'
  },
  // 服务名称
  serviceName: {
    type: String,
    required: [true, '服务名称是必需的'],
    trim: true
  },
  // 服务类别 (从 Volunteer 的 services 枚举中选择)
  category: {
    type: String,
    required: [true, '服务类别是必需的'],
    enum: ['翻译', '校对', '管理', '技术', '培训', '社区服务', '活动组织', '其他']
  },
  // 服务时长
  hours: {
    type: Number,
    required: [true, '服务时长是必需的'],
    min: [0.1, '时长至少为 0.1 小时']
  },
  // 服务日期
  serviceDate: {
    type: Date,
    required: [true, '服务日期是必需的'],
    default: Date.now
  },
  // 备注描述
  description: {
    type: String,
    trim: true,
    maxlength: [200, '描述最多200个字符']
  },
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引优化查询
nonProjectServiceSchema.index({ volunteerId: 1 });
nonProjectServiceSchema.index({ serviceDate: -1 });
nonProjectServiceSchema.index({ category: 1 });

const NonProjectService = mongoose.model('NonProjectService', nonProjectServiceSchema);

export default NonProjectService;