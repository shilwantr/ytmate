const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');

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

// Check Backend Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'YTmate Clean Ad-Free Engine',
    version: '2.0.0',
    adFree: true,
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

// Direct Ad-Free Stream Extractor
app.get('/api/stream', (req, res) => {
  const { url, format = 'mp4', quality = '1080' } = req.query;
  const videoId = parseYouTubeId(url);

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = format.toLowerCase().includes('mp3') || format.toLowerCase().includes('wav') || format.toLowerCase().includes('m4a');
  
  // Format selector for yt-dlp
  const formatArg = isAudio ? '-f ba/b' : '-f b/bv*+ba/b';
  const cmd = `python -m yt_dlp --js-runtimes node:node ${formatArg} -g "${youtubeUrl}"`;

  exec(cmd, { timeout: 25000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('yt-dlp extraction error:', stderr || error.message);
      // Fallback redirect to ad-free Cobalt
      return res.redirect(`https://cobalt.tools/?u=${encodeURIComponent(youtubeUrl)}`);
    }

    const streamUrls = stdout.trim().split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (streamUrls.length === 0) {
      return res.redirect(`https://cobalt.tools/?u=${encodeURIComponent(youtubeUrl)}`);
    }

    // Direct redirect to clean GoogleVideo media stream with zero ads
    const chosenStream = streamUrls[0];
    res.redirect(chosenStream);
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  YTmate Ad-Free Engine running on http://localhost:${PORT}`);
  console.log(`  100% Ad-Free, No Popups, No Third-Party Trackers`);
  console.log(`=======================================================`);
});
