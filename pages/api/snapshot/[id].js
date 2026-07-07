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

  const { id, ...rest } = req.query
  return forward(res, { path: `/snapshot/${encodeURIComponent(id)}`, method: 'GET', query: rest })
}
