/**
 * YTMATE.ONLINE - Interactive Client-Side Engine
 * Fast YouTube Metadata Parser, Format Selector & Simulated Stream Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initDownloader();
  initTabs();
  initFaqAccordion();
});

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

    // Close on link click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

/* ==========================================================================
   YouTube URL Parser & Downloader Logic
   ========================================================================== */
function parseYouTubeId(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  // Standard patterns: watch?v=, youtu.be/, shorts/, embed/, music.youtube.com
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = cleanUrl.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }

  // Raw 11-char ID check
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

function initDownloader() {
  const form = document.getElementById('downloaderForm');
  const input = document.getElementById('videoUrlInput');
  const btnPaste = document.getElementById('btnPaste');
  const btnClear = document.getElementById('btnClear');
  const statusMsg = document.getElementById('statusMessage');
  const resultCard = document.getElementById('resultContainer');
  const samplePills = document.querySelectorAll('.sample-pill');

  if (!input) return;

  // Toggle clear button
  input.addEventListener('input', () => {
    if (btnClear) {
      btnClear.style.display = input.value.trim() ? 'block' : 'none';
    }
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }
  });

  // Clear button click
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      input.value = '';
      btnClear.style.display = 'none';
      if (resultCard) resultCard.style.display = 'none';
      if (statusMsg) statusMsg.style.display = 'none';
      input.focus();
    });
  }

  // Paste button click
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
        showToast('Clipboard access denied. Please paste manually.', 'error');
        input.focus();
      }
    });
  }

  // Sample quick links
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

  // Form submission
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleVideoAnalysis(input.value);
    });
  }

  // Setup simulated download buttons
  document.addEventListener('click', (e) => {
    const downloadBtn = e.target.closest('.btn-table-download');
    if (downloadBtn) {
      e.preventDefault();
      const format = downloadBtn.getAttribute('data-format') || 'MP4';
      const quality = downloadBtn.getAttribute('data-quality') || '1080p';
      const filename = downloadBtn.getAttribute('data-filename') || `ytmate_${quality}.${format.toLowerCase()}`;
      startDownloadFlow(format, quality, filename);
    }
  });
}

async function handleVideoAnalysis(rawUrl) {
  const input = document.getElementById('videoUrlInput');
  const statusMsg = document.getElementById('statusMessage');
  const resultCard = document.getElementById('resultContainer');
  const submitBtn = document.querySelector('.btn-download-action');

  const videoId = parseYouTubeId(rawUrl);

  if (!videoId) {
    showStatus('Please enter a valid YouTube video URL or ID (e.g., https://youtu.be/... or https://youtube.com/watch?v=...)', 'error');
    if (resultCard) resultCard.style.display = 'none';
    return;
  }

  // Show loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg class="spin-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg> Analyzing...`;
  }

  let videoData = {
    id: videoId,
    title: 'YouTube Video (' + videoId + ')',
    author: 'YouTube Creator',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: '04:18',
    views: '1.4M views'
  };

  try {
    // Attempt to query official public oEmbed (no API key required)
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oEmbedUrl);
    if (res.ok) {
      const data = await res.json();
      videoData.title = data.title || videoData.title;
      videoData.author = data.author_name || videoData.author;
    }
  } catch (err) {
    console.log('Direct oEmbed lookup skipped or restricted by CORS, applying high-fidelity metadata fallback.', err);
  } finally {
    renderVideoResult(videoData);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download Now`;
    }
  }
}

function renderVideoResult(data) {
  const resultCard = document.getElementById('resultContainer');
  if (!resultCard) return;

  // Populate info
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

  // Update download button data attributes
  document.querySelectorAll('.btn-table-download').forEach(btn => {
    const format = btn.getAttribute('data-format') || 'mp4';
    const quality = btn.getAttribute('data-quality') || '1080p';
    const safeTitle = data.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    btn.setAttribute('data-filename', `${safeTitle}_${quality}.${format.toLowerCase()}`);
  });

  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('Video processed successfully! Choose your resolution or MP3 audio below.', 'success');
}

function showStatus(msg, type = 'error') {
  const statusMsg = document.getElementById('statusMessage');
  if (statusMsg) {
    statusMsg.className = `status-message ${type}`;
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
  }
}

/* ==========================================================================
   Tabs Management
   ========================================================================== */
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

/* ==========================================================================
   FAQ Accordions
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        // Optional: close other open items for accordion effect
        faqItems.forEach(otherItem => {
          if (otherItem !== item && otherItem.open) {
            otherItem.open = false;
          }
        });
      }
    });
  });
}

/* ==========================================================================
   Conversion & Download Stream Simulation Flow
   ========================================================================== */
function startDownloadFlow(format, quality, filename) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDesc');
  const fillEl = document.getElementById('modalProgressFill');
  const percentEl = document.getElementById('modalPercent');

  if (!overlay) {
    triggerFileSave(format, quality, filename);
    return;
  }

  overlay.classList.add('active');
  titleEl.textContent = `Converting & Preparing ${format.toUpperCase()} (${quality})`;
  descEl.textContent = 'Allocating high-speed streaming buffer...';
  fillEl.style.width = '0%';
  percentEl.textContent = '0%';

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 18) + 12;
    if (progress > 100) progress = 100;

    fillEl.style.width = `${progress}%`;
    percentEl.textContent = `${progress}%`;

    if (progress >= 30 && progress < 70) {
      descEl.textContent = format === 'MP3' 
        ? 'Extracting lossless audio and encoding 320kbps MP3 ID3 tags...'
        : `Merging ${quality} video stream with crystal-clear 192k audio...`;
    } else if (progress >= 70 && progress < 100) {
      descEl.textContent = 'Finalizing packaging & generating direct download link...';
    } else if (progress === 100) {
      clearInterval(interval);
      descEl.textContent = 'Done! Your download has started.';
      setTimeout(() => {
        overlay.classList.remove('active');
        triggerFileSave(format, quality, filename);
        showToast(`Downloaded: ${filename}`, 'success');
      }, 600);
    }
  }, 180);
}

function triggerFileSave(format, quality, filename) {
  // Generate a mock media text file payload representing the requested resolution/audio stream
  const content = `YTmate Downloader Stream
Domain: https://ytmate.online
Format: ${format.toUpperCase()}
Quality / Resolution: ${quality}
File Name: ${filename}
Status: Completed
Thank you for using YTmate.online - The fastest YouTube & MP3 Downloader!`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   Toast Notification System
   ========================================================================== */
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
