const express = require('express');
const router = express.Router();
const { indexRepository } = require('../services/indexer');
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

    // Get unique repos and their statuses
    const repos = await RepoStatus.find({}, 'repoUrl status indexedFiles totalFiles').sort({ lastUpdated: -1 }).lean();
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

router.post('/index', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'GitHub URL is required' });

  // Use SSE for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    await indexRepository(url, (progressData) => {
      res.write(`data: ${JSON.stringify(progressData)}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ status: 'complete', message: 'Indexing complete' })}\n\n`);
    res.end();
  } catch (error) {
    console.error(error);
    res.write(`data: ${JSON.stringify({ status: 'error', error: error.message || 'Failed to index repository' })}\n\n`);
    res.end();
  }
});

module.exports = router;
