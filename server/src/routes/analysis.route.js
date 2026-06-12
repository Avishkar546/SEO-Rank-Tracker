import express from 'express';
import { analyzeUrl, deleteAnalysis, getAnalyses, getAnalysis, abortAnalysis } from '../controllers/analysis.controller.js';

const router = express.Router();

router.post('/', analyzeUrl);
router.get('/list', getAnalyses);
router.get('/:id', getAnalysis);
router.post('/:id/abort', abortAnalysis);
router.delete('/:id', deleteAnalysis);

export default router;