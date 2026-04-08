// src/routes/exportRoutes.js — v2.1
import express from 'express';
import ExportController from '../controllers/exportController.js';
import { validateExportRequest } from '../middleware/validateExport.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

router.use(authenticate, authorizeReviewer);

router.get('/supports', validateExportRequest, ExportController.exportSupports);
router.get('/ledger-overview', validateExportRequest, ExportController.exportLedgerOverview);

export default router;
