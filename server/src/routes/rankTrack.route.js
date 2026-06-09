import express from 'express';
import { addKeyword, deleteKeyword, getAllKeywords, getKeywordById, refreshKeyword, toggleTracking } from '../controllers/rankTrack.controller.js';

const router = express.Router();

router.post('/add', addKeyword);
router.get('/list',  getAllKeywords);
router.get('/:id', getKeywordById);
router.post('/:id/refresh', refreshKeyword);
router.put('/:id/toggle', toggleTracking);
router.delete('/:id', deleteKeyword);

export default router;
