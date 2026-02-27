// src/utils/queryUtils.js
/**
 * 查询构建工具 - 统一处理API查询参数
 */
class QueryUtils {
  
  /**
   * 构建待审核申请的查询条件
   * @param {Object} filters - 筛选条件
   * @returns {Object} - MongoDB查询条件
   */
  static buildPendingApplicationsQuery(filters = {}) {
    const {
      volunteerId,
      volunteerName,
      applicationType,
      targetType,
      submittedBy,
      dateFrom,
      dateTo,
      search
    } = filters;
    
    const query = {
      status: 'pending', // 核心条件：只查询待审核的
      indexedStatus: 'pending' // 使用索引字段
    };
    
    // 志愿者ID筛选
    if (volunteerId) {
      query.volunteerId = volunteerId;
    }
    
    // 志愿者姓名筛选（模糊搜索）
    if (volunteerName) {
      query.volunteerName = { 
        $regex: volunteerName, 
        $options: 'i' // 不区分大小写
      };
    }
    
    // 申请类型筛选
    if (applicationType && ['create', 'update', 'delete'].includes(applicationType)) {
      query.applicationType = applicationType;
    }
    
    // 目标类型筛选
    if (targetType && ['NonProjectService'].includes(targetType)) {
      query.targetType = targetType;
    }
    
    // 提交人筛选
    if (submittedBy) {
      query['submittedBy.id'] = submittedBy;
    }
    
    // 日期范围筛选
    if (dateFrom || dateTo) {
      query.createdAt = {};
      
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // 包含结束日期的一整天
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }
    
    // 全文搜索（跨多个字段）
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { volunteerId: searchRegex },
        { volunteerName: searchRegex },
        { applicationId: searchRegex },
        { targetId: searchRegex },
        { 'submittedBy.name': searchRegex }
      ];
    }
    
    return query;
  }
  
  /**
   * 构建排序选项
   * @param {string} sortBy - 排序字段
   * @param {string} order - 排序方向
   * @returns {Object} - MongoDB排序选项
   */
  static buildSortOptions(sortBy = 'createdAt', order = 'asc') {
    const allowedSortFields = [
      'createdAt', 'updatedAt', 'volunteerName', 
      'applicationType', 'volunteerId'
    ];
    
    // 默认排序字段
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    // 排序方向
    const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;
    
    return { [sortField]: sortOrder };
  }
  
  /**
   * 构建分页选项
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {Object} - 分页选项
   */
  static buildPaginationOptions(page = 1, limit = 20) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20)); // 限制最大100条
    
    return {
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      page: pageNum
    };
  }
  
  /**
   * 格式化查询结果（添加分页信息）
   * @param {Array} data - 查询到的数据
   * @param {number} total - 总记录数
   * @param {Object} pagination - 分页参数
   * @returns {Object} - 格式化的响应数据
   */
  static formatPaginatedResponse(data, total, pagination) {
    const { page, limit } = pagination;
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }
  
  /**
   * 构建已处理申请的查询条件
   * @param {Object} filters - 筛选条件
   * @returns {Object} - MongoDB查询条件
   */
  static buildProcessedApplicationsQuery(filters = {}) {
    const {
      volunteerId,
      applicationType,
      reviewResult,
      reviewerId,
      dateFrom,
      dateTo
    } = filters;
    
    const query = {
      status: { $in: ['approved', 'rejected'] } // 已处理的申请
    };
    
    // 添加其他筛选条件...
    if (volunteerId) query.volunteerId = volunteerId;
    if (applicationType) query.applicationType = applicationType;
    if (reviewResult && ['approved', 'rejected'].includes(reviewResult)) {
      query.status = reviewResult;
    }
    
    // 日期范围筛选
    if (dateFrom || dateTo) {
      query.updatedAt = {};
      if (dateFrom) query.updatedAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.updatedAt.$lte = endDate;
      }
    }
    
    // 审核人筛选（需要关联查询AuditLog，这里先简单处理）
    if (reviewerId) {
      // 注意：这里需要联合查询，先留空
      // 实际实现需要关联AuditLog表
    }
    
    return query;
  }

  // 在 src/utils/queryUtils.js 中添加以下方法

  /**
   * 构建服务记录查询条件
   * @param {Object} filters - 筛选条件
   * @returns {Object} - MongoDB查询条件
   */
  static buildServiceRecordsQuery(filters = {}) {
  const {
      volunteerId,
      volunteerName,
      serviceType,
      serviceDateFrom,
      serviceDateTo,
      minDuration,
      maxDuration,
      region,
      isActive = true, // 默认只查询活跃记录
      search
  } = filters;
  
  const query = {
      isActive: isActive // 默认只显示未删除的记录
  };
  
  // 志愿者ID筛选
  if (volunteerId) {
      query.volunteerId = volunteerId;
  }
  
  // 志愿者姓名筛选（模糊搜索）
  if (volunteerName) {
      query.volunteerName = { 
      $regex: volunteerName, 
      $options: 'i' 
      };
  }
  
  // 服务类型筛选
  if (serviceType) {
      // 支持多个服务类型，用逗号分隔
      if (serviceType.includes(',')) {
      const types = serviceType.split(',').map(t => t.trim());
      query.serviceType = { $in: types };
      } else {
      query.serviceType = serviceType;
      }
  }
  
  // 服务日期范围筛选
  if (serviceDateFrom || serviceDateTo) {
      query.serviceDate = {};
      
      if (serviceDateFrom) {
      query.serviceDate.$gte = new Date(serviceDateFrom);
      }
      
      if (serviceDateTo) {
      const endDate = new Date(serviceDateTo);
      endDate.setHours(23, 59, 59, 999);
      query.serviceDate.$lte = endDate;
      }
  }
  
  // 服务时长范围筛选
  if (minDuration || maxDuration) {
      query.duration = {};
      
      if (minDuration) {
      query.duration.$gte = parseFloat(minDuration);
      }
      
      if (maxDuration) {
      query.duration.$lte = parseFloat(maxDuration);
      }
  }
  
  // 地区筛选（需要关联查询Volunteer，这里先记录，在Service中处理）
  if (region) {
      query['volunteerRegion'] = region; // 需要先通过聚合管道添加这个字段
  }
  
  // 全文搜索
  if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
      { volunteerId: searchRegex },
      { volunteerName: searchRegex },
      { serviceType: searchRegex },
      { description: searchRegex }
      ];
  }
  
  return query;
  }

  /**
   * 构建服务记录排序选项
   * @param {string} sortBy - 排序字段
   * @param {string} order - 排序方向
   * @returns {Object} - MongoDB排序选项
   */
  static buildServiceSortOptions(sortBy = 'serviceDate', order = 'desc') {
  const allowedSortFields = [
      'serviceDate', 'createdAt', 'updatedAt', 
      'duration', 'volunteerName', 'serviceType'
  ];
  
  // 默认排序字段
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'serviceDate';
  
  // 排序方向
  const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
  
  return { [sortField]: sortOrder };
  }

  /**
   * 构建服务记录聚合管道（用于复杂查询）
   * @param {Object} filters - 筛选条件
   * @returns {Array} - 聚合管道
   */
  static buildServiceAggregationPipeline(filters = {}) {
  const pipeline = [];
  
  // 阶段1: 基础匹配
  const matchStage = { $match: this.buildServiceRecordsQuery(filters) };
  pipeline.push(matchStage);
  
  // 阶段2: 关联志愿者表获取地区信息
  pipeline.push({
      $lookup: {
      from: 'volunteers',
      localField: 'volunteerId',
      foreignField: 'id',
      as: 'volunteerInfo'
      }
  });
  
  // 阶段3: 解构志愿者信息
  pipeline.push({
      $unwind: {
      path: '$volunteerInfo',
      preserveNullAndEmptyArrays: true // 如果没有志愿者信息，保留记录
      }
  });
  
  // 阶段4: 添加地区筛选
  if (filters.region) {
      pipeline.push({
      $match: {
          'volunteerInfo.region': filters.region
      }
      });
  }
  
  // 阶段5: 添加计算字段
  pipeline.push({
      $addFields: {
      volunteerRegion: '$volunteerInfo.region',
      volunteerStatus: '$volunteerInfo.status',
      volunteerActivityLevel: '$volunteerInfo.activityLevel'
      }
  });
  
  // 阶段6: 字段投影（控制返回字段）
  pipeline.push({
      $project: {
      serviceId: 1,
      volunteerId: 1,
      volunteerName: 1,
      serviceDate: 1,
      serviceType: 1,
      duration: 1,
      description: 1,
      auditHistory: 1,
      isActive: 1,
      createdAt: 1,
      updatedAt: 1,
      volunteerRegion: 1,
      volunteerStatus: 1,
      volunteerActivityLevel: 1,
      // 计算字段
      yearMonth: {
          $dateToString: {
          format: '%Y-%m',
          date: '$serviceDate'
          }
      },
      year: {
          $year: '$serviceDate'
      },
      month: {
          $month: '$serviceDate'
      },
      quarter: {
          $ceil: { $divide: [{ $month: '$serviceDate' }, 3] }
      }
      }
  });
  
  return pipeline;
  }

  // 在 src/utils/queryUtils.js 中添加以下方法

  /**
   * 构建审计日志查询条件
   * @param {Object} filters - 筛选条件
   * @returns {Object} - MongoDB查询条件
   */
  static buildAuditLogsQuery(filters = {}) {
    const {
      targetType,
      targetId,
      modifiedId,
      action,
      operatorId,
      operatorName,
      submitterId,
      submitterName,
      applicationType,
      reviewResult,
      dateFrom,
      dateTo,
      search
    } = filters;
    
    const query = {};
    
    // 目标类型筛选
    if (targetType) {
      query.targetType = targetType;
    }
    
    // 目标ID筛选
    if (targetId) {
      query.targetId = targetId;
    }
    
    // 修改记录ID筛选
    if (modifiedId) {
      if (modifiedId === 'null') {
        query.modifiedId = null;
      } else {
        query.modifiedId = modifiedId;
      }
    }
    
    // 操作类型筛选
    if (action) {
      // 支持多个操作类型，用逗号分隔
      if (action.includes(',')) {
        const actions = action.split(',').map(a => a.trim());
        query.action = { $in: actions };
      } else {
        query.action = action;
      }
    }
    
    // 操作人筛选
    if (operatorId) {
      query['operator.id'] = operatorId;
    }
    
    if (operatorName) {
      query['operator.name'] = { 
        $regex: operatorName, 
        $options: 'i' 
      };
    }
    
    // 提交人筛选
    if (submitterId) {
      query['submitter.id'] = submitterId;
    }
    
    if (submitterName) {
      query['submitter.name'] = { 
        $regex: submitterName, 
        $options: 'i' 
      };
    }
    
    // 申请类型筛选（从actionDetails中）
    if (applicationType) {
      query['actionDetails.applicationType'] = applicationType;
    }
    
    // 审核结果筛选（从actionDetails中）
    if (reviewResult) {
      query['actionDetails.reviewResult'] = reviewResult;
    }
    
    // 时间范围筛选
    if (dateFrom || dateTo) {
      query.timestamp = {};
      
      if (dateFrom) {
        query.timestamp.$gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDate;
      }
    }
    
    // 全文搜索
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { auditId: searchRegex },
        { targetId: searchRegex },
        { modifiedId: searchRegex },
        { 'operator.name': searchRegex },
        { 'submitter.name': searchRegex },
        { 'actionDetails.reviewNote': searchRegex }
      ];
    }
    
    return query;
  }

  /**
   * 构建审计日志排序选项
   * @param {string} sortBy - 排序字段
   * @param {string} order - 排序方向
   * @returns {Object} - MongoDB排序选项
   */
  static buildAuditSortOptions(sortBy = 'timestamp', order = 'desc') {
    const allowedSortFields = [
      'timestamp', 'auditId', 'targetId', 'modifiedId',
      'operator.id', 'submitter.id'
    ];
    
    // 默认排序字段
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
    
    // 排序方向
    const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
    
    return { [sortField]: sortOrder };
  }

  /**
   * 构建审计日志聚合管道
   * @param {Object} filters - 筛选条件
   * @returns {Array} - 聚合管道
   */
  static buildAuditAggregationPipeline(filters = {}) {
    const pipeline = [];
    
    // 阶段1: 基础匹配
    const matchStage = { $match: this.buildAuditLogsQuery(filters) };
    pipeline.push(matchStage);
    
    // 阶段2: 关联操作人信息（从Volunteers表）
    pipeline.push({
      $lookup: {
        from: 'volunteers',
        let: { operatorId: '$operator.id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$id', '$$operatorId'] }
            }
          },
          {
            $project: {
              id: 1,
              chineseName: 1,
              englishName: 1,
              role: 1,
              region: 1,
              status: 1
            }
          }
        ],
        as: 'operatorInfo'
      }
    });
    
    // 阶段3: 关联提交人信息
    pipeline.push({
      $lookup: {
        from: 'volunteers',
        let: { submitterId: '$submitter.id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$id', '$$submitterId'] }
            }
          },
          {
            $project: {
              id: 1,
              chineseName: 1,
              englishName: 1,
              role: 1,
              region: 1,
              status: 1
            }
          }
        ],
        as: 'submitterInfo'
      }
    });
    
    // 阶段4: 解构关联信息
    pipeline.push({
      $addFields: {
        operatorInfo: { $arrayElemAt: ['$operatorInfo', 0] },
        submitterInfo: { $arrayElemAt: ['$submitterInfo', 0] }
      }
    });
    
    // 阶段5: 字段投影（控制返回字段）
    pipeline.push({
      $project: {
        auditId: 1,
        targetType: 1,
        targetId: 1,
        action: 1,
        actionDetails: 1,
        modifiedId: 1,
        changes: 1,
        operator: {
          id: '$operator.id',
          name: '$operator.name',
          role: '$operator.role',
          details: '$operatorInfo'
        },
        submitter: {
          id: '$submitter.id',
          name: '$submitter.name',
          role: '$submitter.role',
          details: '$submitterInfo'
        },
        timestamp: 1,
        indexedDate: 1,
        indexedOperatorId: 1,
        indexedTargetId: 1,
        indexedModifiedId: 1,
        // 计算字段
        hasChanges: { $gt: [{ $size: { $ifNull: ['$changes', []] } }, 0] },
        changeCount: { $size: { $ifNull: ['$changes', []] } },
        changeSummary: {
          $cond: {
            if: { $gt: [{ $size: { $ifNull: ['$changes', []] } }, 0] },
            then: {
              $concat: [
                '变更了 ',
                { $toString: { $size: { $ifNull: ['$changes', []] } } },
                ' 个字段'
              ]
            },
            else: '无数据变更'
          }
        }
      }
    });
    
    return pipeline;
  }
}

export default QueryUtils;
