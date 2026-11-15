const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

function validateYoutubeUrl(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Paste a valid YouTube URL first.');
  }

  const trimmed = value.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS links are supported.');
  }

  const host = (parsed.hostname || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Unsupported host: ${host}. Only YouTube URLs are allowed.`);
  }

  return parsed.toString();
}

function parseYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Worker-Secret');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body || {};
    const validUrl = validateYoutubeUrl(url);

    const workerUrl = process.env.WORKER_URL ? process.env.WORKER_URL.replace(/\/+$/, '') : '';
    const workerSecret = process.env.WORKER_SECRET || '';

    // If Worker service is configured on Railway/Render/VPS, proxy to worker
    if (workerUrl) {
      const headers = { 'Content-Type': 'application/json' };
      if (workerSecret) {
        headers['X-Worker-Secret'] = workerSecret;
      }

      const workerRes = await fetch(`${workerUrl}/api/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: validUrl }),
        signal: AbortSignal.timeout(20000)
      });

      const data = await workerRes.json().catch(() => ({}));
      return res.status(workerRes.status).json(data);
    }

    // Fallback when worker is not yet configured: provide rich metadata
    const videoId = parseYouTubeId(validUrl);
    let meta = {
      title: `YouTube Video (${videoId})`,
      author: 'YouTube Creator',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };

    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=${validUrl}`);
      if (oembedRes.ok) {
        const odata = await oembedRes.json();
        if (odata.title) meta.title = odata.title;
        if (odata.author_name) meta.author = odata.author_name;
      }
    } catch (e) {
      // ignore
    }

    return res.status(200).json({
      jobId: `local-${videoId}`,
      title: meta.title,
      uploader: meta.author,
      thumbnail: meta.thumbnail,
      duration: 180,
      formats: [
        { formatId: '1080p', resolution: '1080p', ext: 'mp4', hasAudio: true },
        { formatId: '720p', resolution: '720p', ext: 'mp4', hasAudio: true },
        { formatId: '480p', resolution: '480p', ext: 'mp4', hasAudio: true },
        { formatId: '360p', resolution: '360p', ext: 'mp4', hasAudio: true }
      ],
      notice: 'Worker URL not set in Vercel. Set WORKER_URL in Vercel Environment Variables to enable full processing.'
    });

  } catch (error) {
    const msg = error.message || 'Unable to analyze this video URL';
    const statusCode = msg.includes('URL') || msg.includes('host') ? 400 : 502;
    return res.status(statusCode).json({ error: msg });
  }
};
