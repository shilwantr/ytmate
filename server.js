const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function parseYouTubeId(url) {
  if (!url) return null;
  const cleanUrl = url.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[\w-]{11}$/.test(cleanUrl)) return cleanUrl;
  return null;
}

// API Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'YTmate Engine',
    version: '1.2.0',
    timestamp: new Date().toISOString()
  });
});

// API Info Endpoint
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
    console.error('Info lookup error:', err);
  }

  res.json({
    id: videoId,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube Creator',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`
  });
});

// API Download Redirect / Proxy Endpoint
app.get('/api/download', (req, res) => {
  const { url, format = 'mp4', quality = '1080' } = req.query;
  const videoId = parseYouTubeId(url);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube video URL' });
  }

  // Format mapping for saver gateways
  let targetFormat = 'mp4';
  if (format.toLowerCase().includes('mp3')) {
    targetFormat = 'mp3';
  } else if (quality.includes('4k') || quality.includes('2160')) {
    targetFormat = '4k';
  } else if (quality.includes('1080')) {
    targetFormat = '1080';
  } else if (quality.includes('720')) {
    targetFormat = '720';
  } else if (format.toLowerCase().includes('wav')) {
    targetFormat = 'wav';
  } else if (format.toLowerCase().includes('m4a')) {
    targetFormat = 'm4a';
  }

  // Primary Gateway Redirect
  const gatewayUrl = `https://p.savenow.to/api/button/?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&f=${targetFormat}`;
  res.redirect(gatewayUrl);
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  YTmate Server is running on port ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
