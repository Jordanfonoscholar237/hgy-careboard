const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const hostingSrc = path.join(root, '.openai', 'hosting.json');
const hostingDestDir = path.join(root, 'dist', '.openai');
const hostingDest = path.join(hostingDestDir, 'hosting.json');
const devVars = path.join(root, 'dist', 'server', '.dev.vars');

fs.mkdirSync(hostingDestDir, { recursive: true });
fs.copyFileSync(hostingSrc, hostingDest);

if(fs.existsSync(devVars)){
  fs.rmSync(devVars, { force: true });
}

console.log('Staged Sites artifact metadata.');
