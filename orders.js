const express = require('express');
const rateLimit = require('express-rate-limit');
const supabase = require('../lib/supabaseClient');

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many quote requests sent. Please try again later.' }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', orderLimiter, async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      services,
      estimate_low,
      estimate_high,
      notes
    } = req.body || {};

    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!customer_email || typeof customer_email !== 'string' || !EMAIL_REGEX.test(customer_email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'Please select at least one service.' });
    }
    const low = Number(estimate_low);
    const high = Number(estimate_high);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low) {
      return res.status(400).json({ error: 'Invalid estimate values.' });
    }

    const payload = {
      customer_name: customer_name.trim().slice(0, 200),
      customer_email: customer_email.trim().slice(0, 200),
      customer_phone: customer_phone ? String(customer_phone).trim().slice(0, 30) : null,
      services,
      estimate_low: Math.round(low),
      estimate_high: Math.round(high),
      notes: notes ? String(notes).trim().slice(0, 4000) : null
    };

    const { data, error } = await supabase
      .from('orders')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (orders):', error.message);
      return res.status(500).json({ error: 'Could not submit your request right now. Please try again shortly.' });
    }

    return res.status(201).json({ success: true, order: data });
  } catch (err) {
    console.error('Unexpected error in /api/orders:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;