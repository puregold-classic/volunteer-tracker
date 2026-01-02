const Volunteer = require('../models/Volunteer');

class VolunteerController {
  // 获取所有志愿者
  async getAllVolunteers(req, res, next) {
    try {
      const { 
        status, 
        region, 
        service, 
        page = 1, 
        limit = 20,
        search 
      } = req.query;
      
      const query = {};
      
      if (status) query.status = status;
      if (region) query.region = region;
      if (service) query.services = service;
      if (search) {
        query.$or = [
          { chineseName: new RegExp(search, 'i') },
          { englishName: new RegExp(search, 'i') },
          { id: new RegExp(search, 'i') }
        ];
      }
      
      const skip = (page - 1) * limit;
      
      const [volunteers, total] = await Promise.all([
        Volunteer.find(query)
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 }),
        Volunteer.countDocuments(query)
      ]);
      
      res.json({
        success: true,
        data: volunteers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 获取单个志愿者
  async getVolunteerById(req, res, next) {
    try {
      const volunteer = await Volunteer.findOne({ id: req.params.id });
      
      if (!volunteer) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found'
        });
      }
      
      res.json({
        success: true,
        data: volunteer
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 创建志愿者
  async createVolunteer(req, res, next) {
    try {
      // 生成志愿者ID
      const lastVolunteer = await Volunteer.findOne().sort({ createdAt: -1 });
      let newId = 'VM-0001';
      
      if (lastVolunteer && lastVolunteer.id) {
        const lastNumber = parseInt(lastVolunteer.id.split('-')[1]);
        newId = `VM-${(lastNumber + 1).toString().padStart(4, '0')}`;
      }
      
      const volunteerData = {
        ...req.body,
        id: newId
      };
      
      const volunteer = await Volunteer.create(volunteerData);
      
      res.status(201).json({
        success: true,
        message: 'Volunteer created successfully',
        data: volunteer
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          error: 'Volunteer ID already exists'
        });
      }
      next(error);
    }
  }
  
  // 更新志愿者
  async updateVolunteer(req, res, next) {
    try {
      const volunteer = await Volunteer.findOneAndUpdate(
        { id: req.params.id },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      
      if (!volunteer) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Volunteer updated successfully',
        data: volunteer
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 删除志愿者
  async deleteVolunteer(req, res, next) {
    try {
      const volunteer = await Volunteer.findOneAndDelete({ id: req.params.id });
      
      if (!volunteer) {
        return res.status(404).json({
          success: false,
          error: 'Volunteer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Volunteer deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  // 按地区获取志愿者
  async getVolunteersByRegion(req, res, next) {
    try {
      const volunteers = await Volunteer.findByRegion(req.params.regionId);
      
      const stats = {
        total: volunteers.length,
        active: volunteers.filter(v => v.status === 'active').length,
        inactive: volunteers.filter(v => v.status === 'inactive').length,
        totalHours: volunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0),
        services: volunteers.reduce((acc, v) => {
          v.services.forEach(service => {
            acc[service] = (acc[service] || 0) + 1;
          });
          return acc;
        }, {})
      };
      
      res.json({
        success: true,
        data: volunteers,
        stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VolunteerController();
