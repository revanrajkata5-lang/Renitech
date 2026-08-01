# RENI Tech backend

A small Express API that takes submissions from two forms on the RENI Tech
site — **Contact** and **Quote Request** — and saves them to a PostgreSQL
database you can browse anytime at `/admin`.

## What it does

- `POST /api/contact` — name, email, phone (optional), message
- `POST /api/quote` — name, email, phone, company, services, budget, message
- `GET /admin` — password-protected page listing all submissions, newest first, filterable by type
- `GET /admin/data.json` — same data as JSON, if you ever want to export it
- `GET /healthz` — health check for Render

Every submission lands in one `submissions` table with a `type` column
(`contact` or `quote`), created automatically on first boot.

## Deploy to Render

**Option A — Blueprint (fastest):**
1. Push this folder to a GitHub repo (or add it to your existing `Renitech` repo).
2. In Render, click **New > Blueprint**, point it at the repo. It reads `render.yaml` and creates both the web service and a free PostgreSQL database, wired together automatically.
3. Render will ask you to set `ADMIN_USER` and `ADMIN_PASSWORD` (marked `sync: false` so they're not stored in the blueprint file) — pick a real password here.

**Option B — Manual:**
1. In Render, **New > PostgreSQL** → create a free database, name it anything (e.g. `renitech-db`).
2. **New > Web Service** → connect your repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. In the web service's **Environment** tab, add:
   - `DATABASE_URL` → copy the **Internal Database URL** from your Postgres instance's Info page
   - `ADMIN_USER` → your choice
   - `ADMIN_PASSWORD` → something strong
   - `ALLOWED_ORIGIN` → your live site URL once you have one (e.g. `https://renitechservices.com`); leave as `*` for now if you're still testing
4. Deploy. Visit `https://your-service.onrender.com/healthz` — it should say `ok`.

Render's free web services spin down after inactivity and take ~30-50 seconds to wake on the next request — the first form submission after a quiet period may feel slow. That's expected on the free tier.

## Viewing submissions

Go to `https://your-service.onrender.com/admin`, log in with `ADMIN_USER` / `ADMIN_PASSWORD`. You'll see a table of everyone who submitted either form, with a filter toggle for Contact vs. Quote Request.

## Wiring up your `index.html`

Right now the "Get a Free Consultation" and "Request Exact Quote" buttons in `index.html` just link to `#` — there's no actual form yet. You'll need to add form markup and a small fetch call. Example for the contact form:

```html
<form id="contactForm">
  <input type="text" name="name" placeholder="Your name" required>
  <input type="email" name="email" placeholder="Your email" required>
  <input type="tel" name="phone" placeholder="Phone (optional)">
  <textarea name="message" placeholder="Tell us about your project" required></textarea>
  <!-- honeypot: hidden from real users via CSS, catches simple bots -->
  <input type="text" name="website" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off">
  <button type="submit">Send</button>
</form>
<p id="contactStatus"></p>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const status = document.getElementById('contactStatus');
  status.textContent = 'Sending...';
  try {
    const res = await fetch('https://your-service.onrender.com/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      status.textContent = "Thanks — we'll be in touch shortly.";
      form.reset();
    } else {
      status.textContent = result.errors?.join(' ') || 'Something went wrong.';
    }
  } catch {
    status.textContent = 'Network error — please try again.';
  }
});
</script>
```

The quote request form works the same way against `/api/quote`, with extra fields for `company`, `budget`, and `services` (a comma-separated string, or send multiple checkboxes all named `services`).

Swap `https://your-service.onrender.com` for your actual Render URL once deployed. Say the word if you'd like me to wire the real forms directly into `index.html`.

## Local development

```bash
npm install
cp .env.example .env   # fill in a local or Render DATABASE_URL
npm start
```
