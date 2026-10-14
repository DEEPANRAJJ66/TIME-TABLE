// In-App Resource Viewer Modal Component
// Supports PDF preview (native iframe / Google Docs viewer), image lightbox, video playback, and Drive link embed fallbacks.

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatKolkataTime(dateInput = new Date()) {
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

export class ViewerModal {
  constructor() {
    this.modalEl = null;
    this.initModalDom();
  }

  initModalDom() {
    if (document.getElementById('lrViewerModal')) {
      this.modalEl = document.getElementById('lrViewerModal');
      return;
    }

    const modalHtml = `
      <div id="lrViewerModal" class="lr-modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="lrViewerTitle">
        <div class="lr-modal-box lr-viewer-box">
          <header class="lr-viewer-header">
            <div class="lr-viewer-meta">
              <span id="lrViewerBadge" class="lr-badge">PDF</span>
              <div>
                <h3 id="lrViewerTitle" class="lr-viewer-title">Resource Title</h3>
                <div id="lrViewerSub" class="lr-viewer-sub">Subject • Date • Period</div>
              </div>
            </div>
            <div class="lr-viewer-actions">
              <a id="lrViewerDownloadBtn" href="#" target="_blank" download class="lr-btn lr-btn-sm lr-btn-outline" title="Download Resource">
                <span>⬇️</span> Download
              </a>
              <a id="lrViewerExternalBtn" href="#" target="_blank" class="lr-btn lr-btn-sm lr-btn-outline" title="Open in New Tab">
                <span>↗️</span> External
              </a>
              <button id="lrViewerDetailsToggleBtn" class="lr-btn lr-btn-sm lr-btn-outline" title="Toggle Full Metadata Details">
                <span>📋</span> Details
              </button>
              <button id="lrViewerCloseBtn" class="lr-btn-close" aria-label="Close Preview">✕</button>
            </div>
          </header>

          <div id="lrViewerDetailsPanel" class="lr-viewer-details-panel">
            <!-- Full Metadata Rendered dynamically -->
          </div>

          <div class="lr-viewer-body" id="lrViewerBody">
            <!-- Content injected dynamically -->
            <div class="lr-viewer-loader" id="lrViewerLoader">
              <div class="lr-spinner"></div>
              <p>Loading resource preview...</p>
            </div>
          </div>

          <footer class="lr-viewer-footer">
            <div id="lrViewerFooterInfo" class="lr-viewer-footer-info">
              <span>Classroom: RV 402</span> • 
              <span id="lrViewerFilename">document.pdf</span> • 
              <span id="lrViewerFilesize">2.4 MB</span> •
              <span id="lrViewerId">ID: res_123</span>
            </div>
          </footer>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modalEl = document.getElementById('lrViewerModal');

    // Event listeners
    document.getElementById('lrViewerCloseBtn')?.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const toggleBtn = document.getElementById('lrViewerDetailsToggleBtn');
    if (toggleBtn && !toggleBtn._bound) {
      toggleBtn._bound = true;
      toggleBtn.addEventListener('click', () => {
        const panel = document.getElementById('lrViewerDetailsPanel');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl.style.display !== 'none') {
        this.close();
      }
    });
  }

  /**
   * Opens and renders a resource inside the modal
   */
  open(resource) {
    if (!resource) return;

    this.initModalDom();

    const titleEl = document.getElementById('lrViewerTitle');
    const badgeEl = document.getElementById('lrViewerBadge');
    const subEl = document.getElementById('lrViewerSub');
    const bodyEl = document.getElementById('lrViewerBody');
    const downloadBtn = document.getElementById('lrViewerDownloadBtn');
    const externalBtn = document.getElementById('lrViewerExternalBtn');
    const filenameEl = document.getElementById('lrViewerFilename');
    const filesizeEl = document.getElementById('lrViewerFilesize');
    const idEl = document.getElementById('lrViewerId');
    const detailsPanel = document.getElementById('lrViewerDetailsPanel');

    titleEl.textContent = resource.title;
    badgeEl.textContent = (resource.resourceType === 'drive_link' ? 'Google Drive' : (resource.mimeType?.split('/')[1]?.toUpperCase() || 'File'));
    
    const subDetails = [
      resource.subjectName || resource.subjectId || 'All Subjects',
      resource.academicDate ? `Date: ${resource.academicDate}` : null,
      resource.periodNumber ? `Period ${resource.periodNumber}` : null,
      resource.unit ? `Unit: ${resource.unit}` : (resource.unitOrTopic ? resource.unitOrTopic : null)
    ].filter(Boolean).join(' • ');

    subEl.textContent = subDetails;
    filenameEl.textContent = resource.originalFilename || (resource.resourceType === 'drive_link' ? 'Drive Link' : 'Document');
    filesizeEl.textContent = resource.fileSize ? `${(resource.fileSize / (1024 * 1024)).toFixed(2)} MB` : '';
    if (idEl) idEl.textContent = `Resource ID: ${resource.id || 'N/A'}`;

    // Render comprehensive details panel
    if (detailsPanel) {
      const categoryLabel = resource.categoryName || resource.categoryId || 'Regular Class Notes';
      const subjectLabel = resource.subjectName || resource.subjectId || 'General CSE';
      const uploaderName = resource.ownerName || 'CSE Resource Manager';
      const uploaderEmail = resource.ownerEmail || 'manager.cse@saranathan.ac.in';
      const formattedTimestamp = formatKolkataTime(resource.uploadedAt || resource.createdAt || new Date());

      detailsPanel.innerHTML = `
        <div class="lr-details-grid">
          <div class="lr-details-item">
            <span class="lr-details-label">📂 Category:</span>
            <span class="lr-details-val">${escapeHtml(categoryLabel)}</span>
          </div>
          <div class="lr-details-item">
            <span class="lr-details-label">📘 Subject:</span>
            <span class="lr-details-val">${escapeHtml(subjectLabel)}</span>
          </div>
          ${resource.unit ? `
            <div class="lr-details-item">
              <span class="lr-details-label">📖 Unit/Chapter:</span>
              <span class="lr-details-val">${escapeHtml(resource.unit)}</span>
            </div>
          ` : ''}
          ${resource.topic ? `
            <div class="lr-details-item">
              <span class="lr-details-label">🔖 Topic:</span>
              <span class="lr-details-val">${escapeHtml(resource.topic)}</span>
            </div>
          ` : ''}
          ${resource.academicDate ? `
            <div class="lr-details-item">
              <span class="lr-details-label">📅 Academic Date:</span>
              <span class="lr-details-val">${escapeHtml(resource.academicDate)}</span>
            </div>
          ` : ''}
          ${resource.periodNumber ? `
            <div class="lr-details-item">
              <span class="lr-details-label">🕒 Period:</span>
              <span class="lr-details-val">Period ${escapeHtml(resource.periodNumber)}</span>
            </div>
          ` : ''}
          <div class="lr-details-item">
            <span class="lr-details-label">🆔 Resource ID:</span>
            <span class="lr-details-val"><code>${escapeHtml(resource.id || '')}</code></span>
          </div>
          ${resource.googleDriveFileId ? `
            <div class="lr-details-item">
              <span class="lr-details-label">💾 Google Drive File:</span>
              <span class="lr-details-val"><span class="lr-badge lr-badge-student">VERIFIED</span> <code>${escapeHtml(resource.googleDriveFileId)}</code></span>
            </div>
          ` : ''}
          ${resource.telegramAuditStatus ? `
            <div class="lr-details-item">
              <span class="lr-details-label">📢 Telegram Audit:</span>
              <span class="lr-details-val"><span class="lr-badge lr-badge-outline">${escapeHtml(resource.telegramAuditStatus.toUpperCase())}</span></span>
            </div>
          ` : ''}
          <div class="lr-details-item">
            <span class="lr-details-label">👤 Uploaded By:</span>
            <span class="lr-details-val">${escapeHtml(uploaderName)}</span>
          </div>
          <div class="lr-details-item">
            <span class="lr-details-label">📧 Manager Email:</span>
            <span class="lr-details-val">${escapeHtml(uploaderEmail)}</span>
          </div>
          <div class="lr-details-item">
            <span class="lr-details-label">⏰ Uploaded At:</span>
            <span class="lr-details-val">${escapeHtml(formattedTimestamp)}</span>
          </div>
        </div>
        ${resource.description ? `
          <div class="lr-details-desc-box">
            <span class="lr-details-label">📝 Description:</span>
            <div class="lr-details-desc-content">${escapeHtml(resource.description)}</div>
          </div>
        ` : ''}
      `;
    }

    // Clear previous view
    bodyEl.innerHTML = `
      <div class="lr-viewer-loader" id="lrViewerLoader">
        <div class="lr-spinner"></div>
        <p>Loading preview...</p>
      </div>
    `;

    // Determine content URL
    let targetUrl = '';
    if (resource.resourceType === 'drive_link') {
      targetUrl = resource.googleDriveUrl;
      downloadBtn.style.display = 'none';
      externalBtn.href = targetUrl;
      externalBtn.style.display = 'inline-flex';

      // Transform Google Drive URL to embed preview
      let embedUrl = targetUrl;
      if (targetUrl.includes('drive.google.com/file/d/')) {
        const idMatch = targetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          embedUrl = `https://drive.google.com/file/d/${idMatch[1]}/preview`;
        }
      }

      bodyEl.innerHTML = `
        <div class="lr-embed-container">
          <iframe src="${embedUrl}" class="lr-viewer-iframe" allow="autoplay" allowfullscreen></iframe>
          <div class="lr-embed-hint">
            If preview does not load due to Google Drive permissions, 
            <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="lr-link">Click here to open directly in Google Drive</a>.
          </div>
        </div>
      `;
    } else {
      // Direct File or Google Drive stored file through secure backend proxy
      const apiBase = (typeof window !== 'undefined' && (window.APP_CONFIG?.API_BASE || (typeof localStorage !== 'undefined' && localStorage.getItem('API_BASE_URL')) || (window.location && window.location.hostname && window.location.hostname.endsWith('github.io') ? 'https://college-time-planner.vercel.app/api' : '/api'))) || '/api';
      const currentUser = (typeof window !== 'undefined' && window.learningApp?.auth?.getCurrentUser?.()) || { role: 'student' };
      const fileId = resource.googleDriveFileId || resource.telegramFileId;
      const fileUrl = resource.directUrl || (fileId ? `${apiBase}/drive/stream?file_id=${encodeURIComponent(fileId)}&resource_id=${encodeURIComponent(resource.id || '')}&filename=${encodeURIComponent(resource.originalFilename || 'doc')}&mime=${encodeURIComponent(resource.mimeType || 'application/octet-stream')}&publication_status=${encodeURIComponent(resource.publicationStatus || 'published')}&owner_id=${encodeURIComponent(resource.ownerId || '')}&role=${encodeURIComponent(currentUser.role || 'student')}&user_id=${encodeURIComponent(currentUser.id || '')}&user_email=${encodeURIComponent(currentUser.email || '')}` : null);

      if (fileUrl) {
        downloadBtn.href = fileUrl;
        downloadBtn.download = resource.originalFilename || 'resource';
        downloadBtn.style.display = 'inline-flex';
        externalBtn.href = fileUrl;
        externalBtn.style.display = 'inline-flex';
      } else {
        downloadBtn.style.display = 'none';
        externalBtn.style.display = 'none';
      }

      const mime = (resource.mimeType || '').toLowerCase();
      const ext = (resource.originalFilename || '').split('.').pop().toLowerCase();

      if (mime.includes('pdf') || ext === 'pdf') {
        // Render PDF in-app
        if (fileUrl) {
          bodyEl.innerHTML = `
            <div class="lr-pdf-wrapper">
              <iframe src="${fileUrl}#toolbar=1" class="lr-viewer-iframe" title="${escapeHtml(resource.title)}"></iframe>
            </div>
          `;
        } else {
          // In-app fallback for local seed items without live Telegram file ID
          bodyEl.innerHTML = `
            <div class="lr-viewer-fallback">
              <div class="lr-fallback-icon">📄</div>
              <h4>${escapeHtml(resource.title)}</h4>
              <p><strong>${escapeHtml(resource.originalFilename || 'Document')}</strong> (${(resource.fileSize ? (resource.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Curriculum File')})</p>
              <p class="lr-text-muted">Registered in Hall RV 402 classroom archives. Live files uploaded by Managers stream directly here in-app.</p>
            </div>
          `;
        }
      } else if (mime.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        // Image Lightbox in-app
        bodyEl.innerHTML = `
          <div class="lr-image-wrapper">
            <img src="${fileUrl || 'assets/cse.jpeg'}" alt="${escapeHtml(resource.title)}" class="lr-viewer-img" />
          </div>
        `;
      } else if (mime.includes('video') || ['mp4', 'mkv', 'webm', 'mov'].includes(ext)) {
        // Video Player in-app with Range streaming support
        bodyEl.innerHTML = `
          <div class="lr-video-wrapper">
            <video controls autoplay playsinline class="lr-viewer-video" src="${fileUrl}" preload="metadata">
              <source src="${fileUrl}" type="${escapeHtml(mime || 'video/mp4')}">
              Your browser does not support HTML5 video streaming.
            </video>
          </div>
        `;
      } else if (mime.includes('audio') || ['mp3', 'wav', 'ogg'].includes(ext)) {
        // Audio Player in-app
        bodyEl.innerHTML = `
          <div class="lr-audio-wrapper">
            <div class="lr-fallback-icon">🎧</div>
            <h4>${escapeHtml(resource.title)}</h4>
            <audio controls autoplay class="lr-viewer-audio" src="${fileUrl}" preload="metadata">
              <source src="${fileUrl}" type="${escapeHtml(mime || 'audio/mpeg')}">
              Your browser does not support HTML5 audio playback.
            </audio>
          </div>
        `;
      } else {
        // Generic / Unsupported Document In-App Fallback
        bodyEl.innerHTML = `
          <div class="lr-viewer-fallback">
            <div class="lr-fallback-icon">📁</div>
            <h4>${escapeHtml(resource.title)}</h4>
            <p><strong>${escapeHtml(resource.originalFilename || 'File')}</strong> ${resource.fileSize ? `(${(resource.fileSize / 1024 / 1024).toFixed(2)} MB)` : ''}</p>
            <p class="lr-text-muted">Direct in-app streaming is not available for this file type (.${escapeHtml(ext)}). You can download and open this resource on your device.</p>
            <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: center;">
              ${fileUrl ? `<a href="${fileUrl}" download="${escapeHtml(resource.originalFilename || 'resource')}" class="lr-btn lr-btn-primary"><span>⬇️</span> Download File to Device</a>` : ''}
            </div>
          </div>
        `;
      }
    }

    this.modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent underlying page scroll
  }

  close() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      const bodyEl = document.getElementById('lrViewerBody');
      if (bodyEl) bodyEl.innerHTML = '';
      document.body.style.overflow = '';
    }
  }
}
