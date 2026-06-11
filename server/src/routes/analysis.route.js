import express from 'express';
import { analyzeUrl, deleteAnalysis, getAnalyses, getAnalysis } from '../controllers/analysis.controller';

const router = express.Router();

router.post('/', analyzeUrl);
router.get('/list', getAnalyses);
router.get('/:id', getAnalysis);
router.delete('/:id', deleteAnalysis);

export default router;