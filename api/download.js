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
    const { jobId, type = 'video', formatId, audioBitrate = 192 } = req.body || {};

    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId parameter' });
    }

    const workerUrl = process.env.WORKER_URL ? process.env.WORKER_URL.replace(/\/+$/, '') : '';
    const workerSecret = process.env.WORKER_SECRET || '';

    if (!workerUrl) {
      return res.status(503).json({
        error: 'Worker media service is not configured. Please set WORKER_URL in Vercel project environment variables.'
      });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (workerSecret) {
      headers['X-Worker-Secret'] = workerSecret;
    }

    const workerRes = await fetch(`${workerUrl}/api/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobId, type, formatId, audioBitrate }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await workerRes.json().catch(() => ({}));
    return res.status(workerRes.status).json(data);

  } catch (error) {
    return res.status(502).json({ error: error.message || 'Worker processing error' });
  }
};
