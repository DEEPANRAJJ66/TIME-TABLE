import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('.');
const targets = [
  path.resolve('./www'),
  path.resolve('./public')
];

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

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'data',
  'js',
  'assets',
  'INTRO',
  'cse.jpeg'
];

targets.forEach((outDir) => {
  console.log('Building web directory at:', outDir);
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  filesToCopy.forEach((item) => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(outDir, item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      console.log(`✓ Copied ${item} to ${path.basename(outDir)}`);
    }
  });
});

console.log('Build completed successfully!');
