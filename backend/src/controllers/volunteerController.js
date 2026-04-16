// src/controllers/volunteerController.js — v2.1
//
// Read + update only. Volunteer creation goes through AccountService via
// the admin or auth controllers (createVolunteerAccount). Volunteer deletion
// is intentionally not exposed — admins delete via the account flow which
// cascades through.

import * as VolunteerService from '../services/VolunteerService.js';
import { volunteerForViewer } from '../utils/serializer.js';

const ok = (res, data, extra = {}) => res.status(200).json({ success: true, data, ...extra });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

export const getAllVolunteers = async (req, res) => {
  try {
    const { status, region, province, departmentId, search, page, limit, sortBy, order } = req.query;
    const { total, volunteers, pagination } = await VolunteerService.findAll({
      status, region, province, departmentId, search, page, limit, sortBy, order,
    });
    // Hide email/phone from anonymous/non-admin/non-self viewers.
    const filtered = volunteers.map((v) => volunteerForViewer(req.user, v));
    return res.status(200).json({
      success: true,
      count: filtered.length,
      total,
      totalPages: Math.ceil(total / (pagination.limit || 20)),
      currentPage: pagination.page || 1,
      data: filtered,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const getVolunteerById = async (req, res) => {
  try {
    const v = await VolunteerService.findByIdOrCode(req.params.id);
    if (!v) return fail(res, 404, `未找到志愿者 ${req.params.id}`);
    return ok(res, volunteerForViewer(req.user, v));
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const updateVolunteer = async (req, res) => {
  try {
    const v = await VolunteerService.update(req.params.id, req.body);
    if (!v) return fail(res, 404, `未找到志愿者 ${req.params.id}`);
    return ok(res, v);
  } catch (err) {
    return fail(res, 400, err.message);
  }
};

export const getVolunteerStats = async (req, res) => {
  try {
    const data = await VolunteerService.getStats(req.query);
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const getVolunteerDerivedStats = async (req, res) => {
  try {
    const data = await VolunteerService.getDerivedStats(req.params.id);
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const getProvinceCounts = async (_req, res) => {
  try {
    const data = await VolunteerService.getProvinceCounts();
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};
