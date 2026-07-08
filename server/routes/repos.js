const express = require('express');
const router = express.Router();
const { indexRepository, analyzeRepository, cancelJob, isJobRunning, skipFile } = require('../services/indexer');
const Chunk = require('../models/Chunk');
const RepoStatus = require('../models/RepoStatus');

router.get('/indexed', async (req, res) => {
  try {
    // Backfill any old repositories from Chunks that don't have a RepoStatus yet
    const chunkRepos = await Chunk.distinct('repoUrl');
    for (const url of chunkRepos) {
      await RepoStatus.updateOne(
        { repoUrl: url },
        { $setOnInsert: { status: 'complete', lastUpdated: Date.now() } },
        { upsert: true }
      );
    }

    // Get unique repos and their statuses for this user
    const repos = await RepoStatus.find({ users: req.user.id }, 'repoUrl status indexedFiles totalFiles lastUpdated').sort({ lastUpdated: -1 }).lean();
    res.json(repos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch indexed repositories' });
  }
});

router.get('/file', async (req, res) => {
  const { repoUrl, filePath } = req.query;
  if (!repoUrl || !filePath) return res.status(400).json({ error: 'repoUrl and filePath are required' });

  try {
    const chunks = await Chunk.find({ repoUrl, filePath }).sort({ _id: 1 });
    if (!chunks.length) return res.status(404).json({ error: 'File not found in index' });

    const content = chunks.map(c => c.content).join('');
    res.json({ content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
});

// Analyze repository files
router.post('/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const analysis = await analyzeRepository(url);
    res.json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to analyze repository' });
  }
});

// Pause indexing for a repository
router.post('/pause', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  
  cancelJob(url);
  res.json({ success: true, message: 'Pause signal sent' });
});

// Skip current file indexing for a repository
router.post('/skip-file', (req, res) => {
  const { url, filePath } = req.body;
  if (!url || !filePath) return res.status(400).json({ error: 'url and filePath are required' });
  
  skipFile(url, filePath);
  res.json({ success: true, message: 'Skip signal sent' });
});

router.post('/index', async (req, res) => {
  const { url, embeddingModel, excludedExtensions } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'GitHub URL is required' });

  // Layer 1: In-memory check (fast path, covers 99.9% of cases)
  if (isJobRunning(url)) {
    console.log(`Job already running for ${url}, ignoring duplicate request.`);
    return res.json({ success: true, message: 'Indexing already in progress' });
  }

  // Layer 2: DB-level atomic lock (protects against simultaneous requests arriving before
  // the in-memory state is set). Only update to 'indexing' if NOT already indexing.
  // If two requests arrive at the same millisecond, only one will get a non-null result.
  const locked = await RepoStatus.findOneAndUpdate(
    { repoUrl: url, status: { $ne: 'indexing' } },
    { status: 'indexing', lastUpdated: Date.now(), $addToSet: { users: req.user.id } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  if (!locked) {
    console.log(`DB lock already held for ${url}, ignoring concurrent request.`);
    await RepoStatus.updateOne({ repoUrl: url }, { $addToSet: { users: req.user.id } });
    return res.json({ success: true, message: 'Indexing already in progress' });
  }

  // Immediately respond — the indexing job runs in the background
  res.json({ success: true, message: 'Indexing started' });

  // Run indexing as a fire-and-forget background job
  // The frontend polls /api/repos/status for progress updates
  indexRepository(url, null, embeddingModel, excludedExtensions)
    .catch(err => console.error(`Background indexing error for ${url}:`, err));
});

// Polling endpoint — frontend calls this every 2s to get live progress
router.get('/status', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const repoStatus = await RepoStatus.findOne({ repoUrl: url }).lean();
    if (!repoStatus) {
      return res.json({ status: 'not_found' });
    }
    res.json(repoStatus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Delete a repository workspace and all its data
router.delete('/delete', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const Conversation = require('../models/Conversation');
    // Delete user's conversations for this repo
    await Conversation.deleteMany({ repoId: url, userId: req.user.id });

    // Remove user from the repo tracking list
    const updatedRepo = await RepoStatus.findOneAndUpdate(
      { repoUrl: url },
      { $pull: { users: req.user.id } },
      { new: true }
    );

    // If no one is using this repo anymore, clean it up completely
    if (updatedRepo && updatedRepo.users.length === 0) {
      cancelJob(url);
      await Promise.all([
        Chunk.deleteMany({ repoUrl: url }),
        RepoStatus.deleteOne({ repoUrl: url })
      ]);
    }

    res.json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

module.exports = router;
