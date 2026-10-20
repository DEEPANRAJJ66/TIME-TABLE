// Telegram Bot Audit & Operational Notification Service
// Institution: Saranathan College of Engineering (Autonomous)
// Target Bot: @DeepanCollegeLearningBot (8968622105)
// Target Channels: Private Audit Channel (-1003598863042), Bug Report Channel (-1004484073817)

const getBotToken = () => process.env.TELEGRAM_BOT_TOKEN || '';
const getAuditChannelId = () => process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_AUDIT_CHANNEL_ID || '-1003598863042';
const getBugChannelId = () => process.env.TELEGRAM_BUG_CHANNEL_ID || '-1004484073817';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatKolkataTime(dateInput = new Date()) {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const valid = isNaN(d?.getTime?.()) ? new Date() : d;
  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return new Intl.DateTimeFormat('en-IN', options).format(valid) + ' IST';
}

async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { ok: false, description: text.substring(0, 150) };
  }
  return { res, data };
}

/**
 * Checks connection status of the Telegram Bot
 */
export async function getTelegramStatus() {
  const token = getBotToken();
  const channelId = getAuditChannelId();

  if (!token) {
    return {
      configured: false,
      ready: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured.'
    };
  }

  try {
    const { data } = await safeFetchJson(`https://api.telegram.org/bot${token}/getMe`);
    if (data.ok && data.result) {
      return {
        configured: true,
        ready: !!channelId,
        bot: {
          id: data.result.id,
          username: data.result.username,
          first_name: data.result.first_name
        },
        channelId,
        message: `Bot @${data.result.username} is connected and ready.`
      };
    }
    return {
      configured: false,
      ready: false,
      error: data.description || 'Authentication failed'
    };
  } catch (err) {
    return {
      configured: false,
      ready: false,
      error: err.message
    };
  }
}

/**
 * Auto-detects Channel ID from incoming updates
 */
export async function detectChannelId() {
  const token = getBotToken();
  if (!token) return { found: false, error: 'Telegram Bot Token not configured' };

  try {
    const { data } = await safeFetchJson(`https://api.telegram.org/bot${token}/getUpdates`);
    if (!data.ok || !Array.isArray(data.result)) {
      return { found: false, error: data.description || 'Failed to fetch updates' };
    }

    for (let i = data.result.length - 1; i >= 0; i--) {
      const u = data.result[i];
      const chat = u.channel_post?.chat || u.my_chat_member?.chat || u.message?.chat;
      if (chat && (chat.type === 'channel' || chat.type === 'supergroup')) {
        return {
          found: true,
          channelId: String(chat.id),
          title: chat.title,
          username: chat.username || null
        };
      }
    }
    return { found: false, message: 'No recent channel messages found.' };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

/**
 * Dispatches an audit event to the dedicated Private Audit Channel
 */
export async function sendTelegramAuditEvent(eventType, resource = {}, metadata = {}) {
  const token = getBotToken();
  const channelId = getAuditChannelId();

  if (!token || !channelId) {
    return {
      delivered: false,
      skipped: true,
      reason: 'Telegram Bot Token or Audit Channel ID not configured'
    };
  }

  const timestamp = formatKolkataTime(metadata.timestamp || new Date());
  const actorName = metadata.actorName || resource.uploaderName || 'System';
  const actorRole = (metadata.actorRole || 'manager').toUpperCase();
  const actorEmail = metadata.actorEmail || resource.uploaderEmail || '';

  const lines = [
    `📢 <b>COLLEGE PLATFORM AUDIT EVENT</b>\n`,
    `<b>Action:</b> <code>${escapeHtml(eventType)}</code>`,
    `<b>Actor:</b> ${escapeHtml(actorName)} (${escapeHtml(actorRole)})`,
    actorEmail ? `<b>Email:</b> <code>${escapeHtml(actorEmail)}</code>` : null,
    resource.title ? `<b>Title:</b> ${escapeHtml(resource.title)}` : null,
    resource.subjectId ? `<b>Subject:</b> <code>${escapeHtml(resource.subjectId)}</code>` : null,
    resource.googleDriveFileId ? `<b>Drive File ID:</b> <code>${escapeHtml(resource.googleDriveFileId)}</code>` : null,
    metadata.reason ? `<b>Reason / Notes:</b> ${escapeHtml(metadata.reason)}` : null,
    `\n<b>Time:</b> ${escapeHtml(timestamp)}`,
    `#Audit #${escapeHtml(eventType)} #CSE_ClassA`
  ].filter(Boolean);

  const messageText = lines.join('\n');

  try {
    const { res, data } = await safeFetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!res.ok || !data.ok) {
      throw new Error(data.description || `HTTP ${res.status}`);
    }

    return {
      delivered: true,
      messageId: data.result?.message_id
    };
  } catch (err) {
    console.warn('Telegram audit dispatch failed:', err.message);
    return {
      delivered: false,
      error: err.message
    };
  }
}

/**
 * Dispatches an in-app bug report to the Bug Report Channel
 */
export async function sendTelegramBugReport(report = {}) {
  const token = getBotToken();
  const channelId = getBugChannelId();

  if (!token || !channelId) {
    throw new Error('Telegram credentials missing for bug reporting.');
  }

  const reportId = report.id || ('BUG-' + Date.now().toString(36).toUpperCase());
  const timestamp = formatKolkataTime(report.createdAt || new Date());

  const lines = [
    '🐞 <b>NEW BUG REPORT</b>\n',
    `<b>Report ID:</b> <code>${escapeHtml(reportId)}</code>`,
    `<b>Title:</b> ${escapeHtml(report.title || 'Untitled')}`,
    `<b>Reporter:</b> ${escapeHtml(report.reporterName || 'Anonymous')}`,
    `<b>Role:</b> ${escapeHtml(report.reporterRole || 'Student')}`,
    `<b>Email:</b> <code>${escapeHtml(report.reporterEmail || 'N/A')}</code>`,
    report.reporterRollNumber ? `<b>Roll Number:</b> <code>${escapeHtml(report.reporterRollNumber)}</code>` : null,
    `<b>Category:</b> ${escapeHtml(report.category || 'General')}`,
    `<b>Severity:</b> ${escapeHtml(report.severity || 'Medium')}`,
    `<b>Affected Page:</b> ${escapeHtml(report.affectedPage || 'Dashboard')}`,
    `\n<b>Description:</b>\n${escapeHtml(report.description || 'No description provided')}`,
    `\n<b>Submitted At:</b> ${escapeHtml(timestamp)}`,
    `#BugReport #CollegeApp`
  ].filter(Boolean);

  const { res, data } = await safeFetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: lines.join('\n'),
      parse_mode: 'HTML'
    })
  });

  if (!res.ok || !data.ok) {
    throw new Error(data.description || `HTTP ${res.status}`);
  }

  return {
    success: true,
    messageId: data.result?.message_id
  };
}
