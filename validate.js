const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCommon(body) {
  const errors = [];
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const message = (body.message || '').trim();

  if (!name) errors.push('Name is required.');
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email is required.');
  if (!message) errors.push('Message is required.');
  if (name.length > 200) errors.push('Name is too long.');
  if (message.length > 5000) errors.push('Message is too long (max 5000 characters).');

  // Honeypot field: real users never fill this in (it's hidden in the form's
  // CSS). If it has a value, the submission is almost certainly a bot.
  const isBot = !!(body.website || body._honeypot);

  return { errors, isBot, clean: { name, email, message } };
}

module.exports = { validateCommon };
