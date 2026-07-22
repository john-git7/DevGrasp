const express = require('express');
const dns = require('dns');
// Override local DNS to fix SRV lookup failures on this network
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const usageTracker = require('./services/usageTracker');
const { requireApiKey } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;

const authRoute = require('./routes/auth');
const reposRoute = require('./routes/repos');
const chatRoute = require('./routes/chat');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth routes (unprotected inside)
app.use('/api/auth', authRoute);

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased from 50 to allow client polling
  message: { error: 'Too many requests, slow down.' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200 // Increased from 20
});

// Apply API key authentication to all /api routes
app.use('/api', requireApiKey);

app.use('/api/', limiter);
app.use('/api/chat', aiLimiter);

app.use('/api/repos', reposRoute);
app.use('/api/chat', chatRoute);

// GET usage metrics
app.get('/api/status/usage', (req, res) => {
  res.json(usageTracker.getUsage());
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    // Clean up any stale indexing states from previous server crashes
    try {
      const RepoStatus = require('./models/RepoStatus');
      const result = await RepoStatus.updateMany(
        { status: 'indexing' },
        { status: 'error' } // Mark as INCOMPLETE so user can resume
      );
      if (result.modifiedCount > 0) {
        console.log(`Cleaned up ${result.modifiedCount} stale indexing states.`);
      }
    } catch(e) {
      console.error('Failed to cleanup stale indexing states:', e);
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
