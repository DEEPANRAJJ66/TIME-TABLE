// Google Drive OAuth 2.0 Authorization Helper
// Institution: Saranathan College of Engineering (Autonomous)
// Generates fresh, long-lived OAuth refresh tokens for personal Google Drive storage

import fs from 'fs';
import path from 'path';
import http from 'http';
import url from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const folderId = process.env.GOOGLE_DRIVE_APPROVED_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || '1l-K5elNmYw_THQXCEvucT2BRzNtbKhYi';
const redirectUri = 'http://localhost:3000/oauth2callback';

console.log('========================================================================');
console.log('GOOGLE DRIVE OAUTH 2.0 REFRESH TOKEN AUTHORIZATION HELPER');
console.log('Institution: Saranathan College of Engineering (Autonomous)');
console.log('========================================================================\n');

if (!clientId || !clientSecret) {
  console.error('❌ Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be present in .env');
  process.exit(1);
}

const scopes = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file';
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

console.log('1. PRE-REQUISITE (PREVENT 7-DAY EXPIRATION):');
console.log('   In Google Cloud Console (https://console.cloud.google.com/apis/credentials/consent):');
console.log('   Under "Publishing status", click "PUBLISH APP" so status is "In production".');
console.log('   (In "Testing" status, Google automatically expires all refresh tokens every 7 days!)\n');

console.log('2. OPEN THIS AUTHORIZATION LINK IN YOUR BROWSER:');
console.log('   👉 ' + authUrl + '\n');
console.log('   Make sure you sign in with the Google Account that owns the folder (jeyaramandeeban@gmail.com).');
console.log('   Click "Advanced" > "Go to [App Name] (unsafe)" > "Continue" / "Allow".\n');

console.log('3. CALLBACK HANDLING:');
console.log('   After clicking Allow, Google will redirect to:');
console.log('   ' + redirectUri);
console.log('   Your running application server (server.js on port 3000) will automatically capture');
console.log('   the authorization code, retrieve the new refresh token, activate it in memory,');
console.log('   and save it to .env!\n');

console.log('4. ALTERNATIVE: GOOGLE OAUTH 2.0 PLAYGROUND:');
console.log('   If you prefer using Google OAuth Playground:');
console.log('   a) Go to https://developers.google.com/oauthplayground');
console.log('   b) Click the Gear icon (top right) -> Check "Use your own OAuth credentials"');
console.log('   c) Enter your Client ID and Client Secret');
console.log('   d) In Step 1 (left): Enter scope "https://www.googleapis.com/auth/drive.file" and click "Authorize APIs"');
console.log('   e) In Step 2: Click "Exchange authorization code for tokens"');
console.log('   f) Copy the "Refresh token" value into .env and Vercel!\n');
console.log('========================================================================\n');
