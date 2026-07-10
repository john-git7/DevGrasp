const { Octokit } = require('octokit');
const { indexRepository, analyzeRepository, cancelJob, isJobRunning, skipFile } = require('../services/indexer');
const Chunk = require('../models/Chunk');
const RepoStatus = require('../models/RepoStatus');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { decrypt } = require('../utils/crypto');

const isValidGithubUrl = (url) => {
  const pattern = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+(\/)?$/;
  return pattern.test(url);
};
async function getUserToken(userId) {
  const user = await User.findById(userId);
  if (user && user.githubToken && user.githubToken.encryptedData) {
    return decrypt(user.githubToken);
  }
  return null;
}

const getIndexedRepos = async (req, res) => {
  try {
    const chunkRepos = await Chunk.distinct('repoUrl');
    for (const url of chunkRepos) {
      await RepoStatus.updateOne(
        { repoUrl: url },
        { $setOnInsert: { status: 'complete', lastUpdated: Date.now() } },
        { upsert: true }
      );
    }
    const repos = await RepoStatus.find({ users: req.user.id }, 'repoUrl status indexedFiles totalFiles lastUpdated').sort({ lastUpdated: -1 }).lean();
    res.json(repos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch indexed repositories' });
  }
};

const getFile = async (req, res) => {
  const { repoUrl, filePath } = req.query;
  if (!repoUrl || !filePath) return res.status(400).json({ error: 'repoUrl and filePath are required' });
  if (!isValidGithubUrl(repoUrl)) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

  try {
    const chunks = await Chunk.find({ repoUrl, filePath }).sort({ _id: 1 });
    if (!chunks.length) return res.status(404).json({ error: 'File not found in index' });

    const content = chunks.map(c => c.content).join('');
    res.json({ content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch file content' });
  }
};

const analyze = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!isValidGithubUrl(url)) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

  try {
    const userToken = await getUserToken(req.user.id);
    const analysis = await analyzeRepository(url, userToken);
    res.json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to analyze repository' });
  }
};

const pause = (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  
  cancelJob(url);
  res.json({ success: true, message: 'Pause signal sent' });
};

const skip = (req, res) => {
  const { url, filePath } = req.body;
  if (!url || !filePath) return res.status(400).json({ error: 'url and filePath are required' });
  
  skipFile(url, filePath);
  res.json({ success: true, message: 'Skip signal sent' });
};

const index = async (req, res) => {
  const { url, embeddingModel, excludedExtensions } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'GitHub URL is required' });
  if (!isValidGithubUrl(url)) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

  if (isJobRunning(url)) {
    console.log(`Job already running for ${url}, ignoring duplicate request.`);
    return res.json({ success: true, message: 'Indexing already in progress' });
  }

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

  res.json({ success: true, message: 'Indexing started' });

  getUserToken(req.user.id).then(userToken => {
    indexRepository(url, null, embeddingModel, excludedExtensions, userToken)
      .catch(err => console.error(`Background indexing error for ${url}:`, err));
  });
};

const status = async (req, res) => {
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
};

const deleteRepo = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    await Conversation.deleteMany({ repoId: url, userId: req.user.id });

    const updatedRepo = await RepoStatus.findOneAndUpdate(
      { repoUrl: url },
      { $pull: { users: req.user.id } },
      { new: true }
    );

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
};

const getPRs = async (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
  try {
    let owner = '', repoName = '';
    const parts = repoUrl.split('/').filter(Boolean);
    if(parts.length >= 2) {
      owner = parts[parts.length - 2];
      repoName = parts[parts.length - 1].replace(/.git$/, '');
    } else {
      return res.status(400).json({ error: 'Invalid repoUrl format' });
    }
    
    const userToken = await getUserToken(req.user.id);
    const octokit = new Octokit({ auth: userToken || process.env.GITHUB_TOKEN });
    const prs = await octokit.rest.pulls.list({
      owner,
      repo: repoName,
      state: 'open',
      per_page: 20
    });
    
    const prData = prs.data.map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
      createdAt: pr.created_at
    }));
    
    res.json(prData);
  } catch (err) {
    console.error('Error fetching PRs:', err.message);
    res.status(500).json({ error: 'Failed to fetch PRs' });
  }
};

module.exports = {
  getIndexedRepos,
  getFile,
  analyze,
  pause,
  skip,
  index,
  status,
  deleteRepo,
  getPRs
};
