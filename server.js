// Production HTTP Server
// Institution: Saranathan College of Engineering (Autonomous)
// Hosts Timetable Planner (index.html) and College Learning Platform (learning.html)

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import { PlatformStore } from './api/store.js';
import { ModerationService } from './api/moderation.js';
import { handleApiRequest } from './api/handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple native .env loader
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            // Remove wrapping quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log('Environment configuration loaded from .env');
    } catch (err) {
      console.warn('Warning: Could not read .env file:', err.message);
    }
  }
}

loadEnv();

// Initialize Central Store and Moderation Service
const store = new PlatformStore();
const moderationService = new ModerationService(store);

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=UTF-8'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Delegate API requests to the API handler
  if (pathname.startsWith('/api/')) {
    return handleApiRequest(req, res, store, moderationService);
  }

  // Routing for static and web application pages
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html'; // Serves original preserved Timetable app
  } else if (pathname === '/learning' || pathname === '/auth/callback') {
    pathname = '/learning.html'; // Serves modern College Learning Platform
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  // Security: Prevent path traversal outside the project directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 handler
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found - Saranathan College</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>404 - Page Not Found</h2>
          <p>The requested file does not exist.</p>
          <p><a href="/">Go to Timetable Planner</a> | <a href="/learning.html">Go to Learning Platform</a></p>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`SARANATHAN COLLEGE OF ENGINEERING - AUTONOMOUS`);
  console.log(`B.E. Computer Science and Engineering - Class A`);
  console.log(`Platform Running at: http://localhost:${PORT}`);
  console.log(`- Timetable Planner:  http://localhost:${PORT}/`);
  console.log(`- Learning Platform:  http://localhost:${PORT}/learning.html`);
  console.log(`=======================================================`);
});

export default server;
