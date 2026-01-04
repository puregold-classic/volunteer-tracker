import Volunteer from '../models/Volunteer.js';

// 获取所有志愿者
export const getAllVolunteers = async (req, res) => {
  try {
    const {
      status,
      region,
      services,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // 构建查询条件
    let query = {};

    // 状态筛选
    if (status && ['在职', '不在职'].includes(status)) {
      query.status = status;
    }

    // 地区筛选
    if (region) {
      query.region = region;
    }

    // 服务方向筛选
    if (services) {
      const servicesArray = services.split(',');
      query.services = { $in: servicesArray };
    }

    // 搜索（姓名或ID）
    if (search) {
      query.$or = [
        { chineseName: { $regex: search, $options: 'i' } },
        { englishName: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } }
      ];
    }

    // 排序
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Volunteer.countDocuments(query);
    const volunteers = await Volunteer.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v -isActive'); // 排除不必要字段

    res.status(200).json({
      success: true,
      count: volunteers.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: volunteers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取志愿者列表失败',
      error: error.message
    });
  }
};

// 获取单个志愿者
export const getVolunteerById = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ id: req.params.id });
    
    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为 ${req.params.id} 的志愿者`
      });
    }

    res.status(200).json({
      success: true,
      data: volunteer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取志愿者信息失败',
      error: error.message
    });
  }
};

// 创建志愿者
export const createVolunteer = async (req, res) => {
  try {
    const existingVolunteer = await Volunteer.findOne({ id: req.body.id });
    if (existingVolunteer) {
      return res.status(400).json({
        success: false,
        message: `志愿者ID ${req.body.id} 已存在`
      });
    }

    const volunteer = await Volunteer.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '志愿者创建成功',
      data: volunteer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '创建志愿者失败',
      error: error.message
    });
  }
};

// 更新志愿者
export const updateVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为 ${req.params.id} 的志愿者`
      });
    }

    res.status(200).json({
      success: true,
      message: '志愿者更新成功',
      data: volunteer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '更新志愿者失败',
      error: error.message
    });
  }
};

// 删除志愿者
export const deleteVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOneAndDelete({ id: req.params.id });

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为 ${req.params.id} 的志愿者`
      });
    }

    res.status(200).json({
      success: true,
      message: '志愿者删除成功',
      data: volunteer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除志愿者失败',
      error: error.message
    });
  }
};

// 获取统计信息
export const getVolunteerStats = async (req, res) => {
  try {
    const stats = await Volunteer.aggregate([
      {
        $group: {
          _id: null,
          totalVolunteers: { $sum: 1 },
          totalHours: { $sum: '$nonProjectHours' },
          totalActive: {
            $sum: { $cond: [{ $eq: ['$status', '在职'] }, 1, 0] }
          },
          totalInactive: {
            $sum: { $cond: [{ $eq: ['$status', '不在职'] }, 1, 0] }
          },
          avgHours: { $avg: '$nonProjectHours' }
        }
      },
      {
        $project: {
          _id: 0,
          totalVolunteers: 1,
          totalHours: 1,
          totalActive: 1,
          totalInactive: 1,
          avgHours: { $round: ['$avgHours', 2] }
        }
      }
    ]);

    // 地区分布
    const regionStats = await Volunteer.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          totalHours: { $sum: '$nonProjectHours' }
        }
      },
      {
        $project: {
          region: '$_id',
          count: 1,
          totalHours: 1,
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 服务方向分布
    const serviceStats = await Volunteer.aggregate([
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: stats[0] || {
          totalVolunteers: 0,
          totalHours: 0,
          totalActive: 0,
          totalInactive: 0,
          avgHours: 0
        },
        regionDistribution: regionStats,
        serviceDistribution: serviceStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    });
  }
};