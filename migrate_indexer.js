const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'services', 'indexer.js');
let content = fs.readFileSync(file, 'utf8');

// Replace local imports
content = content.replace(
  "const { getLocalEmbedding } = require('./localEmbedder');",
  "const { getLocalEmbedding } = require('./localEmbedder');\nconst { executeWithRetry } = require('../utils/retry');"
);

// Remove executeWithRetry function and interruptibleSleep
const retryRegex = /async function interruptibleSleep[\s\S]*?async function executeWithRetry[\s\S]*?\}\n\}\n/g;
content = content.replace(retryRegex, '');

// Remove global octokit
content = content.replace("const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN }); // Authenticate to prevent strict rate limits\n", "");

// Update analyzeRepository signature
content = content.replace(
  "async function analyzeRepository(repoUrl) {",
  "async function analyzeRepository(repoUrl, userToken = null) {\n  const octokit = new Octokit({ auth: userToken || process.env.GITHUB_TOKEN });"
);

// Update indexRepository signature
content = content.replace(
  "async function indexRepository(repoUrl, onProgress = null, embeddingModel = 'gemini-embedding-001', excludedExtensionsInput) {",
  "async function indexRepository(repoUrl, onProgress = null, embeddingModel = 'gemini-embedding-001', excludedExtensionsInput, userToken = null) {\n  const octokit = new Octokit({ auth: userToken || process.env.GITHUB_TOKEN });"
);

// Update the executeWithRetry call in indexRepository
content = content.replace(
  /const embeddingResult = await executeWithRetry\([\s\S]*? \(\) => \{\n\s*if \(\!activeJobs\[repoUrl\]\) return false;\n\s*if \(activeJobs\[repoUrl\]\.cancel\) return true;\n\s*if \(activeJobs\[repoUrl\]\.skipFile === file\.path\) return 'SKIP_FILE';\n\s*return false;\n\s*\}\n\s*\);/g,
  `const embeddingResult = await executeWithRetry(
                () => model.batchEmbedContents({
                  requests: chunkBatch.map(text => ({
                    content: { parts: [{ text }] }
                  }))
                }),
                {
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
              );`
);

fs.writeFileSync(file, content, 'utf8');
console.log('indexer.js migration complete');
