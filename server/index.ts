// Sentry MUST be initialized before all other imports
import './instrument';
import * as Sentry from '@sentry/node';
import express, { Request, Response } from 'express';
import dns from 'dns';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

// Override local DNS to fix SRV lookup failures on this network
dns.setServers(['8.8.8.8', '8.8.4.4']);

import usageTracker from './services/usageTracker';
import { requireApiKey } from './middleware/auth';
import authRoute from './routes/auth';
import reposRoute from './routes/repos';
import chatRoute from './routes/chat';
import RepoStatus from './models/RepoStatus';

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Auth routes (unprotected inside)
app.use('/api/auth', authRoute);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased from 50 to allow client polling
  message: { error: 'Too many requests, slow down.' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200 // Increased from 20
});

// GET health check — used by Render.com, UptimeRobot, and CI pipelines
app.get('/api/health', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  const isHealthy = dbState === 1;

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    node: process.version,
    db: dbStatus,
  };

  res.status(isHealthy ? 200 : 503).json(payload);
});

// Apply API key authentication to all /api routes
app.use('/api', requireApiKey as any);

app.use('/api/', limiter);
app.use('/api/chat', aiLimiter);

app.use('/api/repos', reposRoute);
app.use('/api/chat', chatRoute);

// GET usage metrics
app.get('/api/status/usage', (req: Request, res: Response) => {
  res.json(usageTracker.getUsage());
});

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI || '')
    .then(async () => {
      console.log('Connected to MongoDB Atlas');
      
      // Cleanup stale indexing states on startup
      try {
        const staleRepos = await RepoStatus.find({ status: 'indexing' });
        for (const repo of staleRepos) {
          repo.status = 'error';
          (repo as any).error = 'Indexing was interrupted by server restart.';
          await repo.save();
        }
      } catch(e) {
        console.error('Failed to cleanup stale indexing states:', e);
      }
    })
    .catch((err) => console.error('MongoDB connection error:', err));
}

// Sentry error handler MUST be registered after all routes and before app.listen
Sentry.setupExpressErrorHandler(app);

// Only start the server if this file is run directly (not imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;
