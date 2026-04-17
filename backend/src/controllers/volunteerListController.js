// src/controllers/volunteerListController.js — v3 wave 3
//
// HTTP adapter for volunteer lists. Lists are scoped to the authenticated
// volunteer identity (req.user.volunteerId). Pure admin accounts (no
// volunteer binding) are rejected by the service layer.

import VolunteerListService from '../services/VolunteerListService.js';

const ok = (res, data) => res.status(200).json({ success: true, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

export const listMine = async (req, res) => {
  try {
    const lists = await VolunteerListService.listMine(req.user?.volunteerId);
    return ok(res, lists);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const followDefault = async (req, res) => {
  try {
    const volunteerId = req.params.volunteerId;
    const result = await VolunteerListService.followDefault(
      req.user?.volunteerId,
      volunteerId,
      req.user,
      { note: req.body?.note },
    );
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const unfollowDefault = async (req, res) => {
  try {
    const result = await VolunteerListService.unfollowDefault(
      req.user?.volunteerId,
      req.params.volunteerId,
      req.user,
    );
    if (result.forbidden) return fail(res, 403, result.forbidden);
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const followerCount = async (req, res) => {
  try {
    const count = await VolunteerListService.followerCount(req.params.volunteerId);
    return ok(res, { count });
  } catch (err) {
    return fail(res, 500, err.message);
  }
};
