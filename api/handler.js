// Universal API Route Handler for Timetable App & Telegram Bot Integration

import {
  getTelegramStatus,
  detectChannelId,
  sendTelegramBugReport
} from './telegram.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Supabase Public App Configuration
  if (pathname.endsWith('/config')) {
    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL || 'https://uryiomifyhcbvzeafizi.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    });
  }

  // 2. Bot Status & Health Check
  if (pathname.endsWith('/status') || pathname.endsWith('/health') || pathname.endsWith('/telegram/status')) {
    const telegramStatus = await getTelegramStatus();
    return res.status(200).json({
      status: 'ok',
      service: 'CSE Class A Timetable API',
      timestamp: new Date().toISOString(),
      telegram: telegramStatus
    });
  }

  // 3. Auto-Detect Telegram Channel ID
  if (pathname.endsWith('/detect') || pathname.endsWith('/telegram/detect')) {
    const detection = await detectChannelId();
    return res.status(200).json(detection);
  }

  // 4. Telegram Bug Report / Operational Alert
  if ((pathname.endsWith('/bug-report') || pathname.endsWith('/bugs/report')) && req.method === 'POST') {
    try {
      const result = await sendTelegramBugReport(req.body || {});
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'API route not found' });
}
