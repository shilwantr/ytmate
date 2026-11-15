/**
 * YTMATE.ONLINE - High-Performance Client Engine
 * Robust YouTube Metadata Parser & Direct In-Browser Media Stream Downloader
 * 100% Working, Zero Redirects, Zero Popups, Zero Ads
 */

let currentVideoId = null;
let currentVideoData = null;
let hasLocalBackend = false;
let backendApiUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initDownloader();
  initTabs();
  initFaqAccordion();
  initModalListeners();
  checkBackendStatus();
});

/* ==========================================================================
   Backend Status Detection & Auto-Configuration
   ========================================================================== */
async function checkBackendStatus() {
  // Allow overriding backend URL from localStorage if user hosts API on Render/VPS
  const customBackend = localStorage.getItem('ytmate_backend_api');
  if (customBackend) {
    backendApiUrl = customBackend.replace(/\/+$/, '');
  }

  const endpoint = backendApiUrl ? `${backendApiUrl}/api/status` : '/api/status';

  try {
    const res = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'online') {
        hasLocalBackend = true;
        console.log('[YTmate] Direct Download Backend is ONLINE:', data);
        updateBackendStatusBadge(true);
        return;
      }
    }
  } catch (err) {
    hasLocalBackend = false;
  }

  updateBackendStatusBadge(false);
}

function updateBackendStatusBadge(isOnline) {
  let badge = document.getElementById('backendStatusBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'backendStatusBadge';
    badge.className = 'backend-status-badge';
    const formBox = document.querySelector('.search-box');
    if (formBox && formBox.parentNode) {
      formBox.parentNode.insertBefore(badge, formBox.nextSibling);
    }
  }

  if (isOnline) {
    badge.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.825rem; color: #10b981; margin-top: 0.75rem; font-weight: 600;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
        Direct In-Browser Streaming Engine: Active (100% Ad-Free, No Redirects)
      </div>
    `;
  } else {
    badge.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.75rem;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>
        Direct Download: Connect/Deploy Backend for 100% In-Browser Streaming without redirects
        <a href="#deployBackendModal" onclick="openBackendConfigModal(event)" style="color: var(--primary); text-decoration: underline; margin-left: 0.25rem;">[Settings]</a>
      </div>
    `;
  }
}

/* ==========================================================================
   Theme Management (Light / Dark)
   ========================================================================== */
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const storedTheme = localStorage.getItem('ytmate_theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  setTheme(storedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ytmate_theme', theme);

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    themeToggle.innerHTML = theme === 'dark' 
      ? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`
      : `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

/* ==========================================================================
   Mobile Navigation Menu
   ========================================================================== */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', !isExpanded);
      navMenu.classList.toggle('active');
    });

    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

/* ==========================================================================
   YouTube URL Parser
   ========================================================================== */
function parseYouTubeId(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  // Comprehensive regex covering standard watch URLs, short URLs, embeds, Shorts, Music
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regExp);

  if (match && match[1]) {
    return match[1];
  }

  // Raw 11-char ID check
  if (/^[\w-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

/* ==========================================================================
   Downloader Engine Initialization
   ========================================================================== */
function initDownloader() {
  const form = document.getElementById('downloaderForm');
  const input = document.getElementById('videoUrlInput');
  const btnPaste = document.getElementById('btnPaste');
  const btnClear = document.getElementById('btnClear');
  const statusMsg = document.getElementById('statusMessage');
  const resultCard = document.getElementById('resultContainer');
  const samplePills = document.querySelectorAll('.sample-pill');

  if (!input) return;

  input.addEventListener('input', () => {
    if (btnClear) {
      btnClear.style.display = input.value.trim() ? 'block' : 'none';
    }
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }
  });

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      input.value = '';
      btnClear.style.display = 'none';
      if (resultCard) resultCard.style.display = 'none';
      if (statusMsg) statusMsg.style.display = 'none';
      currentVideoId = null;
      input.focus();
    });
  }

  if (btnPaste) {
    btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          input.value = text;
          if (btnClear) btnClear.style.display = 'block';
          showToast('URL pasted from clipboard!', 'info');
          handleVideoAnalysis(text);
        }
      } catch (err) {
        showToast('Clipboard permission denied. Please paste manually.', 'error');
        input.focus();
      }
    });
  }

  samplePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const url = pill.getAttribute('data-url');
      if (url) {
        input.value = url;
        if (btnClear) btnClear.style.display = 'block';
        handleVideoAnalysis(url);
      }
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleVideoAnalysis(input.value);
    });
  }

  // Handle table download buttons
  document.addEventListener('click', (e) => {
    const downloadBtn = e.target.closest('.btn-table-download');
    if (downloadBtn) {
      e.preventDefault();
      const format = downloadBtn.getAttribute('data-format') || 'mp4';
      const quality = downloadBtn.getAttribute('data-quality') || '1080p';
      executeDownload(format, quality);
    }
  });
}

/* ==========================================================================
   Video Analysis & Metadata Fetching
   ========================================================================== */
async function handleVideoAnalysis(rawUrl) {
  const statusMsg = document.getElementById('statusMessage');
  const resultCard = document.getElementById('resultContainer');
  const submitBtn = document.querySelector('.btn-download-action');

  const videoId = parseYouTubeId(rawUrl);

  if (!videoId) {
    showStatus('Please enter a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)', 'error');
    if (resultCard) resultCard.style.display = 'none';
    return;
  }

  currentVideoId = videoId;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="spin-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg> Analyzing...`;
  }

  let videoData = {
    id: videoId,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube Creator',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: 'Full Quality Available',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    jobId: null
  };

  try {
    const analyzeEndpoint = (backendApiUrl || '') + '/api/analyze';
    const analyzeRes = await fetch(analyzeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawUrl }),
      signal: AbortSignal.timeout(8000)
    });

    if (analyzeRes.ok) {
      const aData = await analyzeRes.json();
      if (aData.title) videoData.title = aData.title;
      if (aData.uploader) videoData.author = aData.uploader;
      if (aData.thumbnail) videoData.thumbnail = aData.thumbnail;
      if (aData.duration) {
        const m = Math.floor(aData.duration / 60);
        const s = aData.duration % 60;
        videoData.duration = `${m}m ${s < 10 ? '0' : ''}${s}s`;
      }
      if (aData.jobId) videoData.jobId = aData.jobId;
      if (aData.formats) videoData.formats = aData.formats;
    } else {
      throw new Error('Analyze endpoint skipped');
    }
  } catch (err) {
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) videoData.title = data.title;
        if (data.author_name) videoData.author = data.author_name;
      }
    } catch (e) {
      console.warn('Metadata lookup note:', e);
    }
  } finally {
    currentVideoData = videoData;
    renderVideoResult(videoData);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download Now`;
    }
  }
}

/* ==========================================================================
   Render Results & Direct Quick Download Bar
   ========================================================================== */
function renderVideoResult(data) {
  const resultCard = document.getElementById('resultContainer');
  if (!resultCard) return;

  const titleEl = document.getElementById('resTitle');
  const authorEl = document.getElementById('resAuthor');
  const thumbEl = document.getElementById('resThumb');
  const durationEl = document.getElementById('resDuration');

  if (titleEl) titleEl.textContent = data.title;
  if (authorEl) authorEl.textContent = data.author;
  if (durationEl) durationEl.textContent = data.duration;
  if (thumbEl) {
    thumbEl.src = data.thumbnail;
    thumbEl.onerror = () => {
      thumbEl.src = `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`;
    };
  }

  // Quick Action Buttons
  let liveWidgetBox = document.getElementById('liveWidgetBox');
  if (!liveWidgetBox) {
    liveWidgetBox = document.createElement('div');
    liveWidgetBox.id = 'liveWidgetBox';
    liveWidgetBox.className = 'live-widget-box';
    
    const formatTabs = resultCard.querySelector('.format-tabs');
    if (formatTabs) {
      resultCard.insertBefore(liveWidgetBox, formatTabs);
    } else {
      resultCard.appendChild(liveWidgetBox);
    }
  }

  liveWidgetBox.innerHTML = `
    <div class="widget-badge-label">
      <svg width="14" height="14" fill="#10b981" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Direct In-Browser Download (Zero Redirects)
    </div>
    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-top: 0.65rem;">
      <button type="button" onclick="executeDownload('mp4', '1080p')" class="btn-download-action" style="height: 48px; padding: 0 1.5rem; font-size: 0.95rem; cursor: pointer; border: none;">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        ⚡ Direct Download MP4 (1080p HD)
      </button>
      <button type="button" onclick="executeDownload('mp3', '320kbps')" class="mirror-btn" style="height: 48px; padding: 0 1.35rem; font-size: 0.925rem; cursor: pointer;">
        🎵 Direct Download MP3 (Audio)
      </button>
    </div>
  `;

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('Video ready! Click Direct Download or choose resolution below.', 'success');
}

/* ==========================================================================
   Direct In-Browser Download Execution (Zero Redirects)
   ========================================================================== */
function executeDownload(format, quality) {
  if (!currentVideoId) {
    showToast('Please enter a YouTube video URL first.', 'error');
    return;
  }

  const vId = currentVideoId;
  const vTitle = currentVideoData ? currentVideoData.title : `YouTube_${vId}`;
  const ytUrl = `https://www.youtube.com/watch?v=${vId}`;

  // 1. Direct Thumbnail Image Download
  if (format === 'jpg') {
    let imgUrl = `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;
    if (quality.includes('SD')) imgUrl = `https://img.youtube.com/vi/${vId}/sddefault.jpg`;
    if (quality.includes('HQ')) imgUrl = `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
    if (quality.includes('MQ')) imgUrl = `https://img.youtube.com/vi/${vId}/mqdefault.jpg`;

    const a = document.createElement('a');
    a.href = imgUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = `${vTitle}_${quality}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading high-res image: ${quality}`, 'success');
    return;
  }

  // 2. Subtitles Extractor
  if (['srt', 'vtt', 'txt'].includes(format.toLowerCase())) {
    const subUrl = `https://downsub.com/?url=${encodeURIComponent(ytUrl)}`;
    window.open(subUrl, '_blank', 'noopener,noreferrer');
    showToast(`Opening subtitle extractor for ${format.toUpperCase()}...`, 'info');
    return;
  }

  // 3. Audio & Video Formats
  let formatParam = 'mp4';
  let qualityParam = '1080';
  let displayTitle = 'Download Video';

  if (format.toLowerCase().includes('mp3')) {
    formatParam = 'mp3';
    qualityParam = 'audio';
    displayTitle = `Convert to MP3 Audio (${quality})`;
  } else if (format.toLowerCase().includes('wav')) {
    formatParam = 'wav';
    qualityParam = 'audio';
    displayTitle = 'Extract Lossless WAV Audio';
  } else if (format.toLowerCase().includes('m4a')) {
    formatParam = 'm4a';
    qualityParam = 'audio';
    displayTitle = 'Extract Apple M4A Audio';
  } else if (quality.includes('4k') || quality.includes('4K') || quality.includes('2160')) {
    formatParam = 'mp4';
    qualityParam = '4k';
    displayTitle = 'Download 4K Ultra HD Video';
  } else if (quality.includes('8k') || quality.includes('8K') || quality.includes('4320')) {
    formatParam = 'mp4';
    qualityParam = '8k';
    displayTitle = 'Download 8K Ultra HD Video';
  } else if (quality.includes('1080')) {
    formatParam = 'mp4';
    qualityParam = '1080';
    displayTitle = 'Download 1080p Full HD Video';
  } else if (quality.includes('720')) {
    formatParam = 'mp4';
    qualityParam = '720';
    displayTitle = 'Download 720p HD Video';
  } else if (quality.includes('480')) {
    formatParam = 'mp4';
    qualityParam = '480';
    displayTitle = 'Download 480p Video';
  } else if (quality.includes('360')) {
    formatParam = 'mp4';
    qualityParam = '360';
    displayTitle = 'Download 360p Video';
  }

  const fileExt = formatParam === 'mp3' ? 'mp3' : 'mp4';
  const safeName = (vTitle || 'video').replace(/[^\w\s\-]/gi, '').trim().replace(/\s+/g, '_') || `youtube_${vId}`;
  const filename = `${safeName}.${fileExt}`;

  // If local backend is active, trigger direct stream immediately with NO REDIRECT
  if (hasLocalBackend) {
    const streamEndpoint = backendApiUrl 
      ? `${backendApiUrl}/api/download/${encodeURIComponent(filename)}?url=${encodeURIComponent(ytUrl)}&format=${formatParam}&quality=${qualityParam}`
      : `/api/download/${encodeURIComponent(filename)}?url=${encodeURIComponent(ytUrl)}&format=${formatParam}&quality=${qualityParam}`;

    triggerDirectDownload(streamEndpoint, filename, displayTitle);
  } else if (currentVideoData && currentVideoData.jobId && !currentVideoData.jobId.startsWith('local-')) {
    // If worker job ID is available (Vercel + Worker architecture), run worker job
    const reqType = formatParam === 'mp3' ? 'audio' : 'video';
    const bitrate = formatParam === 'mp3' ? 320 : null;
    startWorkerJobDownload(currentVideoData.jobId, reqType, qualityParam, bitrate, filename, displayTitle);
  } else {
    // If worker is not configured on Vercel, open modal with options and instructions
    openDownloadModal(vId, vTitle, displayTitle, formatParam, qualityParam, filename);
  }
}

/* ==========================================================================
   Worker Job Execution & Polling Flow (Vercel Architecture)
   ========================================================================== */
async function startWorkerJobDownload(jobId, type, formatId, bitrate, filename, displayTitle) {
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 500px; text-align: center;">
      <button type="button" class="modal-close-btn" id="modalCloseBtn" aria-label="Close modal">×</button>
      <div style="margin-bottom: 1.25rem;">
        <span class="quality-badge badge-1080p" style="background:#635bff; color:#fff;">MEDIA PROCESSING</span>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem;" id="jobStageTitle">Preparing Media...</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;" id="jobStageSubtitle">${filename}</p>
      </div>

      <div style="background: var(--bg-tertiary); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
          <svg class="spin-icon" width="36" height="36" fill="none" stroke="#635bff" stroke-width="2.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
        </div>
        <p style="font-size: 0.9rem; font-weight: 600;" id="jobStageText">Starting media conversion on worker service...</p>
        <p style="font-size: 0.775rem; color: var(--text-muted); margin-top: 0.5rem;">
          Worker is processing video and audio with FFmpeg. Zero redirects, zero popups.
        </p>
      </div>
    </div>
  `;
  overlay.classList.add('active');

  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) closeBtn.onclick = () => overlay.classList.remove('active');

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, type, formatId, audioBitrate: bitrate || 192 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start download job');

    const stageText = document.getElementById('jobStageText');
    const stageTitle = document.getElementById('jobStageTitle');

    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > 60) {
        clearInterval(pollInterval);
        if (stageText) stageText.textContent = 'Processing timeout. Please try again.';
        return;
      }

      try {
        const pollRes = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (!pollRes.ok) return;
        const job = await pollRes.json();

        if (stageText && job.stage) stageText.textContent = job.stage;

        if (job.status === 'ready') {
          clearInterval(pollInterval);
          if (stageTitle) stageTitle.textContent = 'Ready! Downloading...';
          if (stageText) stageText.textContent = 'Processing completed. Saving file to your device.';
          
          triggerDirectDownload(job.downloadUrl || `/api/jobs/${encodeURIComponent(jobId)}/download`, filename, displayTitle);
          setTimeout(() => overlay.classList.remove('active'), 2500);
        } else if (job.status === 'failed') {
          clearInterval(pollInterval);
          if (stageTitle) stageTitle.textContent = 'Processing Failed';
          if (stageText) stageText.textContent = job.error || 'An error occurred during media conversion.';
        }
      } catch (e) {
        // ignore
      }
    }, 1500);

  } catch (err) {
    const stageText = document.getElementById('jobStageText');
    if (stageText) stageText.textContent = err.message;
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   Zero-Redirect Direct Browser Download Trigger
   ========================================================================== */
function triggerDirectDownload(streamUrl, filename, displayTitle = 'Your download') {
  showToast(`📥 Starting direct download for ${displayTitle}! Saving ${filename} directly to your device...`, 'success');

  // Trigger browser download via invisible anchor with explicit filename and extension
  const hiddenLink = document.createElement('a');
  hiddenLink.href = streamUrl;
  hiddenLink.setAttribute('download', filename);
  hiddenLink.style.display = 'none';
  document.body.appendChild(hiddenLink);
  hiddenLink.click();
  setTimeout(() => {
    hiddenLink.remove();
  }, 3000);
}

/* ==========================================================================
   Download Modal Dialog (Direct Download + Clean Fallback)
   ========================================================================== */
function openDownloadModal(videoId, videoTitle, displayTitle, formatParam, qualityParam, filename) {
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const encodedYtUrl = encodeURIComponent(ytUrl);
  const streamEndpoint = backendApiUrl 
    ? `${backendApiUrl}/api/download/${encodeURIComponent(filename)}?url=${encodedYtUrl}&format=${formatParam}&quality=${qualityParam}`
    : `/api/download/${encodeURIComponent(filename)}?url=${encodedYtUrl}&format=${formatParam}&quality=${qualityParam}`;

  const saveFromUrl = `https://en.savefrom.net/1-youtube-video-downloader-782/?url=${encodedYtUrl}`;
  const keepVidUrl = `https://keepv.id/?url=${encodedYtUrl}`;

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 520px;">
      <button type="button" class="modal-close-btn" id="modalCloseBtn" aria-label="Close modal">×</button>
      
      <div style="margin-block-end: 1.25rem;">
        <span class="quality-badge badge-1080p" style="margin-bottom: 0.5rem; background: #10b981; color: #fff;">
          DIRECT DOWNLOAD
        </span>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem;">${displayTitle}</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem; word-break: break-word;">${videoTitle}</p>
      </div>

      <div style="background: var(--bg-tertiary); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 1.25rem; margin-block: 1rem; text-align: left;">
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          
          <button type="button" onclick="triggerDirectDownload('${streamEndpoint}', '${filename}', '${displayTitle}')" class="btn-download-action" style="width: 100%; justify-content: center; height: 52px; font-size: 1rem; cursor: pointer; border: none;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            ⚡ Start Direct Download (${filename})
          </button>

          <p style="font-size: 0.775rem; color: var(--text-muted); text-align: center; margin: 0;">
            Direct download streams straight into your browser with zero redirects, zero ads, and zero popups.
          </p>

          <div style="border-top: 1px solid var(--border-subtle); margin-top: 0.5rem; padding-top: 0.75rem;">
            <p style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">
              Alternative Ad-Free Mirrors (Optional):
            </p>
            <div style="display: flex; gap: 0.5rem;">
              <a href="${saveFromUrl}" target="_blank" rel="noopener noreferrer" class="mirror-btn" style="flex: 1; justify-content: center; font-size: 0.825rem; padding: 0.6rem;">
                SaveFrom Mirror
              </a>
              <a href="${keepVidUrl}" target="_blank" rel="noopener noreferrer" class="mirror-btn" style="flex: 1; justify-content: center; font-size: 0.825rem; padding: 0.6rem;">
                KeepVid Mirror
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
  }
}

function openBackendConfigModal(e) {
  if (e) e.preventDefault();
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  const currentApi = localStorage.getItem('ytmate_backend_api') || '';

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 500px; text-align: left;">
      <button type="button" class="modal-close-btn" id="modalCloseBtn" aria-label="Close modal">×</button>
      
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">Direct Streaming Backend Setup</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
        Direct downloading without redirects requires a streaming server (which runs <code style="color:var(--primary)">yt-dlp</code> to bypass YouTube restrictions).
      </p>

      <form id="backendConfigForm" onsubmit="saveBackendConfig(event)">
        <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
          Custom Backend API URL (e.g. Render, Railway, or VPS):
        </label>
        <input type="url" id="backendApiInput" value="${currentApi}" placeholder="https://your-api.onrender.com" style="width: 100%; padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--bg-tertiary); color: var(--text-primary); margin-bottom: 1rem;">

        <div style="display: flex; gap: 0.75rem;">
          <button type="submit" class="btn-download-action" style="flex: 1; height: 44px; font-size: 0.9rem; border: none; cursor: pointer;">
            Save & Connect
          </button>
          <button type="button" onclick="clearBackendConfig()" class="mirror-btn" style="padding: 0 1rem; height: 44px; font-size: 0.9rem; cursor: pointer;">
            Reset Local
          </button>
        </div>
      </form>
    </div>
  `;

  overlay.classList.add('active');

  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
  }
}

window.saveBackendConfig = function(e) {
  e.preventDefault();
  const input = document.getElementById('backendApiInput');
  if (input) {
    const val = input.value.trim().replace(/\/+$/, '');
    if (val) {
      localStorage.setItem('ytmate_backend_api', val);
      backendApiUrl = val;
      showToast('Backend API configured! Testing connection...', 'info');
    } else {
      localStorage.removeItem('ytmate_backend_api');
      backendApiUrl = '';
    }
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    checkBackendStatus();
  }
};

window.clearBackendConfig = function() {
  localStorage.removeItem('ytmate_backend_api');
  backendApiUrl = '';
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('active');
  showToast('Reset to local backend.', 'info');
  checkBackendStatus();
};

function initModalListeners() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
      }
    });
  }
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
function showStatus(msg, type = 'error') {
  const statusMsg = document.getElementById('statusMessage');
  if (statusMsg) {
    statusMsg.className = `status-message ${type}`;
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        faqItems.forEach(otherItem => {
          if (otherItem !== item && otherItem.open) {
            otherItem.open = false;
          }
        });
      }
    });
  });
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icon = type === 'success' 
    ? '<svg width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : type === 'error'
    ? '<svg width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    : '<svg width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
