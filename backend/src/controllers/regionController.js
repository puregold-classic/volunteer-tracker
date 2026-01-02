const Volunteer = require('../models/Volunteer');

class RegionController {
  // 获取所有地区
  async getAllRegions(req, res, next) {
    try {
      const regions = await Volunteer.distinct('region');
      
      res.json({
        success: true,
        data: regions
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取地区统计
  async getRegionStats(req, res, next) {
    try {
      const stats = await Volunteer.aggregate([
        {
          $group: {
            _id: '$region',
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalHours: { $sum: '$totalHours' },
            avgHours: { $avg: '$totalHours' }
          }
        },
        { $sort: { total: -1 } }
      ]);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取特定地区详情
  async getRegionById(req, res, next) {
    try {
      const regionId = req.params.id;
      
      // 获取该地区的志愿者统计
      const stats = await Volunteer.aggregate([
        { $match: { region: regionId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalHours: { $sum: '$totalHours' },
            serviceTypes: { $push: '$services' }
          }
        }
      ]);
      
      // 整理服务类型统计
      let serviceStats = {};
      if (stats[0] && stats[0].serviceTypes) {
        const allServices = stats[0].serviceTypes.flat();
        serviceStats = allServices.reduce((acc, service) => {
          acc[service] = (acc[service] || 0) + 1;
          return acc;
        }, {});
      }
      
      const result = {
        region: regionId,
        stats: stats[0] || { total: 0, active: 0, totalHours: 0 },
        serviceStats
      };
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取地区下的志愿者
  async getRegionVolunteers(req, res, next) {
    try {
      const regionId = req.params.id;
      const volunteers = await Volunteer.find({ region: regionId });
      
      res.json({
        success: true,
        data: volunteers
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RegionController();
