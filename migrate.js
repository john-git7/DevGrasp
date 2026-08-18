const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'pages', 'ChatApp.jsx');
let content = fs.readFileSync(file, 'utf8');

// Add import api
content = content.replace(
  "import { AuthContext } from '../context/AuthContext';",
  "import api from '../lib/api';\nimport { AuthContext } from '../context/AuthContext';"
);

// Fetch replacer regexes
content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/indexed`\);/g, "const res = await api.get('/api/repos/indexed');");
content = content.replace(/if \(res\.ok\) \{/g, "if (res.status === 200) {");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/status\/usage`\);/g, "const res = await api.get('/api/status/usage');");

content = content.replace(/await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/pause`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ url \}\),\s*\}\);/g, "await api.post('/api/repos/pause', { url });");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/skip-file`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ url, filePath \}\),\s*\}\);/g, "const res = await api.post('/api/repos/skip-file', { url, filePath });");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/delete`, \{\s*method: 'DELETE',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ url \}\),\s*\}\);/g, "const res = await api.delete('/api/repos/delete', { data: { url } });");

content = content.replace(/const response = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/analyze`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ url: urlToAnalyze \}\),\s*\}\);/g, "const response = await api.post('/api/repos/analyze', { url: urlToAnalyze });");
content = content.replace(/if \(!response\.ok\) \{/g, "if (response.status !== 200) {");
content = content.replace(/const analysis = await response\.json\(\);/g, "const analysis = response.data;");

content = content.replace(/const response = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/index`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(payload\),\s*\}\);/g, "const response = await api.post('/api/repos/index', payload);");
content = content.replace(/const errData = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g, "const errData = response.data || {};");

content = content.replace(/const statusRes = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/status\?url=\$\{encodeURIComponent\(urlToIndex\)\}`\);/g, "const statusRes = await api.get(`/api/repos/status?url=${encodeURIComponent(urlToIndex)}`);");
content = content.replace(/if \(!statusRes\.ok\) throw new Error\('Status check failed'\);/g, "if (statusRes.status !== 200) throw new Error('Status check failed');");
content = content.replace(/const data = await statusRes\.json\(\);/g, "const data = statusRes.data;");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/chat\/history\?repoId=\$\{encodeURIComponent\(repoUrl\)\}`\);/g, "const res = await api.get(`/api/chat/history?repoId=${encodeURIComponent(repoUrl)}`);");
content = content.replace(/const data = await res\.json\(\);/g, "const data = res.data;");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/chat\/conversation\/\$\{convoId\}`\);/g, "const res = await api.get(`/api/chat/conversation/${convoId}`);");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/chat\/conversation\/\$\{id\}`, \{\s*method: 'DELETE'\s*\}\);/g, "const res = await api.delete(`/api/chat/conversation/${id}`);");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/prs\?repoUrl=\$\{encodeURIComponent\(repoUrl\)\}`\);/g, "const res = await api.get(`/api/repos/prs?repoUrl=${encodeURIComponent(repoUrl)}`);");

content = content.replace(/await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/chat\/conversation\/\$\{currentConversationId\}\/truncate`, \{\s*method: 'PUT',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ messageIndex: index \}\)\s*\}\);/g, "await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: index });");
content = content.replace(/await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/chat\/conversation\/\$\{currentConversationId\}\/truncate`, \{\s*method: 'PUT',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ messageIndex: userMessageIndex \}\)\s*\}\);/g, "await api.put(`/api/chat/conversation/${currentConversationId}/truncate`, { messageIndex: userMessageIndex });");

content = content.replace(/const res = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/repos\/file\?repoUrl=\$\{encodeURIComponent\(selectedRepo\)\}&filePath=\$\{encodeURIComponent\(filePath\)\}`\);/g, "const res = await api.get(`/api/repos/file?repoUrl=${encodeURIComponent(selectedRepo)}&filePath=${encodeURIComponent(filePath)}`);");

fs.writeFileSync(file, content, 'utf8');
console.log('Migration complete');
