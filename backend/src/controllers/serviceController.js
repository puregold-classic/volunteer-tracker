// src/controllers/serviceController.js
import ServiceService from '../services/ServiceService.js';

/**
 * 服务记录控制器
 */
class ServiceController {
  
  /**
   * 获取服务记录列表
   * GET /api/v1/services
   */
  static async getServiceRecords(req, res) {
    try {
      // 从查询参数获取筛选条件
      const filters = {
        volunteerId: req.query.volunteerId,
        volunteerName: req.query.volunteerName,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        minDuration: req.query.minDuration,
        maxDuration: req.query.maxDuration,
        region: req.query.region,
        isActive: req.query.isActive !== 'false' // 默认true，除非显式设为false
      };
      
      // 分页参数
      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 20
      };
      
      // 排序参数
      const sortOptions = {
        sortBy: req.query.sortBy || 'serviceDate',
        order: req.query.order || 'desc'
      };
      
      console.log('查询服务记录:', {
        filters,
        pagination,
        sortOptions
      });
      
      // 调用服务层
      const result = await ServiceService.getServiceRecords(filters, pagination, sortOptions);
      
      return res.status(200).json({
        success: true,
        message: '获取服务记录列表成功',
        data: {
          services: result.services,
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取服务记录列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取服务记录列表失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取服务记录详情
   * GET /api/v1/services/:serviceId
   */
  static async getServiceRecordById(req, res) {
    try {
      const { serviceId } = req.params;
      
      console.log('获取服务记录详情:', { serviceId });
      
      const serviceRecord = await ServiceService.getServiceRecordById(serviceId);
      
      return res.status(200).json({
        success: true,
        message: '获取服务记录详情成功',
        data: serviceRecord,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 : 500;
      if (statusCode >= 500) {
        console.error('获取服务记录详情失败:', error);
      }
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'SERVICE_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取志愿者的服务记录
   * GET /api/v1/services/volunteer/:volunteerId
   */
  static async getServicesByVolunteer(req, res) {
    try {
      const { volunteerId } = req.params;
      
      // 筛选条件
      const filters = {
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo
      };
      
      // 分页参数
      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 20
      };
      
      console.log('获取志愿者服务记录:', {
        volunteerId,
        filters,
        pagination
      });
      
      const result = await ServiceService.getServicesByVolunteer(
        volunteerId, 
        filters, 
        pagination
      );
      
      return res.status(200).json({
        success: true,
        message: '获取志愿者服务记录成功',
        data: {
          volunteerId,
          services: result.services,
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 : 500;
      if (statusCode >= 500) {
        console.error('获取志愿者服务记录失败:', error);
      }
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'VOLUNTEER_SERVICES_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 搜索服务记录
   * GET /api/v1/services/search
   */
  static async searchServices(req, res) {
    try {
      const { q: searchTerm } = req.query;
      
      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          error: '搜索关键词不能为空',
          code: 'EMPTY_SEARCH_TERM',
          timestamp: new Date().toISOString()
        });
      }
      
      // 筛选条件
      const filters = {
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo
      };
      
      // 分页参数
      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 20
      };
      
      console.log('搜索服务记录:', {
        searchTerm,
        filters,
        pagination
      });
      
      const result = await ServiceService.searchServices(
        searchTerm,
        filters,
        pagination
      );
      
      return res.status(200).json({
        success: true,
        message: '搜索服务记录成功',
        data: {
          searchTerm,
          services: result.services,
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('搜索服务记录失败:', error);
      return res.status(500).json({
        success: false,
        error: '搜索服务记录失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取服务记录统计信息
   * GET /api/v1/services/stats/summary
   */
  static async getServiceStatistics(req, res) {
    try {
      // 筛选条件
      const filters = {
        volunteerId: req.query.volunteerId,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        region: req.query.region
      };
      
      console.log('获取服务记录统计:', { filters });
      
      const statistics = await ServiceService.getServiceStatistics(filters);
      
      return res.status(200).json({
        success: true,
        message: '获取服务记录统计成功',
        data: statistics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取服务记录统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取服务记录统计失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取志愿者服务统计
   * GET /api/v1/services/stats/volunteer/:volunteerId
   */
  static async getVolunteerServiceStatistics(req, res) {
    try {
      const { volunteerId } = req.params;
      
      console.log('获取志愿者服务统计:', { volunteerId });
      
      const statistics = await ServiceService.getVolunteerServiceStatistics(volunteerId);
      
      return res.status(200).json({
        success: true,
        message: '获取志愿者服务统计成功',
        data: statistics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 : 500;
      if (statusCode >= 500) {
        console.error('获取志愿者服务统计失败:', error);
      }
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'VOLUNTEER_STATS_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取地区服务统计
   * GET /api/v1/services/stats/region/:region
   */
  static async getRegionServiceStatistics(req, res) {
    try {
      const { region } = req.params;
      
      // 额外筛选条件
      const filters = {
        region,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo
      };
      
      console.log('获取地区服务统计:', { region, filters });
      
      const statistics = await ServiceService.getServiceStatistics(filters);
      
      return res.status(200).json({
        success: true,
        message: '获取地区服务统计成功',
        data: statistics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取地区服务统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取地区服务统计失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取服务趋势统计
   * GET /api/v1/services/stats/trend
   */
  static async getServiceTrendStatistics(req, res) {
    try {
      // 筛选条件
      const defaultDateRange = ServiceController.getDefaultDateRange();
      const filters = {
        volunteerId: req.query.volunteerId,
        serviceType: req.query.serviceType,
        region: req.query.region,
        serviceDateFrom: req.query.serviceDateFrom || defaultDateRange.from,
        serviceDateTo: req.query.serviceDateTo || defaultDateRange.to
      };
      
      console.log('获取服务趋势统计:', { filters });
      
      const statistics = await ServiceService.getServiceStatistics(filters);
      
      // 提取趋势数据
      const trendData = {
        byMonth: statistics.byMonth,
        byQuarter: statistics.byQuarter,
        summary: statistics.summary,
        generatedAt: statistics.generatedAt
      };
      
      return res.status(200).json({
        success: true,
        message: '获取服务趋势统计成功',
        data: trendData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取服务趋势统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取服务趋势统计失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 获取默认日期范围（最近12个月）
   * @private
   */
  static getDefaultDateRange() {
    const now = new Date();
    const to = new Date(now);
    const from = new Date(now);
    from.setMonth(from.getMonth() - 11); // 最近12个月
    from.setDate(1); // 从当月1号开始
    
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }
}

export default ServiceController;
