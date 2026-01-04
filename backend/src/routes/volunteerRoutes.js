import express from 'express';
import {
  getAllVolunteers,
  getVolunteerById,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
  getVolunteerStats
} from '../controllers/volunteerController.js';

const router = express.Router();

// 志愿者路由
router.route('/')
  .get(getAllVolunteers)    // 获取所有志愿者
  .post(createVolunteer);   // 创建志愿者

router.route('/stats')
  .get(getVolunteerStats);  // 获取统计信息

router.route('/:id')
  .get(getVolunteerById)    // 获取单个志愿者
  .put(updateVolunteer)     // 更新志愿者
  .delete(deleteVolunteer); // 删除志愿者

export default router;