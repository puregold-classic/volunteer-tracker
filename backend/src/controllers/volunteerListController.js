// src/controllers/volunteerListController.js — v3.4 multi-list
//
// HTTP adapter for volunteer lists.  Lists are scoped to the authenticated
// volunteer identity (req.user.volunteerId).  Role gate enforced upstream
// by authorizeListOwner middleware (a_admin / b_admin only); pure admin
// without volunteer binding is also rejected at the service layer.

import VolunteerListService from '../services/VolunteerListService.js';

const ok = (res, data) => res.status(200).json({ success: true, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

const dispatch = (res, result) => {
  if (result.forbidden) return fail(res, 403, result.forbidden);
  if (result.validationError) return fail(res, 400, result.validationError);
  if (result.notFound) return fail(res, 404, result.notFound);
  return ok(res, result);
};

// ─── reads ──────────────────────────────────────────────────────────────────

export const listMine = async (req, res) => {
  try {
    const lists = await VolunteerListService.listMine(req.user?.volunteerId);
    return ok(res, lists);
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

// ─── default-list shortcuts (BC for follow-heart) ──────────────────────────

export const followDefault = async (req, res) => {
  try {
    const result = await VolunteerListService.followDefault(
      req.user?.volunteerId,
      req.params.volunteerId,
      req.user,
      { note: req.body?.note },
    );
    return dispatch(res, result);
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
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

// ─── list CRUD ──────────────────────────────────────────────────────────────

export const createList = async (req, res) => {
  try {
    const result = await VolunteerListService.createList(
      req.user?.volunteerId,
      req.body?.name,
      req.user,
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const renameList = async (req, res) => {
  try {
    const result = await VolunteerListService.renameList(
      req.user?.volunteerId,
      req.params.listId,
      req.body?.name,
      req.user,
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const deleteList = async (req, res) => {
  try {
    const result = await VolunteerListService.deleteList(
      req.user?.volunteerId,
      req.params.listId,
      req.user,
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

// ─── member CRUD ────────────────────────────────────────────────────────────

export const addMember = async (req, res) => {
  try {
    const result = await VolunteerListService.addMemberToList(
      req.user?.volunteerId,
      req.params.listId,
      req.params.volunteerId,
      req.user,
      { note: req.body?.note },
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const removeMember = async (req, res) => {
  try {
    const result = await VolunteerListService.removeMemberFromList(
      req.user?.volunteerId,
      req.params.listId,
      req.params.volunteerId,
      req.user,
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};

export const updateMemberNote = async (req, res) => {
  try {
    const result = await VolunteerListService.updateMemberNote(
      req.user?.volunteerId,
      req.params.listId,
      req.params.volunteerId,
      req.body?.note,
      req.user,
    );
    return dispatch(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
};
