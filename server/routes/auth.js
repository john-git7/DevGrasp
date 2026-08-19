const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const RepoStatus = require('../models/RepoStatus');
const { requireApiKey } = require('../middleware/auth');
const { encrypt } = require('../utils/crypto');

// Register new user
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    // Check if this is the first user ever created in the system
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    const user = new User({ email, password, name });
    await user.save();

    // If this is the first user, migrate all existing orphaned data to this user
    if (isFirstUser) {
      console.log(`[AUTH] First user created (${email}). Migrating existing data...`);
      // Update all conversations to belong to this user
      await Conversation.updateMany({}, { userId: user._id });
      // Add this user to all existing repositories
      await RepoStatus.updateMany({}, { $addToSet: { users: user._id } });
      console.log(`[AUTH] Data migration complete.`);
    }

    const token = jwt.sign({ id: user._id }, process.env.API_SECRET || process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields are required' });

  try {
    const user = await User.findOne({ email });
    console.log(`[AUTH] Login attempt: email=${email}, userFound=${!!user}`);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    console.log(`[AUTH] Password match: ${isMatch}`);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.API_SECRET || process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// Get current user (protected)
router.get('/me', requireApiKey, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Save GitHub Token
router.post('/github-token', requireApiKey, async (req, res) => {
  const { githubToken } = req.body;
  if (!githubToken) return res.status(400).json({ error: 'GitHub token is required' });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.githubToken = encrypt(githubToken);
    await user.save();
    
    res.json({ success: true, message: 'GitHub token saved securely.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save GitHub token.' });
  }
});

module.exports = router;
