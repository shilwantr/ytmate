module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const workerUrl = process.env.WORKER_URL ? process.env.WORKER_URL.replace(/\/+$/, '') : '';
  let workerStatus = 'unconfigured';

  if (workerUrl) {
    try {
      const workerRes = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (workerRes.ok) {
        workerStatus = 'connected';
      } else {
        workerStatus = 'unreachable';
      }
    } catch (e) {
      workerStatus = 'error';
    }
  }

  res.status(200).json({
    status: 'online',
    platform: 'vercel',
    service: 'YTmate Gateway',
    workerConfigured: !!workerUrl,
    workerStatus,
    timestamp: new Date().toISOString()
  });
};
