// Server-side only. Forwards requests to the o2ramp staging campaign API,
// attaching the Api-Key from env so it never reaches the browser.

function getConfig() {
  return {
    base: process.env.CAMPAIGN_API_BASE,
    apiKey: process.env.STAGING_API_KEY,
  }
}

// Optional shared-password gate. Returns true if disabled or the client supplied
// the matching password header.
function checkPassword(req) {
  const required = process.env.DASHBOARD_PASSWORD
  if (!required) return true
  return req.headers['x-dashboard-password'] === required
}

async function forward(res, { path, method = 'GET', query = {} }) {
  const { base, apiKey } = getConfig()
  if (!base || !apiKey) {
    return res.status(500).json({
      error: true,
      message: 'Server not configured. Set CAMPAIGN_API_BASE and STAGING_API_KEY.',
    })
  }

  const clean = {}
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') clean[k] = v
  }
  const qs = new URLSearchParams(clean).toString()
  const url = `${base}${path}${qs ? `?${qs}` : ''}`

  try {
    const upstream = await fetch(url, {
      method,
      headers: { Authorization: `Api-Key ${apiKey}` },
    })
    const text = await upstream.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text } }
    return res.status(upstream.status).json(body)
  } catch (e) {
    return res.status(502).json({ error: true, message: `Upstream fetch failed: ${e.message}` })
  }
}

module.exports = { checkPassword, forward }
