module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const workerUrl = process.env.WORKER_URL ? process.env.WORKER_URL.replace(/\/+$/, '') : '';
  if (!workerUrl) {
    return res.status(503).json({ error: 'Worker media service is not configured' });
  }

  try {
    const workerRes = await fetch(`${workerUrl}/api/jobs/${encodeURIComponent(id)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });

    const data = await workerRes.json().catch(() => ({}));
    return res.status(workerRes.status).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Failed to reach worker service' });
  }
};
