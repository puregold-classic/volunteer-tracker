// src/controllers/projectController.js — v3 wave 2
//
// HTTP adapter for Project CRUD. Permissions are enforced at the route
// layer (admin + a_admin for writes). Service layer assumes the caller
// was already authorized.

import ProjectService from '../services/ProjectService.js';

const ok = (res, data, extra = {}) => res.status(200).json({ success: true, data, ...extra });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

export const listProjects = async (req, res) => {
  try {
    const { category, departmentId, dateFrom, dateTo, search, page, limit, sortBy, order } = req.query;
    const result = await ProjectService.list(
      { category, departmentId, dateFrom, dateTo, search },
      { page, limit },
      { sortBy, order },
    );
    return res.status(200).json({
      success: true,
      data: result.records,
      pagination: result.pagination,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const getProject = async (req, res) => {
  try {
    const p = req.params.id.startsWith('PROJ-')
      ? await ProjectService.findByCode(req.params.id)
      : await ProjectService.findById(req.params.id);
    if (!p) return fail(res, 404, `项目不存在: ${req.params.id}`);
    return ok(res, p);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const createProject = async (req, res) => {
  try {
    const result = await ProjectService.create(req.body || {}, req.user);
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    return res.status(201).json({ success: true, data: result.project });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const updateProject = async (req, res) => {
  try {
    const result = await ProjectService.update(req.params.id, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, `项目不存在: ${req.params.id}`);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result.project);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const deleteProject = async (req, res) => {
  try {
    const result = await ProjectService.remove(req.params.id, req.user);
    if (result.notFound) return fail(res, 404, `项目不存在: ${req.params.id}`);
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { deleted: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const batchAttendance = async (req, res) => {
  try {
    const result = await ProjectService.batchAttendance(req.params.id, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, `项目不存在: ${req.params.id}`);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};
