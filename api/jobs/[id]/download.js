module.exports = async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Missing jobId');
  }

  const workerUrl = process.env.WORKER_URL ? process.env.WORKER_URL.replace(/\/+$/, '') : '';
  if (!workerUrl) {
    return res.status(503).send('Worker service is not configured. Please set WORKER_URL in Vercel settings.');
  }

  // Redirect directly to the worker's download endpoint to avoid Vercel 4.5MB payload limit
  return res.redirect(302, `${workerUrl}/api/jobs/${encodeURIComponent(id)}/download`);
};
