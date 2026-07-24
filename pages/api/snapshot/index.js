const { checkPassword, forward } = require('../../../lib/staging')

// version=v2 -> /snapshot-v2 (v2 pipeline); anything else -> /snapshot (v1, default).
const basePath = (version) => (version === 'v2' ? '/snapshot-v2' : '/snapshot')

// GET  /api/snapshot         -> list snapshots  (proxies GET  /api/campaign/snapshot[-v2])
// POST /api/snapshot         -> trigger snapshot (proxies POST /api/campaign/snapshot[-v2])
export default async function handler(req, res) {
  if (!checkPassword(req)) {
    return res.status(401).json({ error: true, message: 'Unauthorized (bad or missing dashboard password).' })
  }

  const { version, ...query } = req.query
  const path = basePath(version)

  if (req.method === 'POST') {
    return forward(res, { path, method: 'POST' })
  }
  if (req.method === 'GET') {
    return forward(res, { path, method: 'GET', query })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: true, message: 'Method not allowed' })
}
