const Volunteer = require('../models/Volunteer');

class StatsController {
  // 获取全局统计
  async getSummaryStats(req, res, next) {
    try {
      const stats = await Volunteer.aggregate([
        {
          $group: {
            _id: null,
            totalVolunteers: { $sum: 1 },
            activeVolunteers: { 
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            inactiveVolunteers: { 
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
            },
            totalServiceHours: { $sum: '$totalHours' },
            totalServiceCount: { $sum: '$serviceCount' },
            avgHoursPerVolunteer: { $avg: '$totalHours' }
          }
        }
      ]);
      
      const result = stats[0] || {
        totalVolunteers: 0,
        activeVolunteers: 0,
        inactiveVolunteers: 0,
        totalServiceHours: 0,
        totalServiceCount: 0,
        avgHoursPerVolunteer: 0
      };
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取月度统计
  async getMonthlyStats(req, res, next) {
    try {
      // 简化版本：返回最近6个月的统计
      const months = 6;
      const stats = [];
      
      for (let i = 0; i < months; i++) {
        const month = new Date();
        month.setMonth(month.getMonth() - i);
        const year = month.getFullYear();
        const monthNum = month.getMonth() + 1;
        
        // 模拟数据 - 实际项目中这里应该是数据库查询
        stats.push({
          month: `${year}-${monthNum.toString().padStart(2, '0')}`,
          newVolunteers: Math.floor(Math.random() * 10),
          totalHours: Math.floor(Math.random() * 500) + 100
        });
      }
      
      res.json({
        success: true,
        data: stats.reverse()
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取服务类型统计
  async getServiceStats(req, res, next) {
    try {
      const volunteers = await Volunteer.find({});
      
      const serviceCounts = volunteers.reduce((acc, volunteer) => {
        volunteer.services.forEach(service => {
          acc[service] = (acc[service] || 0) + 1;
        });
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: serviceCounts
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取地区分布统计
  async getRegionDistribution(req, res, next) {
    try {
      const distribution = await Volunteer.aggregate([
        {
          $group: {
            _id: '$region',
            count: { $sum: 1 },
            percentage: { 
              $multiply: [
                { $divide: [100, { $count: {} }] },
                100
              ]
            }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.json({
        success: true,
        data: distribution
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StatsController();
