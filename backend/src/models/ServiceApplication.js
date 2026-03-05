// src/models/ServiceApplication.js
import mongoose from 'mongoose';

const serviceApplicationSchema = new mongoose.Schema({
  // 核心标识
  applicationId: {
    type: String,
    required: [true, '申请ID是必需的'],
    unique: true,
    trim: true,
    match: [/^APP-[A-Z]+-\d+-\d{3}$/, '申请ID格式: APP-{submitterId}-{seq}']
  },
  
  // 申请类型
  applicationType: {
    type: String,
    required: [true, '申请类型是必需的'],
    enum: {
      values: ['create', 'update', 'delete'],
      message: '申请类型必须是: create, update, delete'
    }
  },
  
  // 目标类型
  targetType: {
    type: String,
    required: [true, '目标类型是必需的'],
    enum: {
      values: ['NonProjectService'],
      message: '目标类型必须是: NonProjectService'
    },
    default: 'NonProjectService'
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
    trim: true,
    minlength: [2, '姓名至少2个字符'],
    maxlength: [50, '姓名最多50个字符']
  },
  
  // 变更详情
  changes: [{
    field: {
      type: String,
      required: [true, '变更字段名是必需的'],
      enum: ['serviceDate', 'serviceType', 'duration', 'description', 'isActive']
    },
    from: {
      type: mongoose.Schema.Types.Mixed,
      required: function() {
        // 对于update和delete类型，from是必需的
        return this.parent().applicationType !== 'create';
      }
    },
    to: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, '变更后值是必需的']
    },
    _id: false  // 不生成子文档_id
  }],
  
  // 目标记录ID（update/delete时需要）
  targetId: {
    type: String,
    required: function() {
      // create时不需要，update/delete时需要
      return this.applicationType !== 'create';
    },
    trim: true
  },
  
  // 提交人信息
  submittedBy: {
    id: {
      type: String,
      required: [true, '提交人ID是必需的'],
      trim: true
    },
    name: {
      type: String,
      required: [true, '提交人姓名是必需的'],
      trim: true
    },
    role: {
      type: String,
      required: [true, '提交人角色是必需的'],
      enum: ['user', 'b_admin', 'a_admin', 'admin']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    _id: false
  },
  
  // 状态
  status: {
    type: String,
    required: [true, '状态是必需的'],
    enum: {
      values: ['pending', 'approved', 'rejected', 'withdrawn'],
      message: '状态必须是: pending, approved, rejected, withdrawn'
    },
    default: 'pending'
  },

  // 软删除标记：个人中心默认仅展示 active 申请记录
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // 审核备注（审核员填写）
  reviewNotes: {
    type: String,
    trim: true,
    maxlength: [500, '审核备注最多500个字符']
  },
  
  // 过期时间（默认永不超时，但保留字段）
  expiresAt: {
    type: Date,
    default: null  // null表示永不过期
  },
  
  // 索引字段（优化查询性能）
  indexedStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  
  indexedVolunteerId: {
    type: String,
    required: true
  },
  
  indexedDate: {
    type: Date,
    default: Date.now
  }
  
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// 创建索引（提高查询性能）
serviceApplicationSchema.index({ indexedStatus: 1, createdAt: -1 }); // 待审核列表查询
serviceApplicationSchema.index({ indexedVolunteerId: 1, createdAt: -1 }); // 按志愿者查询
serviceApplicationSchema.index({ indexedDate: 1 }); // 按日期范围查询
serviceApplicationSchema.index({ 'submittedBy.id': 1, createdAt: -1 }); // 我的申请列表

// 预保存钩子：同步索引字段
serviceApplicationSchema.pre('save', function(next) {
  // 同步索引字段
  this.indexedStatus = this.status;
  this.indexedVolunteerId = this.volunteerId;
  this.indexedDate = this.createdAt || new Date();
  next();
});

export default mongoose.model('ServiceApplication', serviceApplicationSchema);
