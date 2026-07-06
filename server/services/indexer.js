const { Octokit } = require('octokit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Chunk = require('../models/Chunk');
const RepoStatus = require('../models/RepoStatus');

// Setup Octokit and Gemini
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Authenticate to prevent strict rate limits
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// We will try text-embedding-004 first, but fallback to gemini-embedding-2 if it's a newer API key
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

// Helper function to split text into chunks
function chunkText(text, maxChars = 1000) {
  const chunks = [];
  let currentChunk = '';
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk.length + line.length) > maxChars) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Helper to handle 503 API High Demand errors
async function executeWithRetry(apiCall, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      attempt++;
      if ((error.status === 503 || error.status === 429) && attempt < maxRetries) {
        const waitTime = error.status === 429 ? 15000 : attempt * 5000;
        console.warn(`[${error.status}] Gemini API issue. Retrying attempt ${attempt} in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

async function indexRepository(repoUrl, onProgress = null) {
  try {
    // 1. Parse URL (e.g. https://github.com/facebook/react)
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) throw new Error('Invalid GitHub URL');
    const owner = urlParts[0];
    const repo = urlParts[1].replace(/\.git$/, ''); // Remove .git suffix if present

    console.log(`Starting index of ${owner}/${repo}...`);

    // 2. Fetch repo details to get the default branch
    let repoInfo;
    try {
      repoInfo = await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
      if (err.status === 404) {
        throw new Error(`Repository ${owner}/${repo} is either PRIVATE or does not exist. You must use a public repository unless you configure a GitHub Personal Access Token.`);
      }
      throw err;
    }
    const defaultBranch = repoInfo.data.default_branch;

    // 3. Fetch repo tree (recursive) using the exact default branch
    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: 'true'
    });

    const alreadyIndexed = await Chunk.distinct('filePath', { repoUrl });
    let files = treeResponse.data.tree.filter(
      item => item.type === 'blob' && !item.path.includes('node_modules') && !item.path.includes('.git')
    );

    const totalFilesCount = files.length;
    files = files.filter(f => !alreadyIndexed.includes(f.path));
    let processedCount = totalFilesCount - files.length;

    // Upsert the RepoStatus to 'indexing'
    await RepoStatus.findOneAndUpdate(
      { repoUrl },
      { 
        status: 'indexing', 
        totalFiles: totalFilesCount, 
        indexedFiles: processedCount,
        lastUpdated: Date.now()
      },
      { upsert: true, new: true }
    );

    console.log(`Found ${totalFilesCount} total files. Skipping ${processedCount} already indexed. Remaining: ${files.length}`);
    if (onProgress) {
      onProgress({ status: 'fetching', current: processedCount, total: totalFilesCount, file: '' });
    }

    // 3. Process each file
    for (const file of files) {
      // Basic extension filter to avoid binaries and large assets
      const ext = file.path.split('.').pop();
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'pdf', 'zip', 'woff', 'woff2'].includes(ext)) continue;

      // Fetch file content
      let fileContent = '';
      try {
        const contentRes = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          mediaType: { format: 'raw' }
        });
        fileContent = typeof contentRes.data === 'string' ? contentRes.data : '';
      } catch (e) {
        console.warn(`Could not fetch content for ${file.path}, skipping.`);
        continue;
      }
      
      if (!fileContent) continue;

      // 4. Chunking
      const chunks = chunkText(fileContent);

      for (let i = 0; i < chunks.length; i++) {
        const text = chunks[i];
        
        // 5. Generate Embedding
        const embeddingResult = await executeWithRetry(() => fallbackModel.embedContent(text));
        const embedding = embeddingResult.embedding.values;

        // 6. Save to MongoDB
        await Chunk.create({
          repoUrl,
          filePath: file.path,
          content: text,
          embedding
        });

        // Add a small 200ms delay to prevent absolutely hammering the API
        // (Removed the massive 4.5s delay! executeWithRetry will now dynamically handle rate limits)
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`Indexed ${file.path}`);
      processedCount++;
      
      // Update indexed count periodically (every 10 files) to save DB writes
      if (processedCount % 10 === 0) {
        await RepoStatus.updateOne({ repoUrl }, { indexedFiles: processedCount, lastUpdated: Date.now() });
      }

      if (onProgress) {
        onProgress({ status: 'indexing', current: processedCount, total: totalFilesCount, file: file.path });
      }
    }

    // Mark as complete
    await RepoStatus.updateOne({ repoUrl }, { status: 'complete', indexedFiles: totalFilesCount, lastUpdated: Date.now() });

    console.log(`Successfully indexed ${owner}/${repo}`);
    return { success: true, message: 'Indexing complete' };
  } catch (error) {
    console.error('Error during indexing:', error);
    // Mark as error
    await RepoStatus.updateOne({ repoUrl }, { status: 'error', lastUpdated: Date.now() }).catch(e => console.error(e));
    throw error;
  }
}

module.exports = { indexRepository };
