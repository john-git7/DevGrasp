const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'client/src/App.jsx',
  'client/src/components/ChatMessage.jsx',
  'client/src/components/RepoModal.jsx',
  'client/src/components/WorkspaceModal.jsx'
];

const replacements = [
  { from: /var\(--color-theme-bg\)/g, to: 'var(--color-apple-bg)' },
  { from: /var\(--color-theme-panel\)/g, to: 'var(--color-apple-glass)' },
  { from: /var\(--color-theme-accent\)/g, to: 'var(--color-apple-blue)' },
  { from: /var\(--color-theme-text\)/g, to: 'var(--color-apple-text)' },
  
  { from: /flat-panel/g, to: 'apple-glass-panel' },
  { from: /flat-pill/g, to: 'apple-glass-pill' },
  { from: /modal-backdrop/g, to: 'apple-modal-backdrop' },
  
  { from: /#000000/gi, to: 'var(--color-apple-bg)' },
  { from: /#121212/gi, to: 'var(--color-apple-glass)' },
  { from: /#9333ea/gi, to: 'var(--color-apple-blue)' },
  { from: /#c084fc/gi, to: 'var(--color-apple-text)' },
  
  { from: /bg-purple-600/g, to: 'bg-[#0a84ff]' },
  { from: /bg-purple-400/g, to: 'bg-[#0a84ff]' },
  { from: /text-purple-400/g, to: 'text-[#0a84ff]' },
  
  // Clean up rounded corners to make them more Apple-like (squircle)
  { from: /rounded-lg/g, to: 'rounded-2xl' },
  { from: /rounded-xl/g, to: 'rounded-2xl' },
  
  // Update borders to subtle white
  { from: /border-\[var\(--color-apple-blue\)\]\/50/g, to: 'border-[var(--color-apple-border)]' },
  { from: /border-\[var\(--color-apple-blue\)\]\/20/g, to: 'border-[var(--color-apple-border)]' },
  { from: /border-\[var\(--color-apple-blue\)\]/g, to: 'border-[var(--color-apple-border)]' }
];

filesToUpdate.forEach(relPath => {
  const fullPath = path.join('d:/DevMind', relPath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${relPath}`);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});
