const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./db');

const contactRoute = require('./contact');
const quoteRoute = require('./quote');
const adminRoute = require('./admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your site to call this API. Set ALLOWED_ORIGIN in Render to your
// real site URL (e.g. https://renitechservices.com) once you know it;
// comma-separate multiple origins if needed. Defaults to "allow everything"
// so the site works immediately — tighten this once it's deployed.
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Basic abuse protection: cap form submissions per IP.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['Too many submissions from this address. Please try again later.'] }
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'renitech-backend', endpoints: ['/api/contact', '/api/quote', '/admin'] });
});

// Render (and any uptime monitor) can hit this to confirm the service is alive.
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.use('/api/contact', formLimiter, contactRoute);
app.use('/api/quote', formLimiter, quoteRoute);
app.use('/admin', adminRoute);

app.use((req, res) => res.status(404).json({ ok: false, errors: ['Not found.'] }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`renitech-backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
