import { useState, useEffect, useCallback } from 'react'

const fmt = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString())
const fmtEpoch = (s) => (s ? new Date(Number(s) * 1000).toLocaleString() : '-')

const LIST_PAGE_SIZE = 10 // snapshots per page in the list (client-side)

// Client-side filter: match user_id (exact/substring) or email (substring), case-insensitive.
const matchDetail = (d, q) => {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return String(d.user_id ?? '').toLowerCase().includes(s) ||
    String(d.email ?? '').toLowerCase().includes(s)
}

export default function Home() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [genResult, setGenResult] = useState(null)

  const [snapshots, setSnapshots] = useState([])
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [listPage, setListPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [version, setVersion] = useState('v1') // 'v1' | 'v2' — which campaign API pipeline to hit

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dash_pw') : ''
    if (saved) setPassword(saved)
  }, [])

  const headers = useCallback(() => {
    const h = { 'Content-Type': 'application/json' }
    if (password) h['x-dashboard-password'] = password
    return h
  }, [password])

  const call = useCallback(async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, headers: headers() })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.error) {
      throw new Error(body.message || `HTTP ${res.status}`)
    }
    return body
  }, [headers])

  const savePassword = () => {
    if (typeof window !== 'undefined') localStorage.setItem('dash_pw', password)
  }

  const loadSnapshots = useCallback(async () => {
    setError(''); setBusy('list')
    try {
      const body = await call(`/api/snapshot?limit=9999&order=desc&version=${version}`)
      setSnapshots(body.data || [])
      setListPage(1)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }, [call, version])

  const generate = async () => {
    setError(''); setGenResult(null); setBusy('gen')
    try {
      const body = await call(`/api/snapshot?version=${version}`, { method: 'POST' })
      setGenResult(body.data || body)
      await loadSnapshots()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  const loadDetails = useCallback(async (id, p = 1) => {
    setError(''); setBusy('detail'); setSelected(id); setPage(p); setUserId('')
    try {
      const q = new URLSearchParams({ page: String(p), limit: '9999', version })
      const body = await call(`/api/snapshot/${id}?${q.toString()}`)
      setDetails(body.data || [])
      setMeta(body.meta || null)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }, [call, version])

  // Switching pipeline resets the view; loadSnapshots reloads via its version dep.
  const onVersion = (v) => {
    if (v === version) return
    setVersion(v)
    setSelected(null); setDetails([]); setMeta(null); setGenResult(null); setError(''); setListPage(1)
  }

  const downloadCsv = useCallback(() => {
    const rowsData = details.filter(d => matchDetail(d, userId))
    if (!rowsData.length) return
    const cols = [
      ['user_id', d => d.user_id],
      ['username', d => d.username ?? ''],
      ['email', d => d.email ?? ''],
      ['partnership', d => d.partner_email ?? ''],
      ['rank', d => d.affiliate_rank_number ?? ''],
      ['personal', d => d.personal_deposit_amount],
      ['group_sales', d => d.group_sales_amount],
      ['carry_up', d => d.carry_up_amount],
      ['investor', d => d.quantity_investor_tickets],
      ['business', d => d.quantity_business_class_flight_tickets],
      ['influencer', d => d.quantity_influencer_tickets],
    ]
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = [cols.map(c => c[0]).join(',')]
    for (const d of rowsData) rows.push(cols.map(c => esc(c[1](d))).join(','))
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const suffix = userId.trim() ? `-filter-${userId.trim().replace(/[^a-z0-9@._-]/gi, '_')}` : ''
    a.download = `snapshot-${selected}${suffix}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [details, selected, userId])

  useEffect(() => { loadSnapshots() }, [loadSnapshots])

  const listTotalPages = Math.max(1, Math.ceil(snapshots.length / LIST_PAGE_SIZE))
  const listPageSafe = Math.min(listPage, listTotalPages)
  const pagedSnapshots = snapshots.slice((listPageSafe - 1) * LIST_PAGE_SIZE, listPageSafe * LIST_PAGE_SIZE)

  const filteredDetails = details.filter(d => matchDetail(d, userId))

  return (
    <main style={S.main}>
      <div style={S.bgGlowA} />
      <div style={S.bgGlowB} />
      <header style={S.hero}>
        <div style={S.heroTop}>
          <div>
            <div style={S.eyebrow}>Campaign operations</div>
            <h1 style={S.h1}>Pattaya Campaign — Snapshot Dashboard</h1>
          </div>
          <div style={S.versionToggle} role="group" aria-label="API version">
            {['v1', 'v2'].map((v) => (
              <button
                key={v}
                onClick={() => onVersion(v)}
                style={version === v ? S.segActive : S.seg}
                aria-pressed={version === v}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p style={S.subtitle}>
          Generate snapshots, inspect historical runs, and drill into user-level metrics from the staging API.
        </p>
        <div style={S.chipRow}>
          <span style={S.chip}>Staging API</span>
          <span style={S.chip}>Password gated</span>
          <span style={S.chip}>Snapshot history</span>
          <span style={{ ...S.chip, ...S.chipVersion }}>Pipeline: {version.toUpperCase()}</span>
        </div>
      </header>

      <section style={S.card}>
        <label style={S.label}>Dashboard password (if enabled)</label>
        <div style={S.row}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to disable" style={S.input} />
          <button onClick={() => setShowPassword(v => !v)} style={S.btnGhost} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? '🙈 Hide' : '👁 Show'}
          </button>
          <button onClick={savePassword} style={S.btnGhost}>Save</button>
        </div>
      </section>

      {error && <div style={S.error}>⚠ {error}</div>}

      {/* 1. Generate snapshot */}
      <section style={S.card}>
        <h2 style={S.h2}>1. Generate Snapshot (POST /snapshot)</h2>
        <button onClick={generate} disabled={busy === 'gen'} style={S.btnPrimary}>
          {busy === 'gen' ? 'Generating…' : 'Generate Snapshot'}
        </button>
        {genResult && (
          <div style={S.summary}>
            <b>#{genResult.snapshot_id}</b> · seq {genResult.sequence_no} · users {fmt(genResult.total_users)} ·
            Investor {fmt(genResult.total_investor_tickets)} ·
            Business {fmt(genResult.total_business_class_flight_tickets)} ·
            Influencer {fmt(genResult.total_influencer_tickets)}
          </div>
        )}
      </section>

      {/* 2. Snapshot list */}
      <section style={S.card}>
        <div style={S.rowBetween}>
          <h2 style={S.h2}>2. Snapshot List (GET /snapshot)</h2>
          <button onClick={loadSnapshots} disabled={busy === 'list'} style={S.btnGhost}>
            {busy === 'list' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>
              {['id', 'seq', 'status', 'period_start', 'period_end', 'created_at', ''].map(h =>
                <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {pagedSnapshots.map(s => (
                <tr key={s.id} style={selected === s.id ? S.trActive : undefined}>
                  <td style={S.td}>{s.id}</td>
                  <td style={S.td}>{s.sequence_no}</td>
                  <td style={S.td}>{s.status}</td>
                  <td style={S.td}>{s.period_start === 0 ? 'From start' : fmtEpoch(s.period_start)}</td>
                  <td style={S.td}>{fmtEpoch(s.period_end)}</td>
                  <td style={S.td}>{fmtEpoch(s.created_at)}</td>
                  <td style={S.td}><button onClick={() => loadDetails(s.id, 1)} style={S.btnSm}>View details</button></td>
                </tr>
              ))}
              {snapshots.length === 0 && <tr><td style={S.td} colSpan={7}>No snapshots yet</td></tr>}
            </tbody>
          </table>
        </div>
        {snapshots.length > 0 && (
          <div style={S.rowBetween}>
            <span style={S.muted}>Total {fmt(snapshots.length)} snapshots · Page {listPageSafe}/{listTotalPages}</span>
            <span>
              <button disabled={listPageSafe <= 1} onClick={() => setListPage(listPageSafe - 1)} style={S.btnSm}>Previous</button>
              <button disabled={listPageSafe >= listTotalPages} onClick={() => setListPage(listPageSafe + 1)} style={S.btnSm}>Next</button>
            </span>
          </div>
        )}
      </section>

      {/* 3. Details */}
      {selected && (
        <section style={S.card}>
          <h2 style={S.h2}>3. Snapshot #{selected} Details (GET /snapshot/:id)</h2>
          <div style={S.row}>
            <input value={userId} onChange={(e) => setUserId(e.target.value)}
              placeholder="Filter by user_id or email" style={S.input} />
            {userId && <button onClick={() => setUserId('')} style={S.btnGhost}>Clear</button>}
            <button onClick={downloadCsv} disabled={!filteredDetails.length} style={S.btnGhost}>Download CSV</button>
          </div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>
                {['user_id', 'username', 'email', 'partnership', 'rank', 'personal', 'group_sales', 'carry_up', 'investor', 'business', 'influencer'].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredDetails.map(d => (
                  <tr key={d.id}>
                    <td style={S.td}>{d.user_id}</td>
                    <td style={S.td}>{d.username ?? '-'}</td>
                    <td style={S.td}>{d.email ?? '-'}</td>
                    <td style={S.td}>{d.partner_email ?? '-'}</td>
                    <td style={S.td}>{d.affiliate_rank_number ?? '-'}</td>
                    <td style={S.td}>{fmt(d.personal_deposit_amount)}</td>
                    <td style={S.td}>{fmt(d.group_sales_amount)}</td>
                    <td style={S.td}>{fmt(d.carry_up_amount)}</td>
                    <td style={S.td}>{d.quantity_investor_tickets}</td>
                    <td style={S.td}>{d.quantity_business_class_flight_tickets}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{d.quantity_influencer_tickets}</td>
                  </tr>
                ))}
                {filteredDetails.length === 0 && <tr><td style={S.td} colSpan={11}>{details.length ? 'No match' : 'No data'}</td></tr>}
              </tbody>
            </table>
          </div>
          {meta && (
            <div style={S.rowBetween}>
              <span style={S.muted}>
                {userId.trim()
                  ? `Showing ${fmt(filteredDetails.length)} of ${fmt(meta.total_item)} items`
                  : `Total ${fmt(meta.total_item)} items · Page ${meta.current_page}/${meta.total_page}`}
              </span>
              <span>
                <button disabled={page <= 1} onClick={() => loadDetails(selected, page - 1)} style={S.btnSm}>Previous</button>
                <button disabled={meta.total_page && page >= meta.total_page} onClick={() => loadDetails(selected, page + 1)} style={S.btnSm}>Next</button>
              </span>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

const S = {
  main: {
    minHeight: '100vh',
    padding: '32px 20px 48px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    color: '#102033',
    background: 'radial-gradient(circle at top left, rgba(79, 70, 229, 0.14), transparent 30%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlowA: {
    position: 'fixed',
    inset: '10% auto auto -8%',
    width: 260,
    height: 260,
    borderRadius: '50%',
    background: 'rgba(99, 102, 241, 0.12)',
    filter: 'blur(20px)',
    pointerEvents: 'none',
  },
  bgGlowB: {
    position: 'fixed',
    right: '-6%',
    bottom: '-10%',
    width: 320,
    height: 320,
    borderRadius: '50%',
    background: 'rgba(56, 189, 248, 0.12)',
    filter: 'blur(22px)',
    pointerEvents: 'none',
  },
  hero: {
    maxWidth: 1280,
    margin: '0 auto 18px',
    padding: '12px 4px 4px',
  },
  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  versionToggle: {
    display: 'inline-flex',
    padding: 4,
    gap: 4,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(148,163,184,0.4)',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
    backdropFilter: 'blur(12px)',
    flexShrink: 0,
  },
  seg: {
    padding: '8px 18px',
    borderRadius: 999,
    border: 0,
    background: 'transparent',
    color: '#52657b',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
  },
  segActive: {
    padding: '8px 18px',
    borderRadius: 999,
    border: 0,
    background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.28)',
  },
  chipVersion: {
    background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.95) 0%, rgba(238, 242, 255, 0.95) 100%)',
    color: '#1e3a8a',
    border: '1px solid rgba(147, 197, 253, 0.6)',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.06)',
    color: '#38506c',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  h1: { fontSize: 30, lineHeight: 1.15, margin: 0, letterSpacing: '-0.03em' },
  subtitle: { margin: '10px 0 14px', maxWidth: 720, color: '#52657b', fontSize: 15, lineHeight: 1.6 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '7px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(148,163,184,0.35)',
    color: '#3d5168',
    fontSize: 12,
    fontWeight: 600,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
    backdropFilter: 'blur(12px)',
  },
  card: {
    maxWidth: 1280,
    margin: '0 auto 18px',
    background: 'rgba(255, 255, 255, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(16px)',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#5b6b7f', marginBottom: 8, letterSpacing: '0.02em' },
  row: { display: 'flex', gap: 10, alignItems: 'center' },
  rowBetween: { display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  input: {
    flex: 1,
    padding: '11px 14px',
    border: '1px solid rgba(148, 163, 184, 0.55)',
    borderRadius: 12,
    fontSize: 14,
    background: 'rgba(255,255,255,0.95)',
    color: '#102033',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  btnPrimary: {
    padding: '11px 16px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
    color: '#fff',
    border: 0,
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.25)',
  },
  btnGhost: {
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#31445a',
  },
  btnSm: {
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#31445a',
    marginLeft: 6,
  },
  summary: { marginTop: 14, padding: 14, background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.9) 0%, rgba(238, 242, 255, 0.9) 100%)', borderRadius: 14, fontSize: 13, color: '#1e3a8a', border: '1px solid rgba(147, 197, 253, 0.5)' },
  error: { padding: 12, background: 'rgba(254, 226, 226, 0.92)', color: '#991b1b', borderRadius: 14, margin: '0 auto 18px', fontSize: 14, maxWidth: 1120, border: '1px solid rgba(248, 113, 113, 0.3)' },
  tableWrap: { overflowX: 'auto', marginTop: 14, borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.2)' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: 'rgba(255,255,255,0.7)' },
  th: { textAlign: 'left', padding: '11px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.22)', color: '#607086', whiteSpace: 'nowrap', background: 'rgba(248, 250, 252, 0.9)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  td: { padding: '11px 12px', borderBottom: '1px solid rgba(226, 232, 240, 0.9)', whiteSpace: 'nowrap', color: '#1f2f41' },
  trActive: { background: 'rgba(239, 246, 255, 0.95)' },
  muted: { fontSize: 12, color: '#66788f' },
}
