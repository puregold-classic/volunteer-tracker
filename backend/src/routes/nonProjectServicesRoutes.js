import express from 'express';
import {
  getAllNonProjectServices,
  createNonProjectService,
  getServiceStatsByVolunteer,
  deleteNonProjectService
} from '../controllers/nonProjectServicesController.js';

const router = express.Router();

// 基础记录操作
router.route('/')
  .get(getAllNonProjectServices)
  .post(createNonProjectService);

// 统计特定志愿者的时长数据
router.route('/stats/:volunteerId')
  .get(getServiceStatsByVolunteer);

// 单条记录操作
router.route('/:id')
  .delete(deleteNonProjectService);

export default router;