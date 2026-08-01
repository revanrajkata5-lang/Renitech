const express = require('express');
const rateLimit = require('express-rate-limit');
const supabase = require('../lib/supabaseClient');

const router = express.Router();

// Limit to 10 contact submissions per 15 minutes per IP to stop spam/abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages sent. Please try again later.' }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (phone && String(phone).replace(/[^0-9]/g, '').length < 8 && String(phone).trim().length > 0) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    const payload = {
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      phone: phone ? String(phone).trim().slice(0, 30) : null,
      message: message ? String(message).trim().slice(0, 4000) : null
    };

    const { data, error } = await supabase
      .from('contacts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (contacts):', error.message);
      return res.status(500).json({ error: 'Could not save your message right now. Please try again shortly.' });
    }

    return res.status(201).json({ success: true, contact: data });
  } catch (err) {
    console.error('Unexpected error in /api/contact:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;