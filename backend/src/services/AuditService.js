// src/services/AuditService.js
import AuditLog from '../models/AuditLog.js';
import Volunteer from '../models/Volunteer.js';
import QueryUtils from '../utils/queryUtils.js';

/**
 * 审计日志业务逻辑服务
 */
class AuditService {
  
  /**
   * 获取审计日志列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {Object} sortOptions - 排序选项
   * @returns {Promise<Object>} - 审计日志列表和分页信息
   */
  static async getAuditLogs(filters = {}, pagination = {}, sortOptions = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { sortBy = 'timestamp', order = 'desc' } = sortOptions;
      
      // 构建聚合管道
      const pipeline = QueryUtils.buildAuditAggregationPipeline(filters);
      
      // 添加排序
      const sortStage = { $sort: QueryUtils.buildAuditSortOptions(sortBy, order) };
      pipeline.push(sortStage);
      
      // 添加分页
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
      
      // 执行聚合查询
      const auditLogs = await AuditLog.aggregate(pipeline);
      
      // 获取总记录数
      const countPipeline = QueryUtils.buildAuditAggregationPipeline(filters);
      countPipeline.push({ $count: 'total' });
      
      const countResult = await AuditLog.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        auditLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
      
    } catch (error) {
      console.error('获取审计日志列表失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取审计日志详情
   * @param {string} auditId - 审计日志ID
   * @returns {Promise<Object>} - 审计日志详情
   */
  static async getAuditLogById(auditId) {
    try {
      // 使用聚合管道获取详细信息
      const pipeline = [
        {
          $match: { auditId }
        },
        {
          $lookup: {
            from: 'volunteers',
            let: { operatorId: '$operator.id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$id', '$$operatorId'] }
                }
              }
            ],
            as: 'operatorInfo'
          }
        },
        {
          $lookup: {
            from: 'volunteers',
            let: { submitterId: '$submitter.id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$id', '$$submitterId'] }
                }
              }
            ],
            as: 'submitterInfo'
          }
        },
        {
          $lookup: {
            from: 'serviceapplications',
            let: { targetId: '$targetId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$applicationId', '$$targetId'] }
                }
              },
              {
                $project: {
                  applicationId: 1,
                  applicationType: 1,
                  volunteerId: 1,
                  volunteerName: 1,
                  status: 1,
                  createdAt: 1
                }
              }
            ],
            as: 'relatedApplication'
          }
        },
        {
          $lookup: {
            from: 'nonprojectservices',
            let: { modifiedId: '$modifiedId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$serviceId', '$$modifiedId'] }
                }
              },
              {
                $project: {
                  serviceId: 1,
                  serviceDate: 1,
                  serviceType: 1,
                  duration: 1,
                  description: 1,
                  isActive: 1
                }
              }
            ],
            as: 'relatedService'
          }
        },
        {
          $addFields: {
            operatorInfo: { $arrayElemAt: ['$operatorInfo', 0] },
            submitterInfo: { $arrayElemAt: ['$submitterInfo', 0] },
            relatedApplication: { $arrayElemAt: ['$relatedApplication', 0] },
            relatedService: { $arrayElemAt: ['$relatedService', 0] }
          }
        },
        {
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
            relatedApplication: 1,
            relatedService: 1,
            changeAnalysis: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ['$changes', []] } }, 0] },
                then: {
                  fields: {
                    $map: {
                      input: '$changes',
                      as: 'change',
                      in: '$$change.field'
                    }
                  },
                  fromValues: {
                    $map: {
                      input: '$changes',
                      as: 'change',
                      in: '$$change.from'
                    }
                  },
                  toValues: {
                    $map: {
                      input: '$changes',
                      as: 'change',
                      in: '$$change.to'
                    }
                  }
                },
                else: null
              }
            }
          }
        }
      ];
      
      const result = await AuditLog.aggregate(pipeline);
      
      if (result.length === 0) {
        throw new Error(`审计日志不存在: ${auditId}`);
      }
      
      return result[0];
      
    } catch (error) {
      console.error('获取审计日志详情失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取目标的审计历史
   * @param {string} targetType - 目标类型
   * @param {string} targetId - 目标ID
   * @returns {Promise<Array>} - 目标的审计历史
   */
  static async getTargetAuditHistory(targetType, targetId) {
    try {
      // 验证目标类型
      const validTargetTypes = ['ServiceApplication', 'NonProjectService', 'Volunteer'];
      if (!validTargetTypes.includes(targetType)) {
        throw new Error(`无效的目标类型: ${targetType}`);
      }
      
      const pipeline = [
        {
          $match: {
            $or: [
              { targetType, targetId },
              { modifiedId: targetId }
            ]
          }
        },
        {
          $sort: { timestamp: -1 }
        },
        {
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
                  role: 1
                }
              }
            ],
            as: 'operatorInfo'
          }
        },
        {
          $addFields: {
            operatorInfo: { $arrayElemAt: ['$operatorInfo', 0] }
          }
        },
        {
          $project: {
            auditId: 1,
            targetType: 1,
            targetId: 1,
            action: 1,
            actionDetails: 1,
            modifiedId: 1,
            operator: {
              id: '$operator.id',
              name: '$operator.name',
              role: '$operator.role',
              details: '$operatorInfo'
            },
            timestamp: 1,
            // 根据action类型生成描述
            description: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$action', 'application_review'] },
                    then: {
                      $concat: [
                        '审核了申请 ',
                        '$targetId',
                        '，结果: ',
                        '$actionDetails.reviewResult'
                      ]
                    }
                  },
                  {
                    case: { $eq: ['$action', 'application_withdraw'] },
                    then: { $concat: ['撤销了申请 ', '$targetId'] }
                  },
                  {
                    case: { $eq: ['$action', 'application_reopen'] },
                    then: { $concat: ['重新开启了申请 ', '$targetId'] }
                  },
                  {
                    case: { $eq: ['$action', 'review_withdraw'] },
                    then: { $concat: ['撤回了审核 ', '$targetId'] }
                  }
                ],
                default: { $concat: ['执行了操作: ', '$action'] }
              }
            }
          }
        }
      ];
      
      const auditHistory = await AuditLog.aggregate(pipeline);
      
      return {
        targetType,
        targetId,
        history: auditHistory,
        count: auditHistory.length,
        latest: auditHistory.length > 0 ? auditHistory[0].timestamp : null,
        earliest: auditHistory.length > 0 ? auditHistory[auditHistory.length - 1].timestamp : null
      };
      
    } catch (error) {
      console.error('获取目标审计历史失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取审计统计总览
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Object>} - 审计统计数据
   */
  static async getAuditStatistics(filters = {}) {
    try {
      // 构建基础查询条件
      const query = QueryUtils.buildAuditLogsQuery(filters);
      
      const pipeline = [
        { $match: query },
        {
          $facet: {
            // 总体统计
            summary: [
              {
                $group: {
                  _id: null,
                  totalLogs: { $sum: 1 },
                  totalOperators: { $addToSet: '$operator.id' },
                  totalTargets: { $addToSet: '$targetId' },
                  earliestDate: { $min: '$timestamp' },
                  latestDate: { $max: '$timestamp' }
                }
              },
              {
                $project: {
                  totalLogs: 1,
                  totalOperators: { $size: '$totalOperators' },
                  totalTargets: { $size: '$totalTargets' },
                  earliestDate: 1,
                  latestDate: 1,
                  dateRange: {
                    $cond: {
                      if: { $and: ['$earliestDate', '$latestDate'] },
                      then: {
                        days: {
                          $divide: [
                            { $subtract: ['$latestDate', '$earliestDate'] },
                            1000 * 60 * 60 * 24
                          ]
                        }
                      },
                      else: null
                    }
                  }
                }
              }
            ],
            
            // 按操作类型统计
            byAction: [
              {
                $group: {
                  _id: '$action',
                  count: { $sum: 1 },
                  lastActivity: { $max: '$timestamp' }
                }
              },
              { $sort: { count: -1 } }
            ],
            
            // 按操作人统计
            byOperator: [
              {
                $group: {
                  _id: '$operator.id',
                  operatorName: { $first: '$operator.name' },
                  operatorRole: { $first: '$operator.role' },
                  count: { $sum: 1 },
                  actions: { $addToSet: '$action' },
                  lastActivity: { $max: '$timestamp' },
                  firstActivity: { $min: '$timestamp' }
                }
              },
              {
                $project: {
                  operatorName: 1,
                  operatorRole: 1,
                  count: 1,
                  actionCount: { $size: '$actions' },
                  lastActivity: 1,
                  firstActivity: 1,
                  activityDays: {
                    $cond: {
                      if: { $and: ['$firstActivity', '$lastActivity'] },
                      then: {
                        $ceil: {
                          $divide: [
                            { $subtract: ['$lastActivity', '$firstActivity'] },
                            1000 * 60 * 60 * 24
                          ]
                        }
                      },
                      else: null
                    }
                  }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            
            // 按目标类型统计
            byTargetType: [
              {
                $group: {
                  _id: '$targetType',
                  count: { $sum: 1 },
                  uniqueTargets: { $addToSet: '$targetId' }
                }
              },
              {
                $project: {
                  count: 1,
                  uniqueTargets: { $size: '$uniqueTargets' }
                }
              },
              { $sort: { count: -1 } }
            ],
            
            // 按时间统计（按小时）
            byHour: [
              {
                $group: {
                  _id: { $hour: '$timestamp' },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            
            // 按时间统计（按天）
            byDay: [
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$timestamp'
                    }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: -1 } },
              { $limit: 30 } // 最近30天
            ],
            
            // 按时间统计（按月）
            byMonth: [
              {
                $group: {
                  _id: {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
              { $limit: 12 } // 最近12个月
            ],
            
            // 审核结果统计（针对审核操作）
            byReviewResult: [
              {
                $match: {
                  action: 'application_review'
                }
              },
              {
                $group: {
                  _id: '$actionDetails.reviewResult',
                  count: { $sum: 1 },
                  avgProcessingTime: {
                    $avg: {
                      $cond: [
                        { $gt: ['$relatedApplication', null] },
                        {
                          $divide: [
                            { $subtract: ['$timestamp', '$relatedApplication.createdAt'] },
                            1000 * 60 * 60 // 转换为小时
                          ]
                        },
                        null
                      ]
                    }
                  }
                }
              }
            ],
            
            // 异常统计（修改ID为null的审计）
            anomalies: [
              {
                $match: {
                  modifiedId: null,
                  'actionDetails.applicationType': 'create'
                }
              },
              {
                $group: {
                  _id: '$actionDetails.reviewResult',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ];
      
      const result = await AuditLog.aggregate(pipeline);
      
      // 格式化统计结果
      return {
        summary: result[0].summary[0] || {},
        byAction: this.formatStatsArray(result[0].byAction),
        byOperator: result[0].byOperator,
        byTargetType: this.formatStatsArray(result[0].byTargetType),
        byHour: this.formatTimeStats(result[0].byHour, 'hour'),
        byDay: this.formatTimeStats(result[0].byDay, 'day'),
        byMonth: this.formatTimeStats(result[0].byMonth, 'month'),
        byReviewResult: this.formatStatsArray(result[0].byReviewResult),
        anomalies: this.formatStatsArray(result[0].anomalies),
        generatedAt: new Date().toISOString(),
        filters
      };
      
    } catch (error) {
      console.error('获取审计统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取操作人审计统计
   * @param {string} operatorId - 操作人ID
   * @returns {Promise<Object>} - 操作人审计统计
   */
  static async getOperatorAuditStatistics(operatorId) {
    try {
      // 验证操作人是否存在
      const operator = await Volunteer.findOne({ id: operatorId });
      
      if (!operator) {
        throw new Error(`操作人不存在: ${operatorId}`);
      }
      
      const query = { 'operator.id': operatorId };
      
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'serviceapplications',
            let: { targetId: '$targetId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$applicationId', '$$targetId'] }
                }
              }
            ],
            as: 'relatedApplications'
          }
        },
        {
          $facet: {
            // 总体统计
            summary: [
              {
                $group: {
                  _id: null,
                  totalLogs: { $sum: 1 },
                  totalActions: { $addToSet: '$action' },
                  totalTargets: { $addToSet: '$targetId' },
                  firstActivity: { $min: '$timestamp' },
                  lastActivity: { $max: '$timestamp' },
                  avgChangesPerAction: { $avg: { $size: { $ifNull: ['$changes', []] } } }
                }
              },
              {
                $project: {
                  totalLogs: 1,
                  totalActions: { $size: '$totalActions' },
                  totalTargets: { $size: '$totalTargets' },
                  firstActivity: 1,
                  lastActivity: 1,
                  activitySpanDays: {
                    $cond: {
                      if: { $and: ['$firstActivity', '$lastActivity'] },
                      then: {
                        $ceil: {
                          $divide: [
                            { $subtract: ['$lastActivity', '$firstActivity'] },
                            1000 * 60 * 60 * 24
                          ]
                        }
                      },
                      else: null
                    }
                  },
                  avgChangesPerAction: { $round: ['$avgChangesPerAction', 2] }
                }
              }
            ],
            
            // 按操作类型统计
            byAction: [
              {
                $group: {
                  _id: '$action',
                  count: { $sum: 1 },
                  lastPerformed: { $max: '$timestamp' },
                  avgProcessingTime: {
                    $avg: {
                      $cond: [
                        { 
                          $and: [
                            { $eq: ['$action', 'application_review'] },
                            { $gt: [{ $size: '$relatedApplications' }, 0] }
                          ]
                        },
                        {
                          $divide: [
                            { 
                              $subtract: [
                                '$timestamp', 
                                { $arrayElemAt: ['$relatedApplications.createdAt', 0] }
                              ]
                            },
                            1000 * 60 // 转换为分钟
                          ]
                        },
                        null
                      ]
                    }
                  }
                }
              },
              { $sort: { count: -1 } }
            ],
            
            // 按时间统计（最近30天）
            recentActivity: [
              {
                $match: {
                  timestamp: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$timestamp'
                    }
                  },
                  count: { $sum: 1 },
                  actions: { $push: '$action' }
                }
              },
              { $sort: { _id: -1 } }
            ],
            
            // 按目标类型统计
            byTargetType: [
              {
                $group: {
                  _id: '$targetType',
                  count: { $sum: 1 },
                  lastActivity: { $max: '$timestamp' }
                }
              },
              { $sort: { count: -1 } }
            ],
            
            // 审核操作统计
            reviewStats: [
              {
                $match: {
                  action: 'application_review'
                }
              },
              {
                $group: {
                  _id: '$actionDetails.reviewResult',
                  count: { $sum: 1 },
                  avgNotesLength: {
                    $avg: {
                      $strLenCP: { $ifNull: ['$actionDetails.reviewNote', ''] }
                    }
                  }
                }
              }
            ],
            
            // 最常操作的目标
            frequentTargets: [
              {
                $group: {
                  _id: '$targetId',
                  count: { $sum: 1 },
                  actions: { $push: '$action' },
                  lastInteraction: { $max: '$timestamp' }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ]
          }
        }
      ];
      
      const result = await AuditLog.aggregate(pipeline);
      
      return {
        operator: {
          id: operator.id,
          name: operator.chineseName,
          role: operator.role,
          region: operator.region
        },
        summary: result[0].summary[0] || {},
        byAction: this.formatStatsArray(result[0].byAction),
        recentActivity: this.formatTimeStats(result[0].recentActivity, 'day'),
        byTargetType: this.formatStatsArray(result[0].byTargetType),
        reviewStats: this.formatStatsArray(result[0].reviewStats),
        frequentTargets: result[0].frequentTargets,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('获取操作人审计统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取审计时间线分析
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Object>} - 时间线分析数据
   */
  static async getAuditTimelineAnalysis(filters = {}) {
    try {
      const query = QueryUtils.buildAuditLogsQuery(filters);
      
      const pipeline = [
        { $match: query },
        {
          $sort: { timestamp: 1 }
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$timestamp'
                }
              },
              hour: { $hour: '$timestamp' }
            },
            logs: { $push: '$$ROOT' },
            count: { $sum: 1 },
            operators: { $addToSet: '$operator.id' },
            actions: { $addToSet: '$action' }
          }
        },
        {
          $sort: { '_id.date': 1, '_id.hour': 1 }
        },
        {
          $group: {
            _id: '$_id.date',
            hourlyData: {
              $push: {
                hour: '$_id.hour',
                count: '$count',
                logs: '$logs',
                operatorCount: { $size: '$operators' },
                actionCount: { $size: '$actions' }
              }
            },
            dailyCount: { $sum: '$count' },
            dailyOperators: { $addToSet: '$operators' }
          }
        },
        {
          $project: {
            date: '$_id',
            hourlyData: 1,
            dailyCount: 1,
            dailyOperatorCount: { $size: { $reduce: {
              input: '$dailyOperators',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] }
            }}},
            peakHour: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: '$hourlyData',
                    as: 'hour',
                    cond: { $eq: ['$$hour.count', { $max: '$hourlyData.count' }] }
                  }
                },
                0
              ]
            }
          }
        },
        { $sort: { date: 1 } },
        { $limit: 30 } // 最近30天
      ];
      
      const timelineData = await AuditLog.aggregate(pipeline);
      
      // 计算统计信息
      const stats = {
        totalDays: timelineData.length,
        totalLogs: timelineData.reduce((sum, day) => sum + day.dailyCount, 0),
        avgLogsPerDay: timelineData.length > 0 
          ? timelineData.reduce((sum, day) => sum + day.dailyCount, 0) / timelineData.length 
          : 0,
        busiestDay: timelineData.length > 0 
          ? timelineData.reduce((max, day) => day.dailyCount > max.dailyCount ? day : max, timelineData[0])
          : null,
        quietestDay: timelineData.length > 0 
          ? timelineData.reduce((min, day) => day.dailyCount < min.dailyCount ? day : min, timelineData[0])
          : null,
        peakHours: timelineData
          .map(day => ({
            date: day.date,
            hour: day.peakHour?.hour,
            count: day.peakHour?.count
          }))
          .filter(day => day.hour !== undefined)
      };
      
      return {
        timeline: timelineData,
        statistics: stats,
        generatedAt: new Date().toISOString(),
        filters
      };
      
    } catch (error) {
      console.error('获取审计时间线分析失败:', error);
      throw error;
    }
  }
  
  /**
   * 导出审计日志
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Array>} - 导出的审计日志数据
   */
  static async exportAuditLogs(filters = {}) {
    try {
      // 构建聚合管道，包含所有必要字段
      const pipeline = QueryUtils.buildAuditAggregationPipeline(filters);
      
      // 移除分页限制，获取所有数据
      pipeline.push({
        $project: {
          _id: 0,
          auditId: 1,
          targetType: 1,
          targetId: 1,
          action: 1,
          'actionDetails.applicationType': 1,
          'actionDetails.reviewResult': 1,
          'actionDetails.reviewNote': 1,
          modifiedId: 1,
          changeCount: 1,
          'operator.id': 1,
          'operator.name': 1,
          'operator.role': 1,
          'operator.details.chineseName': 1,
          'operator.details.region': 1,
          'submitter.id': 1,
          'submitter.name': 1,
          'submitter.role': 1,
          timestamp: 1,
          changeSummary: 1
        }
      });
      
      const auditLogs = await AuditLog.aggregate(pipeline);
      
      // 格式化导出数据
      const exportData = auditLogs.map(log => ({
        '审计ID': log.auditId,
        '目标类型': log.targetType,
        '目标ID': log.targetId,
        '操作类型': log.action,
        '申请类型': log.actionDetails?.applicationType || '',
        '审核结果': log.actionDetails?.reviewResult || '',
        '审核意见': log.actionDetails?.reviewNote || '',
        '修改记录ID': log.modifiedId || '',
        '变更数量': log.changeCount,
        '操作人ID': log.operator.id,
        '操作人姓名': log.operator.name,
        '操作人角色': log.operator.role,
        '操作人中文名': log.operator.details?.chineseName || '',
        '操作人地区': log.operator.details?.region || '',
        '提交人ID': log.submitter.id,
        '提交人姓名': log.submitter.name,
        '提交人角色': log.submitter.role,
        '操作时间': new Date(log.timestamp).toLocaleString('zh-CN'),
        '变更摘要': log.changeSummary,
        '导出时间': new Date().toLocaleString('zh-CN')
      }));
      
      return {
        data: exportData,
        count: exportData.length,
        generatedAt: new Date().toISOString(),
        filters,
        format: 'CSV-ready'
      };
      
    } catch (error) {
      console.error('导出审计日志失败:', error);
      throw error;
    }
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 格式化统计数组
   * @private
   */
  static formatStatsArray(statsArray) {
    return statsArray.reduce((acc, item) => {
      const key = item._id || 'unknown';
      acc[key] = {
        count: item.count,
        ...item
      };
      delete acc[key]._id;
      return acc;
    }, {});
  }
  
  /**
   * 格式化时间统计
   * @private
   */
  static formatTimeStats(statsArray, type = 'day') {
    return statsArray.map(item => {
      let period;
      
      if (type === 'hour') {
        period = `${item._id}:00`;
      } else if (type === 'day') {
        period = item._id;
      } else if (type === 'month') {
        const month = item._id.month.toString().padStart(2, '0');
        period = `${item._id.year}-${month}`;
      } else {
        period = item._id.toString();
      }
      
      return {
        period,
        count: item.count,
        ...item
      };
    });
  }
}

export default AuditService;
