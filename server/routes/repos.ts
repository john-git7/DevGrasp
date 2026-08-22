import express from 'express';
import * as repoController from '../controllers/repoController';

const router = express.Router();

router.get('/indexed', repoController.getIndexedRepos);
router.get('/file', repoController.getFile);
router.post('/analyze', repoController.analyze);
router.post('/pause', repoController.pause);
router.post('/skip-file', repoController.skip);
router.post('/index', repoController.index);
router.get('/status', repoController.status);
router.delete('/delete', repoController.deleteRepo);
router.get('/prs', repoController.getPRs);

export default router;
