const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Strict Cache-Control middleware to prevent browsers from caching old JS/HTML
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
}));

function parseYouTubeId(url) {
  if (!url) return null;
  const cleanUrl = url.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[\w-]{11}$/.test(cleanUrl)) return cleanUrl;
  return null;
}

// Mount Vercel Gateway handlers for local testing
const analyzeHandler = require('./api/analyze.js');
const downloadHandler = require('./api/download.js');
const jobHandler = require('./api/jobs/[id].js');
const jobDownloadHandler = require('./api/jobs/[id]/download.js');

app.post('/api/analyze', (req, res) => analyzeHandler(req, res));
app.post('/api/download', (req, res) => downloadHandler(req, res));
app.get('/api/jobs/:id', (req, res) => jobHandler(req, res));
app.get('/api/jobs/:id/download', (req, res) => jobDownloadHandler(req, res));

// Health / Status Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'YTmate Direct Streaming Engine',
    version: '3.2.0',
    directDownload: true,
    noRedirect: true,
    ffmpeg: !!ffmpegPath,
    timestamp: new Date().toISOString()
  });
});

// Video Metadata Info
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  const videoId = parseYouTubeId(url);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL or ID' });
  }

  try {
    const noembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (noembedRes.ok) {
      const data = await noembedRes.json();
      return res.json({
        id: videoId,
        title: data.title || `YouTube Video (${videoId})`,
        author: data.author_name || 'YouTube Creator',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`
      });
    }
  } catch (err) {
    console.warn('Metadata lookup warning:', err.message);
  }

  res.json({
    id: videoId,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube Creator',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`
  });
});

// Core Media Stream Handler
async function handleStreamDownload(req, res) {
  const { url, format = 'mp4', quality = '1080' } = req.query;
  const videoId = parseYouTubeId(url);

  if (!videoId) {
    return res.status(400).send('Invalid YouTube URL or ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = ['mp3', 'm4a', 'wav', 'audio'].some(x => format.toLowerCase().includes(x));

  let formatSelector = '18/b/bv*+ba/b';
  let ext = 'mp4';
  let contentType = 'video/mp4';

  if (isAudio) {
    ext = 'mp3';
    contentType = 'audio/mpeg';
  } else if (quality === '720') {
    formatSelector = '22/18/b[height<=720]/b';
  } else if (quality === '480') {
    formatSelector = 'b[height<=480]/18/b';
  } else if (quality === '360') {
    formatSelector = '18/b[height<=360]/b';
  } else if (quality === '1080' || quality === '4k' || quality === '8k') {
    formatSelector = '18/b/bv*+ba/b';
  }

  // Requested custom filename or fallback
  let requestedFilename = req.params.filename;
  if (!requestedFilename) {
    let safeTitle = `ytmate_${videoId}`;
    try {
      const metaRes = await fetch(`https://noembed.com/embed?url=${youtubeUrl}`);
      if (metaRes.ok) {
        const data = await metaRes.json();
        if (data.title) {
          safeTitle = data.title.replace(/[^\w\s\-]/gi, '').trim().replace(/\s+/g, '_').substring(0, 60);
        }
      }
    } catch (e) {
      // ignore
    }
    requestedFilename = `${safeTitle}.${ext}`;
  }

  // Ensure file extension matches format
  if (isAudio && !requestedFilename.endsWith('.mp3') && !requestedFilename.endsWith('.m4a')) {
    requestedFilename += '.mp3';
  } else if (!isAudio && !requestedFilename.endsWith('.mp4') && !requestedFilename.endsWith('.webm')) {
    requestedFilename += '.mp4';
  }

  // Explicit headers for forced native video/audio download
  res.setHeader('Content-Disposition', `attachment; filename="${requestedFilename}"; filename*=UTF-8''${encodeURIComponent(requestedFilename)}`);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const args = [
    '-m', 'yt_dlp',
    '--quiet',
    '--no-warnings',
    '--remote-components', 'ejs:github',
    '--js-runtimes', 'node:node',
  ];

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  if (isAudio) {
    // Extract real MP3 using static FFmpeg
    args.push('-x', '--audio-format', 'mp3', '-o', '-', youtubeUrl);
  } else {
    args.push('-f', formatSelector, '-o', '-', youtubeUrl);
  }

  console.log(`[Stream] Direct stream started for ${videoId} (${requestedFilename})...`);
  const proc = spawn('python', args);

  proc.stdout.pipe(res);

  proc.stderr.on('data', (errData) => {
    console.error(`[yt-dlp stderr] ${errData.toString()}`);
  });

  proc.on('close', (code) => {
    console.log(`[Stream] Direct stream finished for ${videoId} (${requestedFilename}) with code ${code}`);
  });

  proc.on('error', (err) => {
    console.error('[Stream error]', err);
    if (!res.headersSent) {
      res.status(500).send('Streaming process error');
    }
  });

  req.on('close', () => {
    proc.kill();
  });
}

// 100% DIRECT DOWNLOAD STREAMING ROUTES
app.get('/api/stream', handleStreamDownload);
app.get('/api/stream/:filename', handleStreamDownload);
app.get('/api/download', handleStreamDownload);
app.get('/api/download/:filename', handleStreamDownload);

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  YTmate Direct Streaming Engine running on http://localhost:${PORT}`);
  console.log(`  Direct Download: 100% In-Browser, Zero Redirect, Zero Ads`);
  console.log(`=======================================================`);
});
