const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const output = path.join(root, 'public');
const frontendFiles = [
  'index.html', 'app.html', 'admin.html', 'styles.css', 'app.css',
  'shared-bootstrap.js', 'data.js', 'art.js', 'auth.js', 'app.js', 'admin.js'
];

fs.mkdirSync(output, { recursive: true });
for (const file of frontendFiles) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
console.log(`Copied ${frontendFiles.length} frontend files to public/.`);
