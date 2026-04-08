// src/controllers/exportController.js — v2.1
//
// Streaming export was removed in v2.1 — for the org sizes we deal with,
// the bulk export in ExportService.exportSupports is sufficient. If we hit
// scale issues, port the streaming pattern with prisma.projectSupport.findMany
// + cursor-based pagination.

import ExportService from '../services/ExportService.js';

class ExportController {
  static async exportSupports(req, res) {
    try {
      const filters = {
        volunteerId: req.query.volunteerId,
        departmentId: req.query.departmentId,
        serviceItemId: req.query.serviceItemId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      };
      const options = {
        format: req.query.format || 'csv',
        maxRecords: parseInt(req.query.maxRecords || '10000', 10),
      };
      const result = await ExportService.exportSupports(filters, options);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      if (result.fileSize) res.setHeader('Content-Length', result.fileSize);
      return res.status(200).send(result.data);
    } catch (err) {
      const code = err.message.includes('过多') ? 413 : err.message.includes('不支持') ? 400 : 500;
      return res.status(code).json({ success: false, error: err.message });
    }
  }

  static async exportLedgerOverview(req, res) {
    try {
      const filters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        departmentId: req.query.departmentId,
      };
      const options = { format: req.query.format || 'json' };
      const result = await ExportService.exportLedgerOverview(filters, options);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      if (result.fileSize) res.setHeader('Content-Length', result.fileSize);
      return res.status(200).send(result.data);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

export default ExportController;
