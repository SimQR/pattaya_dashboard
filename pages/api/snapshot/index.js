const { checkPassword, forward } = require('../../../lib/staging')

// GET  /api/snapshot         -> list snapshots  (proxies GET  /api/campaign/snapshot)
// POST /api/snapshot         -> trigger snapshot (proxies POST /api/campaign/snapshot)
export default async function handler(req, res) {
  if (!checkPassword(req)) {
    return res.status(401).json({ error: true, message: 'Unauthorized (bad or missing dashboard password).' })
  }

  if (req.method === 'POST') {
    return forward(res, { path: '/snapshot', method: 'POST' })
  }
  if (req.method === 'GET') {
    return forward(res, { path: '/snapshot', method: 'GET', query: req.query })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: true, message: 'Method not allowed' })
}
