const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const workerSource = path.join(root, 'sites-worker.template.js');
const dbPath = path.join(root, 'data', 'db.json');

function copyDir(src, dest){
  fs.mkdirSync(dest, {recursive: true});
  for(const entry of fs.readdirSync(src, {withFileTypes: true})){
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if(entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(dist, {recursive: true, force: true});
copyDir(publicDir, dist);

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const worker = fs.readFileSync(workerSource, 'utf8')
  .replace('__LIFEVIEW_DB_JSON__', JSON.stringify(db));
fs.writeFileSync(path.join(dist, '_worker.js'), worker);

console.log('Built Sites bundle in dist/');
