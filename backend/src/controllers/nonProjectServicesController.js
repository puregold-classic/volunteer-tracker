import NonProjectService from '../models/NonProjectServices.js';

// 获取所有非项目服务记录 (支持筛选和分页)
export const getAllNonProjectServices = async (req, res) => {
  try {
    const { volunteerId, category, page = 1, limit = 20 } = req.query;
    let query = {};

    if (volunteerId) query.volunteerId = volunteerId;
    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await NonProjectService.countDocuments(query);
    const services = await NonProjectService.find(query)
      .sort({ serviceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: services.length,
      total,
      data: services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取非项目服务记录失败',
      error: error.message
    });
  }
};

// 创建新的服务记录
export const createNonProjectService = async (req, res) => {
  try {
    const service = await NonProjectService.create(req.body);
    res.status(201).json({
      success: true,
      message: '服务记录创建成功',
      data: service
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '创建服务记录失败',
      error: error.message
    });
  }
};

// 获取特定志愿者的服务统计
export const getServiceStatsByVolunteer = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const stats = await NonProjectService.aggregate([
      { $match: { volunteerId: volunteerId } },
      {
        $group: {
          _id: '$volunteerId',
          totalHours: { $sum: '$hours' },
          totalCount: { $sum: 1 },
          lastServiceDate: { $max: '$serviceDate' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || { totalHours: 0, totalCount: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    });
  }
};

// 删除记录
export const deleteNonProjectService = async (req, res) => {
  try {
    const service = await NonProjectService.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: '未找到该记录' });
    }
    res.status(200).json({ success: true, message: '记录删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};