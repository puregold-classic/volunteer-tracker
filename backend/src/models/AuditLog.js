// src/models/AuditLog.js
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  // 核心标识
  auditId: {
    type: String,
    required: [true, '审计ID是必需的'],
    unique: true,
    trim: true,
    match: [/^AUDIT-[A-Z]+-\d+-\d{3}$/, '审计ID格式: AUDIT-{reviewerId}-{seq}']
  },
  
  // 审计目标
  targetType: {
    type: String,
    required: [true, '目标类型是必需的'],
    enum: ['ServiceApplication']
  },
  
  targetId: {
    type: String,
    required: [true, '目标ID是必需的'],
    trim: true
  },
  
  // 操作类型
  action: {
    type: String,
    required: [true, '操作类型是必需的'],
    enum: {
      values: ['application_review', 'application_withdraw', 'system_cleanup'],
      message: '操作类型必须是: application_review, application_withdraw, system_cleanup'
    }
  },
  
  // 操作详情
  actionDetails: {
    applicationType: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete']
    },
    reviewResult: {
      type: String,
      required: true,
      enum: ['approved', 'rejected']
    },
    reviewNote: {
      type: String,
      required: [true, '审核备注是必需的'],
      trim: true,
      maxlength: [500, '审核备注最多500个字符']
    }
  },
  
  // 关联的正式记录ID
  modifiedId: {
    type: String,
    default: null  // create被拒时为null
  },
  
  // 变更详情（复制自ServiceApplication.changes）
  changes: [{
    field: {
      type: String,
      required: true
    },
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    _id: false
  }],
  
  // 操作人信息
  operator: {
    id: {
      type: String,
      required: [true, '操作人ID是必需的']
    },
    name: {
      type: String,
      required: [true, '操作人姓名是必需的']
    },
    role: {
      type: String,
      required: [true, '操作人角色是必需的'],
      enum: ['user', 'admin', 'c_admin']
    },
    _id: false
  },
  
  // 提交人信息（申请的原提交人）
  submitter: {
    id: {
      type: String,
      required: [true, '提交人ID是必需的']
    },
    name: {
      type: String,
      required: [true, '提交人姓名是必需的']
    },
    role: {
      type: String,
      required: [true, '提交人角色是必需的'],
      enum: ['user', 'admin', 'c_admin']
    },
    _id: false
  },
  
  // 索引字段
  indexedDate: {
    type: Date,
    default: Date.now
  },
  
  indexedOperatorId: {
    type: String,
    required: true
  },
  
  indexedTargetId: {
    type: String,
    required: true
  },
  
  indexedModifiedId: {
    type: String,
    default: null
  }
  
}, {
  timestamps: { createdAt: 'timestamp' }  // 使用timestamp作为创建时间字段
});

// 创建索引
auditLogSchema.index({ indexedDate: -1 }); // 按时间倒序查询
auditLogSchema.index({ indexedOperatorId: 1, indexedDate: -1 }); // 按操作人查询
auditLogSchema.index({ indexedTargetId: 1 }); // 按目标ID查询
auditLogSchema.index({ indexedModifiedId: 1 }); // 按修改的记录ID查询
auditLogSchema.index({ 
  'actionDetails.applicationType': 1,
  'actionDetails.reviewResult': 1,
  indexedDate: -1 
}); // 按类型和结果查询

// 预保存钩子：同步索引字段
auditLogSchema.pre('save', function(next) {
  this.indexedDate = this.timestamp || new Date();
  this.indexedOperatorId = this.operator.id;
  this.indexedTargetId = this.targetId;
  this.indexedModifiedId = this.modifiedId;
  next();
});

// 静态方法：获取审核员最新的序号
auditLogSchema.statics.getNextSequence = async function(reviewerId) {
  const lastAudit = await this.findOne(
    { 'operator.id': reviewerId },
    { auditId: 1 }
  ).sort({ timestamp: -1 });
  
  if (!lastAudit) {
    return 1; // 第一个审计记录
  }
  
  // 从 auditId 中提取序号: AUDIT-PG-0003-001 -> 1
  const match = lastAudit.auditId.match(/\d+$/);
  return match ? parseInt(match[0]) + 1 : 1;
};

export default mongoose.model('AuditLog', auditLogSchema);