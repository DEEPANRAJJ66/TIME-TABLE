import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('.');
const outDir = path.resolve('./www');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('Building web directory for Capacitor at:', outDir);

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'learning.html',
  'learning.css',
  'data',
  'js',
  'assets',
  'INTRO',
  'cse.jpeg'
];

filesToCopy.forEach((item) => {
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(outDir, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`✓ Copied ${item}`);
  }
});

console.log('Build completed successfully!');
