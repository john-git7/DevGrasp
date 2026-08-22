import express from 'express';
import * as chatController from '../controllers/chatController';
import * as techDebtController from '../controllers/techDebtController';

const router = express.Router();

router.get('/history', chatController.getHistory);
router.get('/conversation/:id', chatController.getConversation);
router.delete('/conversation/:id', chatController.deleteConversation);
router.put('/conversation/:id/truncate', chatController.truncateConversation);
router.post('/', chatController.chat);
router.post('/onboarding', chatController.onboarding);
router.post('/bug-trace', chatController.bugTrace);
router.post('/commit-story', chatController.commitStory);
router.post('/pr-review', chatController.prReview);

// Tech debt route
router.post('/tech-debt', techDebtController.techDebt);

export default router;
