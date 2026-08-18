const { Octokit } = require('octokit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Chunk = require('../models/Chunk');
const RepoStatus = require('../models/RepoStatus');
const usageTracker = require('./usageTracker');
const { getLocalEmbedding } = require('./localEmbedder');
const { executeWithRetry } = require('../utils/retry');

const activeJobs = {};

// Setup Octokit and Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// Helper to check if file is valid source code (ignores stream segments and hidden folders)
function isValidSourceFile(filePath) {
  if (filePath.includes('node_modules') || filePath.includes('.git')) return false;
  if (filePath.match(/(^|\/)(streams|video)\//i)) return false;
  if (filePath.match(/\.(mp4|mov|mkv|webm)\//i)) return false;
  if (filePath.match(/seg_.*\.ts$/i)) return false;
  return true;
}

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


async function analyzeRepository(repoUrl, userToken = null) {
  const octokit = new Octokit({ auth: userToken || process.env.GITHUB_TOKEN });
  try {
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) throw new Error('Invalid GitHub URL');
    const owner = urlParts[0];
    const repo = urlParts[1].replace(/\.git$/, '');

    let repoInfo;
    try {
      repoInfo = await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
      if (err.status === 404) {
        throw new Error(`Repository ${owner}/${repo} is either PRIVATE or does not exist.`);
      }
      throw err;
    }
    const defaultBranch = repoInfo.data.default_branch;

    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: 'true'
    });

    const files = treeResponse.data.tree.filter(
      item => item.type === 'blob' && isValidSourceFile(item.path)
    );

    const extensionCounts = {};
    for (const file of files) {
      const parts = file.path.split('.');
      const ext = parts.length > 1 ? '.' + parts.pop().toLowerCase() : '(no extension)';
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }

    const alwaysExclude = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.mp4', '.mp3', '.wav', '.csv', '.log', '.exe', '.dll', '.so', '.dylib', '.tar', '.gz'];

    const extensions = Object.keys(extensionCounts).map(ext => {
      return {
        extension: ext,
        count: extensionCounts[ext],
        defaultExclude: alwaysExclude.includes(ext)
      };
    }).sort((a, b) => b.count - a.count);

    return {
      repoUrl,
      totalFiles: files.length,
      extensions
    };
  } catch (error) {
    throw error;
  }
}

async function indexRepository(repoUrl, onProgress = null, embeddingModel = 'gemini-embedding-001', excludedExtensionsInput, userToken = null) {
  const octokit = new Octokit({ auth: userToken || process.env.GITHUB_TOKEN });
  // Clear any stale cancellation state from previous runs
  activeJobs[repoUrl] = { cancel: false };
  const isLocal = embeddingModel === 'local-MiniLM';
  const model = isLocal ? null : genAI.getGenerativeModel({ model: embeddingModel });
  try {
    // 1. Parse URL (e.g. https://github.com/facebook/react)
    const urlParts = new URL(repoUrl).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) throw new Error('Invalid GitHub URL');
    const owner = urlParts[0];
    const repo = urlParts[1].replace(/\.git$/, ''); // Remove .git suffix if present

    console.log(`Starting index of ${owner}/${repo}...`);

    let existingStatus = await RepoStatus.findOne({ repoUrl });
    let excludedExtensions = [];
    if (excludedExtensionsInput !== undefined) {
      excludedExtensions = excludedExtensionsInput;
    } else if (existingStatus && existingStatus.excludedExtensions) {
      excludedExtensions = existingStatus.excludedExtensions;
    }

    // Start a heartbeat to keep the SSE proxy connection alive
    const fetchHeartbeat = setInterval(() => {
      if (onProgress) onProgress({ status: 'fetching', message: 'Fetching GitHub...' });
    }, 1000);

    // 2. Fetch repo details to get the default branch
    let repoInfo;
    try {
      repoInfo = await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
      clearInterval(fetchHeartbeat);
      if (err.status === 404) {
        throw new Error(`Repository ${owner}/${repo} is either PRIVATE or does not exist. You must use a public repository unless you configure a GitHub Personal Access Token.`);
      }
      throw err;
    }
    const defaultBranch = repoInfo.data.default_branch;

    // 3. Get the latest commit SHA for the default branch
    const branchResponse = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: defaultBranch
    });

    // 4. Get the full tree recursively
    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branchResponse.data.commit.sha,
      recursive: 'true'
    });

    clearInterval(fetchHeartbeat);

    // Build a Map of already-indexed file paths and their SHAs.
    // The cursor approach streams results so memory usage stays constant regardless of repo size.
    const alreadyIndexed = new Map();
    const indexedCursor = Chunk.aggregate([
      { $match: { repoUrl } },
      { $group: { _id: '$filePath', sha: { $first: '$fileSha' } } }
    ]).cursor();
    for await (const doc of indexedCursor) {
      alreadyIndexed.set(doc._id, doc.sha);
    }

    let files = treeResponse.data.tree.filter(
      item => item.type === 'blob' && isValidSourceFile(item.path)
    );

    // Filter out excluded extensions upfront so totalFilesCount is accurate
    files = files.filter(file => {
      const ext = file.path.split('.').length > 1 ? '.' + file.path.split('.').pop().toLowerCase() : '(no extension)';
      return !excludedExtensions.includes(ext);
    });

    const totalFilesCount = files.length;
    let filesToProcess = [];
    let filesToDelete = [];
    const currentPaths = new Set();
    
    for (const file of files) {
      currentPaths.add(file.path);
      const existingSha = alreadyIndexed.get(file.path);
      
      if (!alreadyIndexed.has(file.path)) {
        // New file
        filesToProcess.push(file);
      } else if (existingSha !== file.sha) {
        // Modified file (or missing SHA from old index)
        filesToProcess.push(file);
        filesToDelete.push(file.path);
      }
    }
    
    // Check for deleted files
    for (const [path] of alreadyIndexed.entries()) {
      if (!currentPaths.has(path)) {
        filesToDelete.push(path);
      }
    }
    
    // Delete chunks for modified and deleted files
    if (filesToDelete.length > 0) {
      console.log(`Deleting chunks for ${filesToDelete.length} modified/deleted files...`);
      await Chunk.deleteMany({ repoUrl, filePath: { $in: filesToDelete } });
    }
    
    files = filesToProcess;
    let processedCount = totalFilesCount - files.length;

    if (activeJobs[repoUrl]?.cancel) {
      console.log(`Indexing aborted early for ${repoUrl} due to disconnect during fetching`);
      delete activeJobs[repoUrl];
      return;
    }

    // Upsert the RepoStatus to 'indexing'
    await RepoStatus.findOneAndUpdate(
      { repoUrl },
      { 
        status: 'indexing', 
        totalFiles: totalFilesCount, 
        indexedFiles: processedCount,
        excludedExtensions,
        lastUpdated: Date.now()
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`Found ${totalFilesCount} total files. Skipping ${processedCount} already indexed. Remaining: ${files.length}`);
    if (onProgress) {
      onProgress({ status: 'fetching', current: processedCount, total: totalFilesCount, file: '' });
    }

    // 3. Process each file
    for (const file of files) {
      if (activeJobs[repoUrl]?.cancel) {
        console.log(`Indexing paused for ${repoUrl}`);
        await RepoStatus.findOneAndUpdate(
          { repoUrl },
          { status: 'paused', lastUpdated: Date.now() },
          { returnDocument: 'after' }
        );
        if (onProgress) onProgress({ status: 'paused', message: 'Indexing paused by user' });
        delete activeJobs[repoUrl];
        return;
      }

      if (activeJobs[repoUrl] && activeJobs[repoUrl].skipFile === file.path) {
        console.log(`Skipping file ${file.path} by user request before starting.`);
        await Chunk.deleteMany({ repoUrl, filePath: file.path });
        await RepoStatus.updateOne(
          { repoUrl },
          { $addToSet: { excludedFiles: file.path } }
        );
        activeJobs[repoUrl].skipFile = null;
        processedCount++;
        continue;
      }

      // Update progress in DB at the START of the file so polling gets the active file!
      await RepoStatus.updateOne({ repoUrl }, { indexedFiles: processedCount, currentFile: file.path, lastUpdated: Date.now() });

      if (onProgress) {
        onProgress({ status: 'indexing', current: processedCount, total: totalFilesCount, file: file.path });
      }

      try {
        // Fetch file content
        let fileContent = '';
        try {
          const fetchPromise = octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            mediaType: { format: 'raw' }
          });
          const cancelFetch = new Promise((_, reject) => {
            const interval = setInterval(() => {
              if (activeJobs[repoUrl]) {
                if (activeJobs[repoUrl].skipFile === file.path) {
                  clearInterval(interval);
                  reject(new Error('FILE_SKIPPED'));
                } else if (activeJobs[repoUrl].cancel) {
                  clearInterval(interval);
                  reject(new Error('JOB_CANCELLED'));
                }
              }
            }, 500);
            fetchPromise.finally(() => clearInterval(interval)).catch(() => {});
          });
          const contentRes = await Promise.race([fetchPromise, cancelFetch]);
          fileContent = typeof contentRes.data === 'string' ? contentRes.data : '';
        } catch (e) {
          console.warn(`Could not fetch content for ${file.path}, skipping.`);
          continue;
        }
        
        if (!fileContent) continue;

        // 4. Chunking
        const chunks = chunkText(fileContent);

        if (chunks.length > 0) {
          if (activeJobs[repoUrl] && activeJobs[repoUrl].cancel) {
            throw new Error('JOB_CANCELLED');
          }
          if (activeJobs[repoUrl] && activeJobs[repoUrl].skipFile === file.path) {
            throw new Error('FILE_SKIPPED');
          }

          // 5. Generate Embeddings in batches of 100
          const batchSize = 100;
          const embeddings = [];

          for (let j = 0; j < chunks.length; j += batchSize) {
            if (activeJobs[repoUrl] && activeJobs[repoUrl].cancel) {
              throw new Error('JOB_CANCELLED');
            }
            if (activeJobs[repoUrl] && activeJobs[repoUrl].skipFile === file.path) {
              throw new Error('FILE_SKIPPED');
            }
            
            const chunkBatch = chunks.slice(j, j + batchSize);
            
            if (!isLocal) {
              // Proactive rate limit handling: Gemini free tier allows 15 RPM
              let usage = usageTracker.getUsage();
              while (usage.embeddings.rpm >= 14) {
                if (onProgress) {
                  onProgress({ 
                    status: 'quota_wait', 
                    message: 'Approaching API limit, waiting for quota window to clear...', 
                    waitTime: 10000 
                  });
                }
                const cancelVal = await executeWithRetry(() => new Promise(r => setTimeout(r, 10000)), {
                  maxRetries: 1,
                  checkCancel: () => {
                    if (!activeJobs[repoUrl]) return false;
                    if (activeJobs[repoUrl].cancel) return true;
                    if (activeJobs[repoUrl].skipFile === file.path) return 'SKIP_FILE';
                    return false;
                  }
                });
                
                if (cancelVal === true) throw new Error('JOB_CANCELLED');
                if (cancelVal === 'SKIP_FILE') throw new Error('FILE_SKIPPED');
                
                usage = usageTracker.getUsage();
              }
            }

            let batchEmbeddings;
            if (isLocal) {
              const localPromise = getLocalEmbedding(chunkBatch);
              const cancelLocal = new Promise((_, reject) => {
                const interval = setInterval(() => {
                  if (activeJobs[repoUrl]) {
                    if (activeJobs[repoUrl].skipFile === file.path) {
                      clearInterval(interval);
                      reject(new Error('FILE_SKIPPED'));
                    } else if (activeJobs[repoUrl].cancel) {
                      clearInterval(interval);
                      reject(new Error('JOB_CANCELLED'));
                    }
                  }
                }, 500);
                localPromise.finally(() => clearInterval(interval)).catch(() => {});
              });
              batchEmbeddings = await Promise.race([localPromise, cancelLocal]);
            } else {
              const embeddingResult = await executeWithRetry(
                () => model.batchEmbedContents({
                  requests: chunkBatch.map(text => ({
                    content: { parts: [{ text }] }
                  }))
                }),
                {
                  maxRetries: 10,
                  onProgress: (progressData) => {
                    RepoStatus.updateOne(
                      { repoUrl },
                      { 
                        status: progressData.status === 'quota_wait' ? 'quota_wait' : 'indexing',
                        waitTime: progressData.status === 'quota_wait' ? (progressData.waitTime || 60000) : 0,
                        lastUpdated: Date.now()
                      }
                    ).catch(e => console.error('Failed to update RepoStatus in executeWithRetry:', e));
                    if (onProgress) onProgress(progressData);
                  },
                  checkCancel: () => {
                    if (!activeJobs[repoUrl]) return false;
                    if (activeJobs[repoUrl].cancel) return true;
                    if (activeJobs[repoUrl].skipFile === file.path) return 'SKIP_FILE';
                    return false;
                  }
                }
              );

              usageTracker.trackEmbeddingRequest(); // Tracks 1 API call per batch
              batchEmbeddings = embeddingResult ? embeddingResult.embeddings : null;
            }

            if (batchEmbeddings) {
              embeddings.push(...batchEmbeddings);
            }
          }

          // 6. Save all chunks to MongoDB
          for (let i = 0; i < chunks.length; i++) {
            if (embeddings[i] && embeddings[i].values) {
              await Chunk.create({
                repoUrl,
                filePath: file.path,
                fileSha: file.sha,
                content: chunks[i],
                embedding: embeddings[i].values
              });
            }
          }

          // Add a small 200ms delay per file to prevent hitting raw RPM/concurrency limits
          await new Promise(r => setTimeout(r, 200));
        }

        console.log(`Indexed ${file.path}`);
        processedCount++;
      } catch (innerError) {
        if (innerError.message === 'FILE_SKIPPED') {
          const skippedPath = activeJobs[repoUrl]?.skipFile || file.path;
          console.log(`Skipping file ${skippedPath} by user request during processing.`);
          
          // Clear any chunks already saved for this file
          await Chunk.deleteMany({ repoUrl, filePath: skippedPath });
          
          // Permanently add this file path to excludedFiles in database
          await RepoStatus.updateOne(
            { repoUrl },
            { 
              $addToSet: { excludedFiles: skippedPath },
              status: 'indexing',
              indexedFiles: processedCount + 1,
              currentFile: null,
              lastUpdated: Date.now()
            }
          );

          if (activeJobs[repoUrl]) {
            activeJobs[repoUrl].skipFile = null;
          }
          processedCount++;

          if (onProgress) {
            onProgress({ status: 'indexing', current: processedCount, total: totalFilesCount, file: '' });
          }
          continue;
        }
        throw innerError;
      }
    }

    // Mark as complete
    await RepoStatus.updateOne({ repoUrl }, { status: 'complete', indexedFiles: totalFilesCount, currentFile: null, lastUpdated: Date.now() });

    console.log(`Successfully indexed ${owner}/${repo}`);
    if (onProgress) onProgress({ status: 'complete', repoUrl });
    delete activeJobs[repoUrl];
    return { success: true, message: 'Indexing complete' };
  } catch (error) {
    if (error.message === 'JOB_CANCELLED') {
      console.log(`Job cancelled for ${repoUrl} inside chunking/retry`);
      await RepoStatus.updateOne({ repoUrl }, { status: 'paused', lastUpdated: Date.now() });
      if (onProgress) onProgress({ status: 'paused', message: 'Indexing paused.' });
      delete activeJobs[repoUrl];
      return;
    }

    console.error(`Indexing error for ${repoUrl}:`, error);
    // Mark as error
    await RepoStatus.findOneAndUpdate(
      { repoUrl },
      { status: 'error', lastUpdated: Date.now() },
      { returnDocument: 'after' }
    );
    if (onProgress) onProgress({ status: 'error', error: error.message });
    delete activeJobs[repoUrl];
    throw error;
  }
}

function cancelJob(repoUrl) {
  if (activeJobs[repoUrl]) {
    activeJobs[repoUrl].cancel = true;
  } else {
    activeJobs[repoUrl] = { cancel: true };
  }
}

function skipFile(repoUrl, filePath) {
  if (activeJobs[repoUrl]) {
    activeJobs[repoUrl].skipFile = filePath;
  }
}

// Returns true if a job is actively running (not cancelled) for this URL
function isJobRunning(repoUrl) {
  return !!(activeJobs[repoUrl] && !activeJobs[repoUrl].cancel);
}

module.exports = { indexRepository, analyzeRepository, cancelJob, isJobRunning, skipFile };
