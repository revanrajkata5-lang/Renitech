const express = require('express');
const basicAuth = require('express-basic-auth');
const { pool } = require('./db');

const router = express.Router();

// Protect every /admin route with a single username/password pair set via
// environment variables in Render (see README). Never hardcode credentials.
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

router.get('/', async (req, res) => {
  try {
    const typeFilter = ['contact', 'quote'].includes(req.query.type) ? req.query.type : null;
    const { rows } = await pool.query(
      typeFilter
        ? 'SELECT * FROM submissions WHERE type = $1 ORDER BY created_at DESC LIMIT 500'
        : 'SELECT * FROM submissions ORDER BY created_at DESC LIMIT 500',
      typeFilter ? [typeFilter] : []
    );

    const rowsHtml = rows.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td><span class="badge ${r.type}">${escapeHtml(r.type)}</span></td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${escapeHtml(r.name)}</td>
        <td><a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a></td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.company)}</td>
        <td>${escapeHtml(r.services)}</td>
        <td>${escapeHtml(r.budget)}</td>
        <td class="msg">${escapeHtml(r.message)}</td>
      </tr>`).join('');

    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RENI Tech — Submissions</title>
<style>
  body{font-family:-apple-system,Segoe UI,Inter,sans-serif;background:#1c1b1a;color:#f0efec;margin:0;padding:32px;}
  h1{font-size:20px;margin-bottom:4px;}
  .sub{color:#a8a39c;font-size:13px;margin-bottom:24px;}
  .filters a{color:#f0efec;background:#3a3836;padding:6px 14px;border-radius:100px;font-size:13px;margin-right:8px;text-decoration:none;}
  .filters a.active{background:#e3a947;color:#232120;}
  table{border-collapse:collapse;width:100%;margin-top:20px;font-size:13px;}
  th,td{padding:10px 12px;border-bottom:1px solid #3a3836;text-align:left;vertical-align:top;}
  th{color:#a8a39c;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px;}
  .msg{max-width:320px;white-space:pre-wrap;}
  .badge{padding:3px 9px;border-radius:100px;font-size:11px;font-weight:600;}
  .badge.contact{background:#454340;color:#d9d3c4;}
  .badge.quote{background:#e3a947;color:#232120;}
  tr:hover{background:#252423;}
  a{color:#ffcb74;}
</style>
</head>
<body>
  <h1>Submissions</h1>
  <p class="sub">${rows.length} shown (most recent first, limit 500)</p>
  <div class="filters">
    <a href="/admin" class="${!typeFilter ? 'active' : ''}">All</a>
    <a href="/admin?type=contact" class="${typeFilter === 'contact' ? 'active' : ''}">Contact</a>
    <a href="/admin?type=quote" class="${typeFilter === 'quote' ? 'active' : ''}">Quote requests</a>
  </div>
  <table>
    <thead><tr>
      <th>ID</th><th>Type</th><th>When</th><th>Name</th><th>Email</th><th>Phone</th>
      <th>Company</th><th>Services</th><th>Budget</th><th>Message</th>
    </tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="10">No submissions yet.</td></tr>'}</tbody>
  </table>
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
    const { rows } = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000');
    res.json(rows);
  } catch (err) {
    console.error('Admin JSON failed:', err);
    res.status(500).json({ error: 'Could not load submissions.' });
  }
});

module.exports = router;
