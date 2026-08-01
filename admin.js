const express = require('express');
const basicAuth = require('express-basic-auth');
const { pool } = require('./db');

const router = express.Router();

// Logout must be registered BEFORE the basicAuth middleware below, so the
// browser can reach it without needing to already be authenticated.
//
// HTTP Basic Auth has no real server-side session to end — the browser just
// keeps re-sending the credentials it has cached. This route always replies
// 401 with a fresh challenge, which makes most browsers drop the cached
// credentials for this realm. It's the standard best-effort trick, not a
// guarantee on every browser — closing the browser/tab (or clearing site
// data) is the one fully reliable way to sign out.
router.get('/logout', (req, res) => {
  res
    .set('WWW-Authenticate', 'Basic realm="RENI Tech Admin", charset="UTF-8"')
    .status(401)
    .set('Content-Type', 'text/html')
    .send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signed out — RENI Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#201F1E;--surface:#2B2927;--line:#413E3A;--gold:#FFCB74;--gold-deep:#E3A947;--text:#F6F4F1;--muted:#B0A99E;--on-gold:#211C10;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:36px;max-width:360px;text-align:center;}
  .mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#FFDA9B,var(--gold-deep));display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;color:var(--on-gold);margin:0 auto 18px;}
  h1{font-family:'Space Grotesk',sans-serif;font-size:19px;margin-bottom:10px;}
  p{color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:22px;}
  a{display:inline-block;background:linear-gradient(135deg,#FFDA9B,var(--gold));color:var(--on-gold);padding:11px 22px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;}
</style>
</head>
<body>
  <div class="card">
    <div class="mark">R</div>
    <h1>Signed out</h1>
    <p>You've been signed out of RENI Admin. If your browser still logs you back in automatically, close this tab (or the browser) to fully clear it.</p>
    <a href="/admin">Back to sign in</a>
  </div>
</body>
</html>`);
});

// Protect every remaining /admin route with a single username/password pair
// set via environment variables in Render (see README). Never hardcode credentials.
router.use(
  basicAuth({
    users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'change-me-now' },
    challenge: true,
    realm: 'RENI Tech Admin'
  })
);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const chars = parts.slice(0, 2).map((p) => p[0] || '').join('');
  return escapeHtml(chars.toUpperCase() || '?');
}

router.get('/', async (req, res) => {
  try {
    const typeFilter = ['contact', 'quote'].includes(req.query.type) ? req.query.type : null;
    const q = (req.query.q || '').trim();

    const conditions = [];
    const params = [];
    if (typeFilter) {
      params.push(typeFilter);
      conditions.push(`type = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(name ILIKE ${p} OR email ILIKE ${p} OR company ILIKE ${p} OR message ILIKE ${p} OR services ILIKE ${p})`
      );
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM submissions ${whereClause} ORDER BY created_at DESC LIMIT 500`,
      params
    );

    // Totals for the stat cards always reflect everything, not the current filter.
    const { rows: totals } = await pool.query(
      `SELECT type, COUNT(*)::int AS count FROM submissions GROUP BY type`
    );
    const totalContacts = totals.find((t) => t.type === 'contact')?.count || 0;
    const totalQuotes = totals.find((t) => t.type === 'quote')?.count || 0;
    const { rows: last24 } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM submissions WHERE created_at > now() - interval '24 hours'`
    );
    const recentCount = last24[0]?.count || 0;

    const qsBase = (overrides = {}) => {
      const merged = { type: typeFilter || '', q };
      Object.assign(merged, overrides);
      const parts = Object.entries(merged)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
      return parts.length ? `?${parts.join('&')}` : '';
    };

    const rowsHtml = rows.map((r) => {
      const services = (r.services || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      return `
      <tr>
        <td class="col-who">
          <div class="who">
            <span class="avatar">${initials(r.name)}</span>
            <div>
              <div class="who-name">${escapeHtml(r.name)}</div>
              <div class="who-sub"><a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>${r.phone ? ' · ' + escapeHtml(r.phone) : ''}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${escapeHtml(r.type)}">${escapeHtml(r.type)}</span></td>
        <td class="col-date">${new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}<div class="who-sub">${timeAgo(r.created_at)}</div></td>
        <td>${r.company ? escapeHtml(r.company) : '<span class="muted">—</span>'}</td>
        <td>${services.length ? `<div class="chips">${services.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}</div>` : '<span class="muted">—</span>'}</td>
        <td>${r.budget ? escapeHtml(r.budget) : '<span class="muted">—</span>'}</td>
        <td class="col-msg">${r.message ? escapeHtml(r.message) : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');

    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RENI Tech Services — Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#201F1E; --bg-deep:#181717; --surface:#2B2927; --surface-2:#353330;
  --line:#413E3A; --line-soft:#333130; --gold:#FFCB74; --gold-deep:#E3A947;
  --text:#F6F4F1; --muted:#B0A99E; --muted-2:#7C766D; --on-gold:#211C10;
  --contact:#D9D3C4; --quote:#FFCB74;
  --display:'Space Grotesk',sans-serif; --body:'Inter',sans-serif; --mono:'JetBrains Mono',monospace;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{
  background:radial-gradient(900px 500px at 100% -10%, rgba(255,203,116,0.06), transparent 60%), var(--bg);
  color:var(--text);font-family:var(--body);min-height:100vh;padding:36px 40px 70px;-webkit-font-smoothing:antialiased;
}
a{color:var(--gold);}
::selection{background:var(--gold);color:var(--on-gold);}
.wrap{max-width:1280px;margin:0 auto;}

.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:28px;flex-wrap:wrap;}
.brand{display:flex;align-items:center;gap:12px;}
.brand-mark{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#FFDA9B,var(--gold-deep));display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;font-size:16px;color:var(--on-gold);}
.brand h1{font-family:var(--display);font-weight:700;font-size:22px;letter-spacing:-0.3px;}
.brand .sub{font-family:var(--mono);font-size:11px;letter-spacing:1.6px;color:var(--muted-2);text-transform:uppercase;margin-top:2px;}
.topbar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.live-pill{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11.5px;color:var(--muted);background:var(--surface);border:1px solid var(--line);padding:8px 14px;border-radius:100px;}
.live-dot{width:6px;height:6px;border-radius:50%;background:#8FC896;box-shadow:0 0 0 3px rgba(143,200,150,0.15);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.logout-btn{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--muted);background:var(--surface);border:1px solid var(--line);padding:9px 15px;border-radius:100px;text-decoration:none;transition:all .18s ease;}
.logout-btn:hover{border-color:#E68D82;color:#E68D82;}

.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px;}
@media (max-width:900px){.stats-row{grid-template-columns:repeat(2,1fr);}}
.stat-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px 22px;}
.stat-label{font-family:var(--mono);font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted-2);}
.stat-num{font-family:var(--display);font-weight:700;font-size:28px;margin-top:9px;}
.stat-num.accent{color:var(--gold);}

.toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap;}
.tabs{display:flex;gap:8px;flex-wrap:wrap;}
.tab{padding:9px 16px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--muted);font-size:13px;font-weight:500;text-decoration:none;transition:all .15s ease;}
.tab.active{background:rgba(255,203,116,0.14);border-color:var(--gold);color:var(--gold);}
.tab:hover:not(.active){border-color:var(--muted-2);color:var(--text);}
.searchform{display:flex;gap:8px;}
.searchform input[type="text"]{
  padding:9px 14px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--text);
  font-size:13.5px;min-width:220px;
}
.searchform input[type="text"]:focus{border-color:var(--gold);outline:none;}
.searchform button, .export-btn{
  padding:9px 16px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--muted);
  font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;
}
.searchform button:hover, .export-btn:hover{border-color:var(--gold);color:var(--gold);}

.table-wrap{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface);}
.table-scroll{overflow-x:auto;}
table{width:100%;border-collapse:collapse;min-width:920px;}
th{text-align:left;font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--muted-2);padding:14px 16px;background:var(--surface-2);border-bottom:1px solid var(--line);white-space:nowrap;}
td{padding:15px 16px;border-bottom:1px solid var(--line-soft);font-size:13.6px;vertical-align:top;}
tbody tr:hover{background:rgba(255,255,255,0.015);}
tr:last-child td{border-bottom:none;}
.muted{color:var(--muted-2);}
.who{display:flex;align-items:center;gap:11px;}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--surface-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;color:var(--gold);flex-shrink:0;}
.who-name{font-weight:600;}
.who-sub{color:var(--muted);font-size:12px;margin-top:2px;}
.col-msg{max-width:280px;color:var(--muted);line-height:1.5;}
.col-date{font-family:var(--mono);font-size:12.2px;white-space:nowrap;}
.col-who{min-width:200px;}
.chips{display:flex;flex-wrap:wrap;gap:5px;max-width:200px;}
.chip{font-size:11px;padding:3px 9px;border-radius:100px;background:var(--surface-2);color:var(--contact);border:1px solid var(--line);white-space:nowrap;}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:100px;font-size:11.5px;font-weight:600;text-transform:capitalize;}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;}
.badge.contact{background:rgba(217,211,196,0.14);color:var(--contact);}
.badge.quote{background:rgba(255,203,116,0.14);color:var(--gold);}
.empty-state{padding:70px 20px;text-align:center;color:var(--muted);}
.empty-state svg{color:var(--muted-2);margin-bottom:14px;}
.empty-state h4{font-family:var(--display);font-size:16px;color:var(--text);margin-bottom:6px;}
.footnote{margin-top:16px;font-size:12.5px;color:var(--muted-2);}
</style>
</head>
<body>
<div class="wrap">

  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">R</div>
      <div>
        <h1>RENI Admin</h1>
        <div class="sub">Submissions</div>
      </div>
    </div>
    <div class="topbar-actions">
      <div class="live-pill"><span class="live-dot"></span> Live from database</div>
      <a class="logout-btn" href="/admin/logout">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
        Log Out
      </a>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-card"><div class="stat-label">Contact Messages</div><div class="stat-num">${totalContacts}</div></div>
    <div class="stat-card"><div class="stat-label">Quote Requests</div><div class="stat-num">${totalQuotes}</div></div>
    <div class="stat-card"><div class="stat-label">Total Submissions</div><div class="stat-num accent">${totalContacts + totalQuotes}</div></div>
    <div class="stat-card"><div class="stat-label">Last 24 Hours</div><div class="stat-num accent">${recentCount}</div></div>
  </div>

  <div class="toolbar">
    <div class="tabs">
      <a href="/admin${qsBase({ type: '' })}" class="tab ${!typeFilter ? 'active' : ''}">All</a>
      <a href="/admin${qsBase({ type: 'contact' })}" class="tab ${typeFilter === 'contact' ? 'active' : ''}">Contact Messages</a>
      <a href="/admin${qsBase({ type: 'quote' })}" class="tab ${typeFilter === 'quote' ? 'active' : ''}">Quote Requests</a>
    </div>
    <form class="searchform" method="get" action="/admin">
      ${typeFilter ? `<input type="hidden" name="type" value="${escapeHtml(typeFilter)}">` : ''}
      <input type="text" name="q" placeholder="Search name, email, message..." value="${escapeHtml(q)}">
      <button type="submit">Search</button>
      <a class="export-btn" href="/admin/data.json${qsBase()}">Export JSON</a>
    </form>
  </div>

  <div class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>From</th><th>Type</th><th>Received</th><th>Company</th><th>Services</th><th>Budget</th><th>Message</th></tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7"><div class="empty-state">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <h4>Nothing here yet</h4><p>${q ? 'No results match your search.' : 'Submissions will appear here as they come in.'}</p>
          </div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <p class="footnote">${rows.length} shown, most recent first · limit 500</p>

</div>
</body>
</html>`);
  } catch (err) {
    console.error('Admin view failed:', err);
    res.status(500).send('Could not load submissions.');
  }
});

// Plain JSON, handy if you ever want to pull this into a spreadsheet or script.
router.get('/data.json', async (req, res) => {
  try {
    const typeFilter = ['contact', 'quote'].includes(req.query.type) ? req.query.type : null;
    const { rows } = await pool.query(
      typeFilter
        ? 'SELECT * FROM submissions WHERE type = $1 ORDER BY created_at DESC LIMIT 1000'
        : 'SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000',
      typeFilter ? [typeFilter] : []
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin JSON failed:', err);
    res.status(500).json({ error: 'Could not load submissions.' });
  }
});

module.exports = router;
