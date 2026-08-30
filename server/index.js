require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config from environment ----
const {
  LIQPAY_PUBLIC_KEY = '',
  LIQPAY_PRIVATE_KEY = '',
  TELEGRAM_BOT_TOKEN = '',
  TELEGRAM_CHAT_ID = '',
  ADMIN_PASSWORD = 'changeme',
  PUBLIC_URL = `http://localhost:${PORT}`,
  COURSE_TG_LINK = '',
  SHEETS_WEBHOOK_URL = '',
} = process.env;

// ---- Database ----
const db = new Database(path.join(__dirname, 'leads.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT UNIQUE,
    name       TEXT,
    phone      TEXT,
    email      TEXT,
    message    TEXT,
    package    TEXT,
    amount     INTEGER DEFAULT 0,
    source     TEXT,               -- 'lead' | 'contact' | 'order'
    status     TEXT DEFAULT 'new', -- new | contacted | paid | cancelled
    comment    TEXT DEFAULT '',    -- нотатка менеджера після дзвінка
    created_at TEXT DEFAULT (datetime('now','localtime')),
    paid_at    TEXT
  );
`);

// Add 'comment' column for databases created before this feature existed
try { db.exec(`ALTER TABLE leads ADD COLUMN comment TEXT DEFAULT ''`); } catch (e) { /* already exists */ }

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow the landing page (served elsewhere) to POST here.
// Lock CORS to your real domain in production.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---- Telegram helper ----
async function notifyTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] token/chat_id not set — skipping notification');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!resp.ok) console.error('[telegram] send failed:', await resp.text());
  } catch (e) {
    console.error('[telegram] error:', e.message);
  }
}

function esc(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

// ---- Google Sheets helper ----
async function pushToSheets(lead) {
  if (!SHEETS_WEBHOOK_URL) return; // not configured — skip silently
  try {
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
  } catch (e) {
    console.error('[sheets] error:', e.message);
  }
}

// ---- LiqPay helpers ----
// data = base64(JSON), signature = base64(sha1(private + data + private))
function liqpaySign(dataB64) {
  return crypto
    .createHash('sha1')
    .update(LIQPAY_PRIVATE_KEY + dataB64 + LIQPAY_PRIVATE_KEY)
    .digest('base64');
}
function liqpayData(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

// ============================================================
//  ROUTES
// ============================================================

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- 1. Receive a lead from any form on the site ----
// body: { name, phone, email?, message?, package?, amount?, source? }
app.post('/api/lead', (req, res) => {
  const { name, phone, email = '', message = '', package: pkg = '', amount = 0, source = 'lead' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ ok: false, error: 'Ім\'я та телефон обов\'язкові' });
  }

  const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const stmt = db.prepare(`
    INSERT INTO leads (order_id, name, phone, email, message, package, amount, source, status)
    VALUES (@order_id, @name, @phone, @email, @message, @package, @amount, @source, 'new')
  `);
  stmt.run({
    order_id: orderId,
    name, phone, email, message,
    package: pkg,
    amount: Number(amount) || 0,
    source,
  });

  // Notify team in Telegram
  const lines = [
    '🔔 <b>Нова заявка</b>',
    `👤 <b>Ім'я:</b> ${esc(name)}`,
    `📞 <b>Телефон:</b> ${esc(phone)}`,
    email ? `✉️ <b>Email:</b> ${esc(email)}` : null,
    pkg ? `📦 <b>Пакет:</b> ${esc(pkg)}` : null,
    amount ? `💰 <b>Сума:</b> ${amount} грн` : null,
    message ? `💬 <b>Запит:</b> ${esc(message)}` : null,
    `🏷 <b>Форма:</b> ${esc(source)}`,
  ].filter(Boolean);
  notifyTelegram(lines.join('\n'));

  // Duplicate to Google Sheets
  pushToSheets({
    order_id: orderId, name, phone, email, message,
    package: pkg, amount: Number(amount) || 0, source, status: 'new',
    created_at: new Date().toLocaleString('uk-UA'),
  });

  res.json({ ok: true, order_id: orderId });
});

// ---- 2. Create a LiqPay checkout for a package ----
// body: { name, phone, email?, package, amount }
// returns { data, signature } — the front-end submits these to LiqPay.
app.post('/api/pay', (req, res) => {
  const { name, phone, email = '', package: pkg = '', amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ ok: false, error: 'Невірна сума' });
  }
  if (!LIQPAY_PUBLIC_KEY || !LIQPAY_PRIVATE_KEY) {
    return res.status(500).json({ ok: false, error: 'LiqPay не налаштовано на сервері' });
  }

  const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  // Save the lead first (status new, will flip to paid on callback)
  db.prepare(`
    INSERT INTO leads (order_id, name, phone, email, package, amount, source, status)
    VALUES (@order_id, @name, @phone, @email, @package, @amount, 'order', 'new')
  `).run({
    order_id: orderId,
    name: name || '',
    phone: phone || '',
    email,
    package: pkg,
    amount: Number(amount),
  });

  // Duplicate order to Google Sheets
  pushToSheets({
    order_id: orderId, name: name || '', phone: phone || '', email,
    message: '', package: pkg, amount: Number(amount), source: 'order', status: 'new',
    created_at: new Date().toLocaleString('uk-UA'),
  });

  const payload = {
    public_key: LIQPAY_PUBLIC_KEY,
    version: 3,
    action: 'pay',
    amount: Number(amount),
    currency: 'UAH',
    description: `Оплата курсу: ${pkg || 'ProPhoto SMM'}`,
    order_id: orderId,
    result_url: `${PUBLIC_URL}/thanks.html`,          // where the user lands after paying
    server_url: `${PUBLIC_URL}/api/liqpay-callback`,  // where LiqPay notifies us
  };

  const data = liqpayData(payload);
  const signature = liqpaySign(data);

  res.json({ ok: true, data, signature, order_id: orderId });
});

// ---- 3. LiqPay server-to-server callback (payment result) ----
app.post('/api/liqpay-callback', (req, res) => {
  const { data, signature } = req.body;
  if (!data || !signature) return res.status(400).send('bad request');

  // Verify signature to make sure the request is really from LiqPay
  const expected = liqpaySign(data);
  if (expected !== signature) {
    console.warn('[liqpay] invalid signature');
    return res.status(403).send('invalid signature');
  }

  let payment;
  try {
    payment = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    return res.status(400).send('bad data');
  }

  const orderId = payment.order_id;
  const status = payment.status; // success | failure | error | sandbox | ...
  const lead = db.prepare('SELECT * FROM leads WHERE order_id = ?').get(orderId);

  if (lead) {
    if (status === 'success' || status === 'sandbox' || status === 'wait_accept') {
      db.prepare(`UPDATE leads SET status='paid', paid_at=datetime('now','localtime') WHERE order_id=?`).run(orderId);
      notifyTelegram([
        '✅ <b>ОПЛАЧЕНО</b>',
        `👤 ${esc(lead.name)}`,
        `📞 ${esc(lead.phone)}`,
        `📦 ${esc(lead.package)}`,
        `💰 ${payment.amount} ${payment.currency}`,
        status === 'sandbox' ? '🧪 (тестовий платіж)' : null,
      ].filter(Boolean).join('\n'));
    } else if (status === 'failure' || status === 'error') {
      db.prepare(`UPDATE leads SET status='cancelled' WHERE order_id=?`).run(orderId);
    }
  }

  // LiqPay expects HTTP 200
  res.send('ok');
});

// ============================================================
//  ADMIN
// ============================================================
function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'] || req.query.pass;
  if (pass !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

// List leads (JSON) — used by the admin page
app.get('/api/admin/leads', checkAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  res.json({ ok: true, leads: rows });
});

// Update a lead's status manually
app.post('/api/admin/leads/:id/status', checkAdmin, (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'contacted', 'paid', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'bad status' });
  const paidClause = status === 'paid' ? `, paid_at=datetime('now','localtime')` : '';
  db.prepare(`UPDATE leads SET status=?${paidClause} WHERE id=?`).run(status, req.params.id);
  res.json({ ok: true });
});

// Save a manager comment (e.g. call result) for a lead
app.post('/api/admin/leads/:id/comment', checkAdmin, (req, res) => {
  const { comment = '' } = req.body;
  db.prepare(`UPDATE leads SET comment=? WHERE id=?`).run(String(comment), req.params.id);
  res.json({ ok: true });
});

// Serve admin static page
app.use('/admin', checkAdminPage, express.static(path.join(__dirname, 'public')));
function checkAdminPage(req, res, next) { next(); } // page itself asks for password client-side

// Thank-you page for LiqPay result_url — invites the client to the course channel
app.get('/thanks.html', (req, res) => {
  const link = COURSE_TG_LINK || '#';
  res.send(`<!doctype html><html lang="uk"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Дякуємо за оплату — ProPhoto Academy</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#000;
      min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .box{max-width:520px;text-align:center;border:2px solid #000;padding:48px 40px}
    h1{font-size:40px;font-weight:800;text-transform:uppercase;letter-spacing:-.03em;margin-bottom:16px}
    p{font-size:16px;color:#444;margin-bottom:14px;line-height:1.5}
    .info{text-align:left;border-top:1px solid #000;margin:26px 0;padding-top:22px}
    .info h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:12px}
    .info li{list-style:none;padding-left:22px;position:relative;margin-bottom:10px;font-size:15px}
    .info li::before{content:"→";position:absolute;left:0;font-weight:700}
    .btn{display:inline-block;background:#000;color:#fff;text-decoration:none;
      padding:18px 36px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;
      font-size:15px;border:2px solid #000;transition:.2s}
    .btn:hover{background:#fff;color:#000}
  </style></head>
  <body><div class="box">
    <h1>Дякуємо! 🎉</h1>
    <p>Вашу оплату отримано. Ласкаво просимо на курс!</p>
    <div class="info">
      <h2>Що далі</h2>
      <ul>
        <li>Приєднайтесь до закритого Telegram-каналу курсу за кнопкою нижче</li>
        <li>Там ви знайдете розклад, доступи до лекцій та всю вводну інформацію</li>
        <li>Наш менеджер зв'яжеться з вами найближчим часом</li>
      </ul>
    </div>
    <a class="btn" href="${link}" target="_blank" rel="noopener">Приєднатися до курсу</a>
  </div></body></html>`);
});

app.listen(PORT, () => {
  console.log(`ProPhoto backend running on ${PUBLIC_URL} (port ${PORT})`);
});
