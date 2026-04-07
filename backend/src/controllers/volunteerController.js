import * as VolunteerService from '../services/VolunteerService.js';

export const getAllVolunteers = async (req, res) => {
  try {
    const { status, region, province, services, search, page, limit, sortBy, order } = req.query;
    const { total, volunteers, pagination } = await VolunteerService.findAll({ status, region, province, services, search, page, limit, sortBy, order });
    res.status(200).json({
      success: true,
      count: volunteers.length,
      total,
      totalPages: Math.ceil(total / (pagination.limit || 20)),
      currentPage: pagination.page || 1,
      data: volunteers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取志愿者列表失败', error: error.message });
  }
};

export const getVolunteerById = async (req, res) => {
  try {
    const volunteer = await VolunteerService.findById(req.params.id);
    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }
    res.status(200).json({ success: true, data: volunteer });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取志愿者信息失败', error: error.message });
  }
};

export const createVolunteer = async (req, res) => {
  try {
    const result = await VolunteerService.create(req.body);
    if (result.conflict) {
      return res.status(400).json({ success: false, message: `志愿者ID ${result.id} 已存在` });
    }
    res.status(201).json({ success: true, message: '志愿者创建成功', data: result.volunteer });
  } catch (error) {
    res.status(400).json({ success: false, message: '创建志愿者失败', error: error.message });
  }
};

export const updateVolunteer = async (req, res) => {
  try {
    const volunteer = await VolunteerService.update(req.params.id, req.body);
    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }
    res.status(200).json({ success: true, message: '志愿者更新成功', data: volunteer });
  } catch (error) {
    res.status(400).json({ success: false, message: '更新志愿者失败', error: error.message });
  }
};

export const deleteVolunteer = async (req, res) => {
  try {
    const volunteer = await VolunteerService.remove(req.params.id);
    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }
    res.status(200).json({ success: true, message: '志愿者删除成功', data: volunteer });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除志愿者失败', error: error.message });
  }
};

export const getVolunteerStats = async (req, res) => {
  try {
    const data = await VolunteerService.getStats(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计信息失败', error: error.message });
  }
};
