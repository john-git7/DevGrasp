const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(file, 'utf8');

// Add import for retry.js
content = content.replace(
  "const usageTracker = require('./services/usageTracker');",
  "const usageTracker = require('./services/usageTracker');\nconst { executeWithRetry } = require('./utils/retry');"
);

// Remove executeWithRetry definition
// It looks something like:
// async function executeWithRetry(apiCall, maxRetries = 3) { ... }
const retryRegex = /async function executeWithRetry\(apiCall, maxRetries = 3\) \{[\s\S]*?\}\n\}\n/g;
content = content.replace(retryRegex, '');

fs.writeFileSync(file, content, 'utf8');
console.log('index.js migration complete');
