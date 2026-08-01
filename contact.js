const express = require('express');
const { pool } = require('./db');
const { validateCommon } = require('./validate');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { errors, isBot, clean } = validateCommon(req.body);
    if (isBot) {
      // Pretend it worked so bots don't learn anything, but don't store it.
      return res.status(200).json({ ok: true });
    }
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const phone = (req.body.phone || '').trim().slice(0, 40) || null;

    await pool.query(
      `INSERT INTO submissions (type, name, email, phone, message)
       VALUES ('contact', $1, $2, $3, $4)`,
      [clean.name, clean.email, phone, clean.message]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Contact submission failed:', err);
    res.status(500).json({ ok: false, errors: ['Something went wrong. Please try again shortly.'] });
  }
});

module.exports = router;
