// src/services/ServiceService.js
import NonProjectService from '../models/NonProjectService.js';
import Volunteer from '../models/Volunteer.js';
import QueryUtils from '../utils/queryUtils.js';

/**
 * 服务记录业务逻辑服务
 */
class ServiceService {
  
  /**
   * 获取服务记录列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {Object} sortOptions - 排序选项
   * @returns {Promise<Object>} - 服务记录列表和分页信息
   */
  static async getServiceRecords(filters = {}, pagination = {}, sortOptions = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { sortBy = 'serviceDate', order = 'desc' } = sortOptions;
      
      // 构建查询条件
      const query = QueryUtils.buildServiceRecordsQuery(filters);
      
      // 构建聚合管道
      const pipeline = QueryUtils.buildServiceAggregationPipeline(filters);
      
      // 添加排序
      const sortStage = { $sort: QueryUtils.buildServiceSortOptions(sortBy, order) };
      pipeline.push(sortStage);
      
      // 添加分页
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
      
      // 执行聚合查询
      const services = await NonProjectService.aggregate(pipeline);
      
      // 获取总记录数（需要单独的计数管道）
      const countPipeline = QueryUtils.buildServiceAggregationPipeline(filters);
      countPipeline.push({ $count: 'total' });
      
      const countResult = await NonProjectService.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        services,
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
      console.error('获取服务记录列表失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取服务记录详情
   * @param {string} serviceId - 服务记录ID
   * @returns {Promise<Object>} - 服务记录详情
   */
  static async getServiceRecordById(serviceId) {
    try {
      // 使用聚合管道获取详细信息
      const pipeline = [
        {
          $match: { 
            serviceId,
            isActive: true 
          }
        },
        {
          $lookup: {
            from: 'volunteers',
            localField: 'volunteerId',
            foreignField: 'id',
            as: 'volunteerInfo'
          }
        },
        {
          $unwind: {
            path: '$volunteerInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'auditlogs',
            let: { serviceId: '$serviceId' },
            pipeline: [
              {
                $match: {
                  $expr: { 
                    $or: [
                      { $eq: ['$modifiedId', '$$serviceId'] },
                      { $eq: ['$targetId', '$$serviceId'] }
                    ]
                  }
                }
              },
              { $sort: { timestamp: -1 } }
            ],
            as: 'relatedAuditLogs'
          }
        },
        {
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
            volunteerInfo: {
              id: '$volunteerInfo.id',
              chineseName: '$volunteerInfo.chineseName',
              englishName: '$volunteerInfo.englishName',
              region: '$volunteerInfo.region',
              status: '$volunteerInfo.status',
              activityLevel: '$volunteerInfo.activityLevel',
              nonProjectHours: '$volunteerInfo.nonProjectHours',
              nonProjectCount: '$volunteerInfo.nonProjectCount'
            },
            relatedAuditLogs: {
              $map: {
                input: '$relatedAuditLogs',
                as: 'log',
                in: {
                  auditId: '$$log.auditId',
                  action: '$$log.action',
                  actionDetails: '$$log.actionDetails',
                  operator: '$$log.operator',
                  timestamp: '$$log.timestamp'
                }
              }
            }
          }
        }
      ];
      
      const result = await NonProjectService.aggregate(pipeline);
      
      if (result.length === 0) {
        throw new Error(`服务记录不存在: ${serviceId}`);
      }
      
      return result[0];
      
    } catch (error) {
      console.error('获取服务记录详情失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取志愿者的服务记录
   * @param {string} volunteerId - 志愿者ID
   * @param {Object} filters - 额外筛选条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise<Object>} - 志愿者的服务记录
   */
  static async getServicesByVolunteer(volunteerId, filters = {}, pagination = {}) {
    try {
      // 验证志愿者是否存在
      const volunteer = await Volunteer.findOne({ id: volunteerId });
      
      if (!volunteer) {
        throw new Error(`志愿者不存在: ${volunteerId}`);
      }
      
      // 添加志愿者ID筛选
      const combinedFilters = {
        ...filters,
        volunteerId
      };
      
      return await this.getServiceRecords(combinedFilters, pagination);
      
    } catch (error) {
      console.error('获取志愿者服务记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 搜索服务记录
   * @param {string} searchTerm - 搜索关键词
   * @param {Object} filters - 额外筛选条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise<Object>} - 搜索结果
   */
  static async searchServices(searchTerm, filters = {}, pagination = {}) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }
      
      // 添加搜索条件
      const combinedFilters = {
        ...filters,
        search: searchTerm.trim()
      };
      
      return await this.getServiceRecords(combinedFilters, pagination);
      
    } catch (error) {
      console.error('搜索服务记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取服务记录统计信息
   * @param {Object} filters - 筛选条件
   * @returns {Promise<Object>} - 统计信息
   */
  static async getServiceStatistics(filters = {}) {
    try {
      // 构建基础查询条件
      const query = QueryUtils.buildServiceRecordsQuery(filters);
      
      // 聚合统计管道
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'volunteers',
            localField: 'volunteerId',
            foreignField: 'id',
            as: 'volunteerInfo'
          }
        },
        { $unwind: '$volunteerInfo' },
        {
          $facet: {
            // 总体统计
            summary: [
              {
                $group: {
                  _id: null,
                  totalRecords: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' },
                  minDuration: { $min: '$duration' },
                  maxDuration: { $max: '$duration' },
                  earliestDate: { $min: '$serviceDate' },
                  latestDate: { $max: '$serviceDate' }
                }
              }
            ],
            
            // 按服务类型统计
            byServiceType: [
              {
                $group: {
                  _id: '$serviceType',
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' }
                }
              },
              { $sort: { count: -1 } }
            ],
            
            // 按志愿者统计
            byVolunteer: [
              {
                $group: {
                  _id: '$volunteerId',
                  volunteerName: { $first: '$volunteerName' },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' }
                }
              },
              { $sort: { totalHours: -1 } },
              { $limit: 10 } // 只显示前10名
            ],
            
            // 按地区统计
            byRegion: [
              {
                $group: {
                  _id: '$volunteerInfo.region',
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { totalHours: -1 } }
            ],
            
            // 按时间统计（按月）
            byMonth: [
              {
                $group: {
                  _id: {
                    year: { $year: '$serviceDate' },
                    month: { $month: '$serviceDate' }
                  },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
              { $limit: 12 } // 最近12个月
            ],
            
            // 按时间统计（按季度）
            byQuarter: [
              {
                $addFields: {
                  quarter: {
                    $ceil: { $divide: [{ $month: '$serviceDate' }, 3] }
                  }
                }
              },
              {
                $group: {
                  _id: {
                    year: { $year: '$serviceDate' },
                    quarter: '$quarter'
                  },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { '_id.year': 1, '_id.quarter': 1 } },
              { $limit: 8 } // 最近8个季度
            ],
            
            // 按活跃度统计
            byActivityLevel: [
              {
                $group: {
                  _id: '$volunteerInfo.activityLevel',
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  volunteerCount: { $addToSet: '$volunteerId' }
                }
              },
              {
                $project: {
                  count: 1,
                  totalHours: 1,
                  volunteerCount: { $size: '$volunteerCount' }
                }
              }
            ]
          }
        }
      ];
      
      const result = await NonProjectService.aggregate(pipeline);
      
      // 格式化统计结果
      return {
        summary: result[0].summary[0] || {},
        byServiceType: this.formatStatsArray(result[0].byServiceType),
        byVolunteer: result[0].byVolunteer,
        byRegion: result[0].byRegion,
        byMonth: this.formatTimeStats(result[0].byMonth, 'month'),
        byQuarter: this.formatTimeStats(result[0].byQuarter, 'quarter'),
        byActivityLevel: this.formatStatsArray(result[0].byActivityLevel),
        generatedAt: new Date().toISOString(),
        filters: filters
      };
      
    } catch (error) {
      console.error('获取服务统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取志愿者服务统计
   * @param {string} volunteerId - 志愿者ID
   * @returns {Promise<Object>} - 志愿者服务统计
   */
  static async getVolunteerServiceStatistics(volunteerId) {
    try {
      // 验证志愿者是否存在
      const volunteer = await Volunteer.findOne({ id: volunteerId });
      
      if (!volunteer) {
        throw new Error(`志愿者不存在: ${volunteerId}`);
      }
      
      const query = { volunteerId, isActive: true };
      
      const pipeline = [
        { $match: query },
        {
          $facet: {
            // 总体统计
            summary: [
              {
                $group: {
                  _id: null,
                  totalRecords: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' },
                  minDuration: { $min: '$duration' },
                  maxDuration: { $max: '$duration' },
                  earliestDate: { $min: '$serviceDate' },
                  latestDate: { $max: '$serviceDate' }
                }
              }
            ],
            
            // 按服务类型统计
            byServiceType: [
              {
                $group: {
                  _id: '$serviceType',
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' },
                  avgDuration: { $avg: '$duration' }
                }
              },
              { $sort: { totalHours: -1 } }
            ],
            
            // 按时间统计（按年）
            byYear: [
              {
                $group: {
                  _id: { $year: '$serviceDate' },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ],
            
            // 按时间统计（按月）
            byMonth: [
              {
                $group: {
                  _id: {
                    year: { $year: '$serviceDate' },
                    month: { $month: '$serviceDate' }
                  },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
              { $limit: 12 } // 最近12个月
            ],
            
            // 服务趋势（按季度）
            trendByQuarter: [
              {
                $addFields: {
                  quarter: {
                    $ceil: { $divide: [{ $month: '$serviceDate' }, 3] }
                  }
                }
              },
              {
                $group: {
                  _id: {
                    year: { $year: '$serviceDate' },
                    quarter: '$quarter'
                  },
                  count: { $sum: 1 },
                  totalHours: { $sum: '$duration' }
                }
              },
              { $sort: { '_id.year': 1, '_id.quarter': 1 } }
            ],
            
            // 最近服务记录
            recentServices: [
              { $sort: { serviceDate: -1 } },
              { $limit: 5 },
              {
                $project: {
                  serviceId: 1,
                  serviceDate: 1,
                  serviceType: 1,
                  duration: 1,
                  description: 1
                }
              }
            ]
          }
        }
      ];
      
      const result = await NonProjectService.aggregate(pipeline);
      
      return {
        volunteerId,
        volunteerName: volunteer.chineseName,
        summary: result[0].summary[0] || {},
        byServiceType: result[0].byServiceType,
        byYear: result[0].byYear,
        byMonth: this.formatTimeStats(result[0].byMonth, 'month'),
        trendByQuarter: this.formatTimeStats(result[0].trendByQuarter, 'quarter'),
        recentServices: result[0].recentServices,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('获取志愿者服务统计失败:', error);
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
        totalHours: item.totalHours,
        avgDuration: item.avgDuration,
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
  static formatTimeStats(statsArray, type = 'month') {
    return statsArray.map(item => {
      let period;
      
      if (type === 'month') {
        const month = item._id.month.toString().padStart(2, '0');
        period = `${item._id.year}-${month}`;
      } else if (type === 'quarter') {
        period = `${item._id.year}Q${item._id.quarter}`;
      } else {
        period = item._id.toString();
      }
      
      return {
        period,
        count: item.count,
        totalHours: item.totalHours,
        year: item._id.year,
        ...(type === 'month' && { month: item._id.month }),
        ...(type === 'quarter' && { quarter: item._id.quarter })
      };
    });
  }
}

export default ServiceService;