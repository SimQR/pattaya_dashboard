const { checkPassword, forward } = require('../../../lib/staging')

// GET /api/snapshot/:id  -> snapshot detail (proxies GET /api/campaign/snapshot/:id)
export default async function handler(req, res) {
  if (!checkPassword(req)) {
    return res.status(401).json({ error: true, message: 'Unauthorized (bad or missing dashboard password).' })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: true, message: 'Method not allowed' })
  }

  const { id, version, ...rest } = req.query
  const base = version === 'v2' ? '/snapshot-v2' : '/snapshot'
  return forward(res, { path: `${base}/${encodeURIComponent(id)}`, method: 'GET', query: rest })
}
