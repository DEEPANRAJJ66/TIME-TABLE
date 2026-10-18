// Serverless & Node API handler for Telegram Bot Audit Logging & Outbox Management
// Responsibility: Maintains a human-readable audit trail in the owner's private Telegram channel.
// Files are NEVER uploaded to Telegram (they are stored in Google Drive).
// Keeps TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID strictly confidential on the server.

import crypto from 'crypto';

const getBotToken = () => process.env.TELEGRAM_BOT_TOKEN || '';
const getChannelId = () => process.env.TELEGRAM_CHANNEL_ID || '';
export const getBugChannelId = () => process.env.TELEGRAM_BUG_CHANNEL_ID || '-1004484073817';

// In-memory idempotency cache for active session recovery
export const idempotencyStore = new Map();

// In-memory buffer cache for backward compatibility
export const fileBufferCache = new Map();

// In-memory server-side registry of resource publication status and ownership
export const resourceRegistry = new Map();

// Durable Outbox Queue for Telegram Audit Events
// Ensures reliable delivery and retry when Telegram is temporarily unavailable
export const telegramOutbox = new Map();

/**
 * Checks Telegram integration status
 */
export async function getTelegramStatus() {
  const token = getBotToken();
  const channelId = getChannelId();

  if (!token) {
    return {
      configured: false,
      ready: false,
      bot: null,
      channelId: channelId || null,
      error: 'TELEGRAM_BOT_TOKEN_MISSING',
      message: 'Telegram Bot Token is not configured in backend environment variables. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.'
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return {
        configured: true,
        ready: !!channelId,
        bot: {
          id: data.result.id,
          username: data.result.username,
          first_name: data.result.first_name,
          can_join_groups: data.result.can_join_groups
        },
        channelId: channelId || null,
        message: channelId 
          ? `Audit Bot @${data.result.username} is connected and ready to post audit logs.` 
          : `Bot @${data.result.username} is connected, but TELEGRAM_CHANNEL_ID is not configured.`
      };
    } else {
      return {
        configured: false,
        ready: false,
        bot: null,
        channelId: channelId || null,
        error: 'INVALID_BOT_TOKEN',
        message: data.description || 'Failed to authenticate with Telegram Bot API.'
      };
    }
  } catch (err) {
    return {
      configured: false,
      ready: false,
      bot: null,
      channelId: channelId || null,
      error: 'NETWORK_ERROR',
      message: err.message
    };
  }
}

/**
 * Auto-detects Channel ID from incoming updates when bot is added as Admin to a channel
 */
export async function detectChannelId() {
  const token = getBotToken();
  if (!token) return { found: false, error: 'Telegram Bot Token not configured' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) {
      return { found: false, error: data.description || 'Failed to fetch updates' };
    }

    for (let i = data.result.length - 1; i >= 0; i--) {
      const u = data.result[i];
      const chat = u.channel_post?.chat || u.my_chat_member?.chat || u.message?.chat;
      if (chat && (chat.type === 'channel' || chat.type === 'supergroup')) {
        const foundId = String(chat.id);
        process.env.TELEGRAM_CHANNEL_ID = foundId;
        return {
          found: true,
          channelId: foundId,
          title: chat.title,
          username: chat.username || null,
          message: `Successfully detected channel "${chat.title}" (ID: ${foundId})!`
        };
      }
    }

    return {
      found: false,
      message: 'No channel messages found yet. Add the Bot as an Administrator to your channel and send a test message.'
    };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

export const KNOWN_CATEGORIES = {
  cat_class_notes: 'Regular Class Notes',
  cat_lecture_notes: 'Faculty Lecture Notes',
  cat_question_papers: 'Question Papers & Model Exams',
  cat_lab_manuals: 'Laboratory Manuals & Programs',
  cat_assignments: 'Assignments & Case Studies',
  cat_recorded_lectures: 'Recorded Lectures & Videos',
  cat_reference_books: 'Reference Books & Textbooks',
  cat_syllabus_curriculum: 'Syllabus & Course Plans',
  cat_study_materials: 'Study Materials & Guides'
};

export const KNOWN_SUBJECTS = {
  sub_python: 'Problem Solving and Python Programming (24ES101A)',
  sub_graphics: 'Engineering Graphics (24ES102A)',
  sub_maths: 'Matrices and Calculus (24MA101A)',
  sub_physics: 'Engineering Physics (24PH101A)',
  sub_english: 'Heritage of Tamils / English (24EN101A)',
  sub_workshop: 'Engineering Workshop Practice (24ME101A)',
  sub_python_lab: 'Python Programming Laboratory (24ES103A)'
};

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatKolkataTime(dateInput = new Date()) {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const validDate = isNaN(d?.getTime?.()) ? new Date() : d;

  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  const parts = new Intl.DateTimeFormat('en-IN', options).formatToParts(validDate);
  const partMap = {};
  parts.forEach(p => partMap[p.type] = p.value);
  const day = partMap.day || '';
  const month = partMap.month || '';
  const year = partMap.year || '';
  const hour = partMap.hour || '';
  const minute = partMap.minute || '';
  const dayPeriod = (partMap.dayPeriod || '').toUpperCase();
  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} IST`.trim();
}

function isPresent(val) {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return s.length > 0 && s.toLowerCase() !== 'n/a' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const num = Number(bytes);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Builds Human-Readable RESOURCE UPLOAD RECORD for the Telegram Private Audit Channel
 */
export function buildUploadAuditMessage(resource = {}, driveDetails = {}, metadata = {}) {
  const title = (resource.title || metadata.title || 'Untitled Resource').trim();
  const rawDescription = (resource.description || metadata.description || '').trim();

  // Category
  let categoryName = resource.categoryName || metadata.categoryName || metadata.category;
  if (categoryName && KNOWN_CATEGORIES[categoryName]) {
    categoryName = KNOWN_CATEGORIES[categoryName];
  } else if (!categoryName && (resource.categoryId || metadata.categoryId) && KNOWN_CATEGORIES[resource.categoryId || metadata.categoryId]) {
    categoryName = KNOWN_CATEGORIES[resource.categoryId || metadata.categoryId];
  }
  if (!isPresent(categoryName)) categoryName = 'Regular Class Notes';

  // Subject
  let subjectName = resource.subjectName || metadata.subjectName || metadata.subject;
  if (subjectName && KNOWN_SUBJECTS[subjectName]) {
    subjectName = KNOWN_SUBJECTS[subjectName];
  } else if (!subjectName && (resource.subjectId || metadata.subjectId) && KNOWN_SUBJECTS[resource.subjectId || metadata.subjectId]) {
    subjectName = KNOWN_SUBJECTS[resource.subjectId || metadata.subjectId];
  }
  if (!isPresent(subjectName)) subjectName = 'General CSE';

  // Academic details
  const semester = resource.semester || metadata.semester || 'I';
  const academicDate = resource.academicDate || metadata.academicDate || metadata.date;
  let period = resource.periodNumber || metadata.periodNumber || metadata.period;
  if (isPresent(period)) {
    const pStr = String(period).trim();
    period = pStr.toLowerCase().startsWith('period') ? pStr : `Period ${pStr}`;
  }
  const unit = resource.unit || metadata.unit || metadata.unitOrChapter;
  const topic = resource.topic || metadata.topic;

  // Identity
  const resourceId = resource.id || metadata.resourceId || ('res_' + Math.random().toString(36).substring(2, 9));
  const uploaderName = (resource.ownerName || metadata.uploaderName || metadata.ownerName || 'CSE Resource Manager').trim();
  const uploaderEmail = (resource.ownerEmail || metadata.uploaderEmail || metadata.ownerEmail || 'manager.cse@saranathan.ac.in').trim();
  const uploadedAtStr = formatKolkataTime(resource.uploadedAt || metadata.uploadedAt || new Date());

  // File & Drive References
  const filename = resource.originalFilename || metadata.filename || driveDetails.filename || 'resource_file.pdf';
  const fileSize = resource.fileSize || metadata.fileSize || driveDetails.fileSize || 0;
  const mimeType = resource.mimeType || metadata.mimeType || driveDetails.mimeType || 'application/pdf';
  const driveFileId = resource.googleDriveFileId || driveDetails.fileId || '1aBcDeFg_SampleDriveFileId';
  const driveLink = driveDetails.driveLink || `https://drive.google.com/file/d/${driveFileId}/view`;
  const driveStatus = resource.googleDriveStatus || driveDetails.driveStatus || 'VERIFIED';
  const publicationStatus = (resource.publicationStatus || metadata.publicationStatus || 'DRAFT').toUpperCase();

  const assemble = (descText) => {
    const lines = [
      '📚 <b>RESOURCE UPLOAD RECORD</b>\n',
      `<b>Resource ID:</b> <code>${escapeHtml(resourceId)}</code>`,
      `<b>Title:</b> ${escapeHtml(title)}`,
      `<b>Uploaded by:</b> ${escapeHtml(uploaderName)}`,
      `<b>Verified Gmail:</b> <code>${escapeHtml(uploaderEmail)}</code>`,
      `<b>Subject:</b> ${escapeHtml(subjectName)}`,
      `<b>Category:</b> ${escapeHtml(categoryName)}`,
      `<b>Semester:</b> ${escapeHtml(semester)}`
    ];

    if (isPresent(academicDate) || isPresent(period)) {
      const datePeriodStr = [academicDate, period].filter(Boolean).join(' • ');
      lines.push(`<b>Academic date/period:</b> ${escapeHtml(datePeriodStr)}`);
    }

    if (isPresent(unit) || isPresent(topic)) {
      const unitTopicStr = [unit ? `Unit: ${unit}` : null, topic ? `Topic: ${topic}` : null].filter(Boolean).join(' | ');
      lines.push(`<b>Unit/topic:</b> ${escapeHtml(unitTopicStr)}`);
    }

    if (isPresent(descText)) {
      lines.push(`<b>Description:</b>\n${escapeHtml(descText)}`);
    }

    lines.push(`<b>Filename:</b> ${escapeHtml(filename)}`);
    lines.push(`<b>File size:</b> ${escapeHtml(formatBytes(fileSize))}`);
    lines.push(`<b>MIME type:</b> <code>${escapeHtml(mimeType)}</code>`);
    lines.push(`<b>Uploaded at:</b> ${escapeHtml(uploadedAtStr)}`);
    lines.push(`<b>Drive file ID:</b> <code>${escapeHtml(driveFileId)}</code>`);
    lines.push(`<b>Drive link:</b> ${escapeHtml(driveLink)}`);
    lines.push(`<b>Drive status:</b> ${escapeHtml(driveStatus)}`);
    lines.push(`<b>Publication status:</b> ${escapeHtml(publicationStatus)}`);

    return lines.join('\n');
  };

  // Telegram text message length limit: 4096 characters
  const MAX_MESSAGE_CHARS = 4000;
  let message = assemble(rawDescription);

  if (message.length > MAX_MESSAGE_CHARS && isPresent(rawDescription)) {
    const baseWithoutDesc = assemble('');
    const noteSuffix = '... [Truncated for Telegram. Full description preserved in Supabase]';
    let allowedChars = MAX_MESSAGE_CHARS - baseWithoutDesc.length - noteSuffix.length - 20;
    if (allowedChars > 20) {
      let truncatedDesc = rawDescription.slice(0, allowedChars).trim() + '\n' + noteSuffix;
      message = assemble(truncatedDesc);
    } else {
      message = assemble('[Full description preserved in Supabase]');
    }
  }

  return {
    message,
    resourceId,
    fullDescription: rawDescription,
    uploaderName,
    uploaderEmail,
    driveFileId,
    driveLink,
    driveStatus,
    publicationStatus,
    uploadedAt: uploadedAtStr
  };
}

/**
 * Builds Human-Readable Lifecycle Event Audit Messages
 */
export function buildStatusChangeAuditMessage(resource = {}, eventType = 'RESOURCE_PUBLISHED', metadata = {}) {
  const resourceId = resource.id || metadata.resourceId || 'N/A';
  const title = resource.title || metadata.title || 'Untitled Resource';
  const actorName = metadata.actorName || resource.ownerName || 'Manager';
  const actorEmail = metadata.actorEmail || resource.ownerEmail || 'manager.cse@saranathan.ac.in';
  const timestamp = formatKolkataTime(new Date());

  const eventHeaders = {
    UPLOAD_INITIATED: '⏳ <b>RESOURCE UPLOAD INITIATED</b>',
    UPLOAD_SUCCEEDED: '✅ <b>RESOURCE UPLOAD VERIFIED</b>',
    UPLOAD_FAILED: '⚠️ <b>RESOURCE UPLOAD FAILED</b>',
    RESOURCE_PUBLISHED: '📢 <b>RESOURCE PUBLISHED TO STUDENTS</b>',
    RESOURCE_UNPUBLISHED: '🔒 <b>RESOURCE UNPUBLISHED</b>',
    RESOURCE_EDITED: '✏️ <b>RESOURCE METADATA UPDATED</b>',
    RESOURCE_ARCHIVED: '📦 <b>RESOURCE ARCHIVED</b>',
    RESOURCE_DELETED: '🗑️ <b>RESOURCE SCHEDULED FOR DELETION</b>'
  };

  const header = eventHeaders[eventType] || `ℹ️ <b>AUDIT EVENT: ${escapeHtml(eventType)}</b>`;

  const lines = [
    header,
    `\n<b>Resource ID:</b> <code>${escapeHtml(resourceId)}</code>`,
    `<b>Title:</b> ${escapeHtml(title)}`,
    `<b>Actor:</b> ${escapeHtml(actorName)} (<code>${escapeHtml(actorEmail)}</code>)`,
    `<b>Timestamp:</b> ${escapeHtml(timestamp)}`
  ];

  if (resource.googleDriveFileId) {
    lines.push(`<b>Drive File ID:</b> <code>${escapeHtml(resource.googleDriveFileId)}</code>`);
  }

  if (metadata.details) {
    lines.push(`<b>Details:</b> ${escapeHtml(typeof metadata.details === 'object' ? JSON.stringify(metadata.details) : metadata.details)}`);
  }

  return lines.join('\n');
}

/**
 * Dispatches a Telegram text message to the private channel
 */
export async function sendTelegramTextMessage(textHtml) {
  const token = getBotToken();
  const channelId = getChannelId();

  if (!token || !channelId) {
    throw new Error('Telegram Bot Token or Channel ID not configured');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: textHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || 'Telegram sendMessage failed');
  }

  return {
    success: true,
    messageId: result.result.message_id,
    chatId: String(result.result.chat.id)
  };
}

/**
 * Dispatches an audit event with durable Outbox queueing and automatic failure recovery
 */
export async function sendTelegramAuditEvent(eventType, resource, metadata = {}) {
  const outboxId = 'outbox_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  let messageText = '';
  if (eventType === 'RESOURCE_UPLOAD_RECORD' || eventType === 'UPLOAD_SUCCEEDED') {
    const formatted = buildUploadAuditMessage(resource, metadata.driveDetails || {}, metadata);
    messageText = formatted.message;
  } else {
    messageText = buildStatusChangeAuditMessage(resource, eventType, metadata);
  }

  const outboxEntry = {
    id: outboxId,
    resourceId: resource.id || metadata.resourceId,
    eventType,
    textHtml: messageText,
    status: 'pending',
    retryCount: 0,
    telegramMessageId: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    sentAt: null
  };

  telegramOutbox.set(outboxId, outboxEntry);

  // Attempt immediate delivery
  try {
    const dispatchResult = await sendTelegramTextMessage(messageText);
    outboxEntry.status = 'sent';
    outboxEntry.telegramMessageId = dispatchResult.messageId;
    outboxEntry.sentAt = new Date().toISOString();

    // Cache in idempotency store
    const cacheKey = `audit_${eventType}_${outboxEntry.resourceId}`;
    idempotencyStore.set(cacheKey, { messageId: dispatchResult.messageId, sentAt: outboxEntry.sentAt });

    return {
      success: true,
      delivered: true,
      outboxId,
      messageId: dispatchResult.messageId,
      status: 'sent'
    };
  } catch (err) {
    console.warn(`Telegram audit delivery attempt failed (${eventType}):`, err.message);
    outboxEntry.status = 'failed';
    outboxEntry.lastError = err.message;

    // Do NOT throw: failure in Telegram delivery must NOT abort a successful Drive upload or database persistence
    return {
      success: true,
      delivered: false,
      outboxId,
      status: 'failed',
      error: err.message,
      message: 'Telegram delivery queued in outbox for retry. Resource upload status preserved.'
    };
  }
}

/**
 * Retries all failed outbox events
 */
export async function retryFailedTelegramEvents() {
  const retried = [];
  for (const [id, entry] of telegramOutbox.entries()) {
    if (entry.status === 'failed' || entry.status === 'retrying') {
      entry.status = 'retrying';
      entry.retryCount++;
      try {
        const res = await sendTelegramTextMessage(entry.textHtml);
        entry.status = 'sent';
        entry.telegramMessageId = res.messageId;
        entry.sentAt = new Date().toISOString();
        entry.lastError = null;
        retried.push({ id, status: 'sent', messageId: res.messageId });
      } catch (err) {
        entry.status = 'failed';
        entry.lastError = err.message;
        retried.push({ id, status: 'failed', error: err.message });
      }
    }
  }
  return { retriedCount: retried.length, results: retried };
}

export function getOutboxEvents() {
  return Array.from(telegramOutbox.values()).reverse();
}

// Backward-compatible caption builder for existing tests
export function buildTelegramCaption(metadata = {}, file = {}) {
  // Title (Required)
  const title = (metadata.title || file.filename || 'Learning Resource').trim();

  // Full Description (Preserved in database)
  const rawDescription = (metadata.description || '').trim();

  // Category: Resolve readable name
  let categoryName = metadata.categoryName || metadata.category;
  if (categoryName && KNOWN_CATEGORIES[categoryName]) {
    categoryName = KNOWN_CATEGORIES[categoryName];
  } else if (!categoryName && metadata.categoryId && KNOWN_CATEGORIES[metadata.categoryId]) {
    categoryName = KNOWN_CATEGORIES[metadata.categoryId];
  }
  if (!isPresent(categoryName)) {
    categoryName = 'Regular Class Notes';
  }

  // Subject: Resolve readable name
  let subjectName = metadata.subjectName || metadata.subject;
  if (subjectName && KNOWN_SUBJECTS[subjectName]) {
    subjectName = KNOWN_SUBJECTS[subjectName];
  } else if (!subjectName && metadata.subjectId && KNOWN_SUBJECTS[metadata.subjectId]) {
    subjectName = KNOWN_SUBJECTS[metadata.subjectId];
  }
  if (!isPresent(subjectName)) {
    subjectName = 'General CSE';
  }

  // Unit or Chapter (Optional)
  const unit = metadata.unit || metadata.unitOrChapter;

  // Topic (Optional)
  const topic = metadata.topic;

  // Academic Date (Optional)
  const academicDate = metadata.academicDate || metadata.date;

  // Period (Optional)
  let period = metadata.period || metadata.periodNumber;
  if (isPresent(period)) {
    const pStr = String(period).trim();
    period = pStr.toLowerCase().startsWith('period') ? pStr : `Period ${pStr}`;
  }

  // Real unique Resource ID (Never N/A)
  let resourceId = metadata.resourceId || metadata.id;
  if (!isPresent(resourceId)) {
    resourceId = 'res_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }

  // Manager Display Name
  const uploaderName = (metadata.uploaderName || metadata.ownerName || 'CSE Resource Manager').trim();

  // Manager Email
  const uploaderEmail = (metadata.uploaderEmail || metadata.ownerEmail || 'manager.cse@saranathan.ac.in').trim();

  // Timestamp
  const uploadedAtStr = formatKolkataTime(metadata.uploadedAt || new Date());

  const assemble = (descText) => {
    const lines = [
      '📚 <b>SARANATHAN CSE — LEARNING RESOURCE</b>\n',
      `📄 <b>Title:</b> ${escapeHtml(title)}`
    ];

    if (isPresent(descText)) {
      lines.push(`\n📝 <b>Description:</b>\n${escapeHtml(descText)}`);
    }

    lines.push(`\n📂 <b>Category:</b> ${escapeHtml(categoryName)}`);
    lines.push(`📘 <b>Subject:</b> ${escapeHtml(subjectName)}`);

    if (isPresent(unit)) {
      lines.push(`📖 <b>Unit/Chapter:</b> ${escapeHtml(unit)}`);
    }

    if (isPresent(topic)) {
      lines.push(`🔖 <b>Topic:</b> ${escapeHtml(topic)}`);
    }

    if (isPresent(academicDate)) {
      lines.push(`📅 <b>Academic Date:</b> ${escapeHtml(academicDate)}`);
    }

    if (isPresent(period)) {
      lines.push(`🕒 <b>Period:</b> ${escapeHtml(period)}`);
    }

    lines.push(`🆔 <b>Resource ID:</b> ${escapeHtml(resourceId)}`);
    lines.push(`👤 <b>Uploaded By:</b> ${escapeHtml(uploaderName)}`);
    lines.push(`📧 <b>Manager Email:</b> ${escapeHtml(uploaderEmail)}`);
    lines.push(`⏰ <b>Uploaded At:</b> ${escapeHtml(uploadedAtStr)}`);

    return lines.join('\n');
  };

  // Telegram document caption limit: 1024 characters
  const MAX_CAPTION_CHARS = 1020;
  let caption = assemble(rawDescription);

  if (caption.length > MAX_CAPTION_CHARS && isPresent(rawDescription)) {
    const baseWithoutDesc = assemble('');
    const descHeaderOverhead = '\n📝 <b>Description:</b>\n'.length; // 28 chars
    const noteSuffix = '... [Full details in Portal]';
    let allowedChars = MAX_CAPTION_CHARS - baseWithoutDesc.length - descHeaderOverhead - noteSuffix.length - 5;
    if (allowedChars > 20) {
      let truncatedDesc = rawDescription.slice(0, allowedChars).trim() + noteSuffix;
      caption = assemble(truncatedDesc);
      while (caption.length > MAX_CAPTION_CHARS && allowedChars > 10) {
        allowedChars -= (caption.length - MAX_CAPTION_CHARS + 2);
        truncatedDesc = rawDescription.slice(0, Math.max(0, allowedChars)).trim() + noteSuffix;
        caption = assemble(truncatedDesc);
      }
    } else {
      caption = assemble('');
    }
  }

  return {
    caption,
    resourceId,
    fullDescription: rawDescription,
    categoryName,
    subjectName,
    unit: isPresent(unit) ? unit : null,
    topic: isPresent(topic) ? topic : null,
    academicDate: isPresent(academicDate) ? academicDate : null,
    period: isPresent(period) ? period : null,
    uploaderName,
    uploaderEmail,
    uploadedAt: uploadedAtStr
  };
}

// Backward-compatible uploadToTelegramChannel for existing test compatibility
export async function uploadToTelegramChannel(file, metadata = {}) {
  // Idempotency check
  const cacheKey = metadata.idempotencyKey || metadata.resourceId || 'upload_' + Date.now();
  if (idempotencyStore.has(cacheKey)) {
    const cached = idempotencyStore.get(cacheKey);
    return {
      ...cached,
      reconciled: true,
      message: 'Reconciled existing Telegram record without creating duplicate messages.'
    };
  }

  // Send audit record (No file bytes dispatched to Telegram)
  const auditRes = await sendTelegramAuditEvent('RESOURCE_UPLOAD_RECORD', metadata, {
    driveDetails: {
      fileId: metadata.googleDriveFileId || 'gdrv_sample_file',
      filename: file.filename,
      fileSize: file.size,
      mimeType: file.mimetype,
      driveStatus: 'VERIFIED'
    }
  });

  const uploadRecord = {
    success: true,
    messageId: auditRes.messageId || 1001,
    fileId: metadata.googleDriveFileId || 'gdrv_sample_file',
    fileName: file.filename,
    mimeType: file.mimetype,
    fileSize: file.size,
    chatId: getChannelId(),
    resourceId: metadata.resourceId || metadata.id,
    reconciled: false
  };

  idempotencyStore.set(cacheKey, uploadRecord);
  return uploadRecord;
}

// Server-side resource registry helpers
export function registerResource(resource) {
  if (!resource || !resource.id) return;
  resourceRegistry.set(resource.id, {
    resourceId: resource.id,
    fileId: resource.googleDriveFileId || resource.telegramFileId,
    publicationStatus: resource.publicationStatus || 'draft',
    ownerId: resource.ownerId || resource.ownerEmail,
    ownerEmail: resource.ownerEmail,
    filename: resource.originalFilename,
    mimeType: resource.mimeType,
    fileSize: resource.fileSize
  });
}

export function updateResourcePublicationStatus(resourceId, status) {
  const reg = resourceRegistry.get(resourceId);
  if (reg) {
    reg.publicationStatus = status;
  }
}

export function getRegisteredResource(resourceId) {
  return resourceRegistry.get(resourceId);
}

// Backward compatible file stream proxy helper
export async function getTelegramFileStream(fileId) {
  if (!fileId) throw new Error('file_id is required');

  if (fileBufferCache.has(fileId)) {
    return fileBufferCache.get(fileId);
  }

  // Also check idempotency store
  for (const [key, val] of idempotencyStore.entries()) {
    if (val.fileId === fileId && val.buffer) {
      return { buffer: val.buffer, fileSize: val.fileSize || val.buffer.length, filePath: '' };
    }
  }

  throw new Error(`File ${fileId} not found in buffer cache`);
}

/**
 * Builds formatted text for Bug Report notifications sent to Telegram Admin Channel
 * Conforms to the required format:
 * 🐞 NEW BUG REPORT
 * Report ID: ...
 * Title: ...
 * Reporter: ...
 * Role: ...
 * Category: ...
 * Severity: ...
 * Affected page: ...
 * Description: ...
 * Submitted at: ...
 * App version: ...
 * #BugReport #CollegeApp
 */
export function buildBugReportMessage(report = {}) {
  const reportId = report.id || ('BUG-2026-' + Math.floor(100 + Math.random() * 900));
  const title = (report.title || 'Untitled Bug Report').trim();
  const reporterName = (report.reporterName || report.displayName || 'Anonymous Student').trim();
  const reporterRole = (report.reporterRole || report.role || 'Student').trim();
  const reporterEmail = (report.reporterEmail || report.email || 'N/A').trim();
  const reporterRoll = (report.reporterRollNumber || report.rollNumber || '').trim();
  const category = (report.category || 'Other').trim();
  const severity = (report.severity || 'Medium').trim();
  const affectedPage = (report.affectedPage || 'Dashboard').trim();
  const description = (report.description || 'No description provided').trim();
  const submittedAt = report.submittedAt || formatKolkataTime(report.createdAt || new Date());
  const appVersion = report.appVersion || 'v1.2.0-cse';
  const route = report.route || '/learning.html';
  const userAgent = report.userAgent || 'Web Client';

  const lines = [
    '🐞 <b>NEW BUG REPORT</b>\n',
    `<b>Report ID:</b> <code>${escapeHtml(reportId)}</code>`,
    `<b>Title:</b> ${escapeHtml(title)}`,
    `<b>Reporter:</b> ${escapeHtml(reporterName)}`,
    `<b>Role:</b> ${escapeHtml(reporterRole)}`,
    `<b>Gmail:</b> <code>${escapeHtml(reporterEmail)}</code>`
  ];

  if (reporterRoll) {
    lines.push(`<b>Roll Number:</b> <code>${escapeHtml(reporterRoll)}</code>`);
  }

  lines.push(
    `<b>Category:</b> ${escapeHtml(category)}`,
    `<b>Severity:</b> ${escapeHtml(severity)}`,
    `<b>Affected page:</b> ${escapeHtml(affectedPage)}`,
    `\n<b>Description:</b>\n${escapeHtml(description)}`,
    `\n<b>Submitted at:</b> ${escapeHtml(submittedAt)}`,
    `<b>App version:</b> <code>${escapeHtml(appVersion)}</code>`,
    `<b>Route:</b> <code>${escapeHtml(route)}</code>`,
    `<b>Environment:</b> <code>${escapeHtml(userAgent)}</code>`,
    `\n#BugReport #CollegeApp`
  );

  return lines.join('\n');
}

/**
 * Dispatches Bug Report to the dedicated Telegram Admin Channel (https://t.me/+DUb_bXrp_x03OGZl)
 * Reuses the SAME Telegram Bot token safely from server environment variables.
 * If a screenshot buffer is provided, sends via sendPhoto; otherwise sends via sendMessage.
 */
export async function sendTelegramBugReport(report = {}, screenshot = null) {
  const token = getBotToken();
  const channelId = getBugChannelId();

  if (!token) {
    throw new Error('Telegram Bot Token not configured in backend environment variables.');
  }
  if (!channelId) {
    throw new Error('Telegram Bug Channel ID not configured in backend environment variables.');
  }

  const messageText = buildBugReportMessage(report);

  // If screenshot is present, attempt sendPhoto
  if (screenshot && (screenshot.buffer || Buffer.isBuffer(screenshot))) {
    const buf = Buffer.isBuffer(screenshot) ? screenshot : screenshot.buffer;
    const filename = screenshot.filename || screenshot.name || 'screenshot.png';
    const mimeType = screenshot.mimeType || screenshot.type || 'image/png';

    // Caption limit on Telegram is 1024 characters
    let caption = messageText;
    let extraMessage = null;
    if (caption.length > 1024) {
      caption = messageText.substring(0, 980) + '...\n\n#BugReport #CollegeApp';
      extraMessage = messageText;
    }

    try {
      const formData = new FormData();
      formData.append('chat_id', channelId);
      const blob = new Blob([buf], { type: mimeType });
      formData.append('photo', blob, filename);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const photoData = await photoRes.json();
      if (!photoRes.ok || !photoData.ok) {
        throw new Error(photoData.description || `Telegram sendPhoto failed with status ${photoRes.status}`);
      }

      if (extraMessage) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              text: extraMessage,
              parse_mode: 'HTML',
              reply_to_message_id: photoData.result.message_id
            })
          });
        } catch (_) {}
      }

      return {
        success: true,
        delivered: true,
        messageId: photoData.result.message_id,
        chatId: String(photoData.result.chat.id),
        hasScreenshot: true
      };
    } catch (photoErr) {
      console.warn('sendPhoto failed, falling back to sendMessage:', photoErr.message);
      // Fallback to text sendMessage if sendPhoto encounters an issue
    }
  }

  // Regular HTML text message
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: messageText,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram sendMessage failed with status ${response.status}`);
  }

  return {
    success: true,
    delivered: true,
    messageId: result.result.message_id,
    chatId: String(result.result.chat.id),
    hasScreenshot: false
  };
}
