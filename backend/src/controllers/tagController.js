// src/controllers/tagController.js — v3.2
//
// HTTP adapter for TagGroup + Tag + attach/detach + batch ops.

import TagGroupService from '../services/TagGroupService.js';
import TagService from '../services/TagService.js';

const ok = (res, data, extra = {}) => res.status(200).json({ success: true, data, ...extra });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

// ─── TagGroup endpoints ─────────────────────────────────────────────────

export const listGroups = async (req, res) => {
  try {
    const groups = await TagGroupService.listAll();
    return ok(res, groups);
  } catch (err) { return fail(res, 500, err.message); }
};

export const getGroup = async (req, res) => {
  try {
    const group = await TagGroupService.findById(req.params.id);
    if (!group) return fail(res, 404, '标签组不存在');
    return ok(res, group);
  } catch (err) { return fail(res, 500, err.message); }
};

export const groupsBoundTo = async (req, res) => {
  try {
    const groups = await TagGroupService.findBoundTo(req.params.serviceItemId);
    return ok(res, groups);
  } catch (err) { return fail(res, 500, err.message); }
};

export const createGroup = async (req, res) => {
  try {
    const result = await TagGroupService.create(req.body || {}, req.user);
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.conflict) return fail(res, 409, result.conflict);
    return res.status(201).json({ success: true, data: result.group });
  } catch (err) { return fail(res, 500, err.message); }
};

export const updateGroup = async (req, res) => {
  try {
    const result = await TagGroupService.update(req.params.id, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, '标签组不存在');
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, result.group);
  } catch (err) { return fail(res, 500, err.message); }
};

export const deleteGroup = async (req, res) => {
  try {
    const cascadeAttachments = req.query.cascadeAttachments === 'true';
    const result = await TagGroupService.remove(req.params.id, req.user, { cascadeAttachments });
    if (result.notFound) return fail(res, 404, '标签组不存在');
    if (result.conflict) return res.status(409).json({ success: false, error: result.conflict, attachmentCount: result.attachmentCount });
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

// ─── Tag endpoints ──────────────────────────────────────────────────────

export const listTagsByGroup = async (req, res) => {
  try {
    const tags = await TagService.listByGroup(req.params.groupId);
    return ok(res, tags);
  } catch (err) { return fail(res, 500, err.message); }
};

export const createTag = async (req, res) => {
  try {
    const result = await TagService.create(req.body || {}, req.user);
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.conflict) return fail(res, 409, result.conflict);
    return res.status(201).json({ success: true, data: result.tag });
  } catch (err) { return fail(res, 500, err.message); }
};

export const updateTag = async (req, res) => {
  try {
    const result = await TagService.update(req.params.id, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, result.tag);
  } catch (err) { return fail(res, 500, err.message); }
};

export const deleteTag = async (req, res) => {
  try {
    const result = await TagService.remove(req.params.id, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

// ─── Attach / detach ────────────────────────────────────────────────────

export const attachTag = async (req, res) => {
  try {
    const result = await TagService.attach(req.params.tagId, req.body?.supportId, req.user);
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const detachTag = async (req, res) => {
  try {
    const result = await TagService.detach(req.params.tagId, req.params.supportId, req.user);
    if (result.validationError) return fail(res, 400, result.validationError);
    if (result.forbidden) return fail(res, 403, result.forbidden);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const listTagSupports = async (req, res) => {
  try {
    const supports = await TagService.listSupports(req.params.tagId, {
      limit: parseInt(req.query.limit || '100', 10),
    });
    return ok(res, supports);
  } catch (err) { return fail(res, 500, err.message); }
};

// ─── Batch ops ──────────────────────────────────────────────────────────

export const batchCreate = async (req, res) => {
  try {
    const result = await TagService.batchCreate(req.params.tagId, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const batchUpdate = async (req, res) => {
  try {
    const result = await TagService.batchUpdate(req.params.tagId, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const batchDelete = async (req, res) => {
  try {
    const result = await TagService.batchDelete(req.params.tagId, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const batchAttach = async (req, res) => {
  try {
    const result = await TagService.batchAttach(req.params.tagId, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};

export const batchDetach = async (req, res) => {
  try {
    const result = await TagService.batchDetach(req.params.tagId, req.body || {}, req.user);
    if (result.notFound) return fail(res, 404, 'tag 不存在');
    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.validationError) return fail(res, 400, result.validationError);
    return ok(res, result);
  } catch (err) { return fail(res, 500, err.message); }
};
