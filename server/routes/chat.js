const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const techDebtController = require('../controllers/techDebtController');

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

module.exports = router;
