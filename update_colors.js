const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'client/src/App.jsx',
  'client/src/components/ChatMessage.jsx',
  'client/src/components/RepoModal.jsx',
  'client/src/components/WorkspaceModal.jsx',
  'client/src/index.css'
];

const replacements = [
  { from: /--color-teal-dark/g, to: '--color-theme-bg' },
  { from: /--color-teal-deep/g, to: '--color-theme-panel' },
  { from: /--color-teal-bright/g, to: '--color-theme-accent' },
  { from: /--color-teal-light/g, to: '--color-theme-text' },
  
  { from: /#005461/gi, to: '#000000' },     // bg -> black
  { from: /#0C7779/gi, to: '#121212' },     // panel -> dark grey
  { from: /#249E94/gi, to: '#9333ea' },     // accent -> purple
  { from: /#3BC1A8/gi, to: '#c084fc' },     // text/highlight -> light purple
  
  { from: /bg-teal-500/g, to: 'bg-purple-600' },
  { from: /bg-cyan-500/g, to: 'bg-purple-400' },
  { from: /text-cyan-400/g, to: 'text-purple-400' },
  { from: /rgba\(0, 84, 97, 0\.[0-9]+\)/g, to: 'rgba(147, 51, 234, 0.3)' } // shadows/overlays to purple with opacity
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
