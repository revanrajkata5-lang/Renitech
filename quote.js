const express = require('express');
const { pool } = require('./db');
const { validateCommon } = require('./validate');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { errors, isBot, clean } = validateCommon(req.body);
    if (isBot) {
      return res.status(200).json({ ok: true });
    }
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const phone = (req.body.phone || '').trim().slice(0, 40) || null;
    const company = (req.body.company || '').trim().slice(0, 200) || null;
    const budget = (req.body.budget || '').trim().slice(0, 100) || null;

    // "services" can arrive as an array (checkboxes) or a comma string —
    // normalize either into a readable comma-separated string for storage.
    let services = req.body.services;
    if (Array.isArray(services)) {
      services = services.map((s) => String(s).trim()).filter(Boolean).join(', ');
    } else if (typeof services === 'string') {
      services = services.trim();
    } else {
      services = null;
    }
    if (services && services.length > 500) services = services.slice(0, 500);

    await pool.query(
      `INSERT INTO submissions (type, name, email, phone, company, services, budget, message)
       VALUES ('quote', $1, $2, $3, $4, $5, $6, $7)`,
      [clean.name, clean.email, phone, company, services, budget, clean.message]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Quote submission failed:', err);
    res.status(500).json({ ok: false, errors: ['Something went wrong. Please try again shortly.'] });
  }
});

module.exports = router;
