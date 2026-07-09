const fs = require('fs');
let c = fs.readFileSync('server/controllers/chatController.js', 'utf8');
// Find the exact line and replace it
c = c.replace(/const filePaths = \[\.\.\.new Set\(\[\.\.\.prDiff\.matchAll\(.*?\)\].*/, 'const filePaths = [...new Set([...prDiff.matchAll(/(?:\\+\\+\\+ b\\/|--- a\\/)(.*)/g)].map(m => m[1]))];');
fs.writeFileSync('server/controllers/chatController.js', c);
