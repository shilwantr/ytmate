/**
 * YTMATE.ONLINE - High-Performance Client Engine
 * 100% Ad-Free YouTube Metadata Parser & Direct Stream Downloader
 * Strict Zero-Ad, Zero-Popup, Zero-Tracker Policy
 */

let currentVideoId = null;
let currentVideoData = null;
let hasLocalBackend = false;

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
   Backend Status Detection (Zero-Ad Direct Streaming)
   ========================================================================== */
async function checkBackendStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'online') {
        hasLocalBackend = true;
        console.log('YTmate Clean Ad-Free Engine Active.');
      }
    }
  } catch (err) {
    hasLocalBackend = false;
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
    submitBtn.innerHTML = `<svg class="spin-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg> Fetching...`;
  }

  let videoData = {
    id: videoId,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube Creator',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: 'HD Quality Available',
    url: `https://www.youtube.com/watch?v=${videoId}`
  };

  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.title) videoData.title = data.title;
      if (data.author_name) videoData.author = data.author_name;
    }
  } catch (err) {
    console.warn('Metadata lookup note:', err);
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
   Render Results & Clean 100% Ad-Free Direct Actions
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

  // 100% Clean Ad-Free Quick Action Bar
  let liveWidgetBox = document.getElementById('liveWidgetBox');
  const ytUrl = `https://www.youtube.com/watch?v=${data.id}`;
  const cobaltUrl = `https://cobalt.tools/?u=${encodeURIComponent(ytUrl)}`;
  const directStreamUrl = `/api/stream?url=${encodeURIComponent(ytUrl)}`;

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
      100% Ad-Free Direct Stream Engine
    </div>
    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-top: 0.5rem;">
      <a href="${directStreamUrl}" target="_blank" rel="noopener noreferrer" class="btn-download-action" style="height: 48px; padding: 0 1.5rem; font-size: 0.95rem; text-decoration: none;">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Instant Direct Download (Zero Ads)
      </a>
      <a href="${cobaltUrl}" target="_blank" rel="noopener noreferrer" class="mirror-btn" style="height: 48px; padding: 0 1.5rem; font-size: 0.95rem;">
        ⚡ Open-Source Mirror (Cobalt Ad-Free)
      </a>
    </div>
  `;

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('Video ready! Clean, direct, ad-free downloads available below.', 'success');
}

/* ==========================================================================
   Real Execution of Ad-Free Downloads
   ========================================================================== */
function executeDownload(format, quality) {
  if (!currentVideoId) {
    showToast('Please analyze a YouTube video first.', 'error');
    return;
  }

  const vId = currentVideoId;
  const vTitle = currentVideoData ? currentVideoData.title : `YouTube_${vId}`;
  const ytUrl = `https://www.youtube.com/watch?v=${vId}`;

  // 1. Handle Thumbnail Image Downloads (Direct image file with zero ads)
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

  // 2. Handle Subtitles
  if (['srt', 'vtt', 'txt'].includes(format.toLowerCase())) {
    const subUrl = `https://downsub.com/?url=${encodeURIComponent(ytUrl)}`;
    window.open(subUrl, '_blank', 'noopener,noreferrer');
    showToast(`Opening subtitle extractor for ${format.toUpperCase()}...`, 'info');
    return;
  }

  // 3. Audio & Video Formats
  let formatParam = 'mp4';
  let displayTitle = 'Download Video';

  if (format.toLowerCase() === 'mp3') {
    formatParam = 'mp3';
    displayTitle = `Convert to MP3 Audio (${quality})`;
  } else if (format.toLowerCase() === 'wav') {
    formatParam = 'wav';
    displayTitle = 'Extract Lossless WAV Audio';
  } else if (format.toLowerCase() === 'm4a') {
    formatParam = 'm4a';
    displayTitle = 'Extract Apple M4A Audio';
  } else if (quality.includes('4k') || quality.includes('4K') || quality.includes('2160')) {
    formatParam = '4k';
    displayTitle = 'Download 4K Ultra HD Video';
  } else if (quality.includes('8k') || quality.includes('8K') || quality.includes('4320')) {
    formatParam = '8k';
    displayTitle = 'Download 8K Ultra HD Video';
  } else if (quality.includes('1080')) {
    formatParam = '1080';
    displayTitle = 'Download 1080p Full HD Video';
  } else if (quality.includes('720')) {
    formatParam = '720';
    displayTitle = 'Download 720p HD Video';
  } else if (quality.includes('480')) {
    formatParam = '480';
    displayTitle = 'Download 480p Video';
  } else if (quality.includes('360')) {
    formatParam = '360';
    displayTitle = 'Download 360p Video';
  } else if (quality.includes('Shorts')) {
    formatParam = '1080';
    displayTitle = 'Download YouTube Short in HD';
  }

  openDownloadModal(vId, vTitle, displayTitle, formatParam);
}

/* ==========================================================================
   Clean Ad-Free Download Modal (Zero Ads, Zero Third-Party Iframes)
   ========================================================================== */
function openDownloadModal(videoId, videoTitle, displayTitle, formatParam) {
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const directStreamUrl = `/api/stream?url=${encodeURIComponent(ytUrl)}&format=${formatParam}`;
  const cobaltUrl = `https://cobalt.tools/?u=${encodeURIComponent(ytUrl)}`;

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 520px;">
      <button type="button" class="modal-close-btn" id="modalCloseBtn" aria-label="Close modal">×</button>
      
      <div style="margin-block-end: 1.25rem;">
        <span class="quality-badge badge-1080p" style="margin-bottom: 0.5rem; background: #10b981; color: #fff;">
          ✓ 100% AD-FREE & SAFE
        </span>
        <h3 style="font-size: 1.3rem; font-weight: 700; margin-top: 0.5rem;">${displayTitle}</h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">${videoTitle}</p>
      </div>

      <!-- Primary Ad-Free Direct Stream Button -->
      <div style="background: var(--bg-tertiary); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 1.25rem; margin-block: 1rem; text-align: center;">
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Download directly with zero advertisements, zero popups, and high bandwidth.
        </p>
        <a href="${directStreamUrl}" target="_blank" rel="noopener noreferrer" class="btn-download-action" style="width: 100%; justify-content: center; height: 52px; text-decoration: none; font-size: 1rem;">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Direct Download Now (No Ads)
        </a>
      </div>

      <!-- Open Source Ad-Free Alternative Mirror -->
      <div style="margin-top: 1rem; text-align: left;">
        <p style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">
          Open-Source Ad-Free Mirror:
        </p>
        <a href="${cobaltUrl}" target="_blank" rel="noopener noreferrer" class="mirror-btn" style="width: 100%; justify-content: center; padding: 0.75rem 1rem;">
          ⚡ Open in Cobalt Tools (100% Ad-Free, Open Source)
        </a>
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
   Helper Utilities: Toast & Status Messages
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
  }, 3500);
}
