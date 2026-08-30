/**
 * Єдиний інтерфейс до бази даних.
 * Якщо задано DATABASE_URL (напр. Postgres на Render) — використовує Postgres.
 * Інакше — локальний файл SQLite (для розробки на комп'ютері).
 *
 * Назовні дає 4 async-функції: init, insertLead, allLeads, getByOrderId,
 * updateStatusByOrderId, updateStatusById, updateComment.
 */
const path = require('path');

const USE_PG = !!process.env.DATABASE_URL;

let pg = null;
let sqlite = null;

if (USE_PG) {
  const { Pool } = require('pg');
  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Render Postgres requires SSL
  });
} else {
  const Database = require('better-sqlite3');
  sqlite = new Database(path.join(__dirname, 'leads.db'));
  sqlite.pragma('journal_mode = WAL');
}

// ---- Create table ----
async function init() {
  if (USE_PG) {
    try {
      await pg.query('SELECT 1'); // test the connection first
      console.log('[db] Postgres connection OK');
    } catch (e) {
      console.error('==================================================');
      console.error('[db] POSTGRES CONNECTION FAILED:', e.message);
      console.error('[db] Перевір DATABASE_URL. Сервер НЕ стартує, щоб не втрачати дані.');
      console.error('==================================================');
      throw e; // stop the server so the problem is obvious, instead of silently using SQLite
    }
    await pg.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id         SERIAL PRIMARY KEY,
        order_id   TEXT UNIQUE,
        name       TEXT,
        phone      TEXT,
        email      TEXT,
        message    TEXT,
        package    TEXT,
        amount     INTEGER DEFAULT 0,
        source     TEXT,
        status     TEXT DEFAULT 'new',
        comment    TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at    TIMESTAMP
      );
    `);
  } else {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id   TEXT UNIQUE,
        name       TEXT,
        phone      TEXT,
        email      TEXT,
        message    TEXT,
        package    TEXT,
        amount     INTEGER DEFAULT 0,
        source     TEXT,
        status     TEXT DEFAULT 'new',
        comment    TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        paid_at    TEXT
      );
    `);
    try { sqlite.exec(`ALTER TABLE leads ADD COLUMN comment TEXT DEFAULT ''`); } catch (e) {}
  }
}

// ---- Insert a new lead ----
async function insertLead(d) {
  if (USE_PG) {
    await pg.query(
      `INSERT INTO leads (order_id,name,phone,email,message,package,amount,source,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new')`,
      [d.order_id, d.name, d.phone, d.email || '', d.message || '', d.package || '', d.amount || 0, d.source || 'lead']
    );
  } else {
    sqlite.prepare(
      `INSERT INTO leads (order_id,name,phone,email,message,package,amount,source,status)
       VALUES (@order_id,@name,@phone,@email,@message,@package,@amount,@source,'new')`
    ).run({
      order_id: d.order_id, name: d.name, phone: d.phone,
      email: d.email || '', message: d.message || '', package: d.package || '',
      amount: d.amount || 0, source: d.source || 'lead',
    });
  }
}

// ---- Get all leads (newest first) ----
async function allLeads() {
  if (USE_PG) {
    const r = await pg.query('SELECT * FROM leads ORDER BY id DESC');
    return r.rows;
  }
  return sqlite.prepare('SELECT * FROM leads ORDER BY id DESC').all();
}

// ---- Get one lead by order_id ----
async function getByOrderId(orderId) {
  if (USE_PG) {
    const r = await pg.query('SELECT * FROM leads WHERE order_id=$1', [orderId]);
    return r.rows[0] || null;
  }
  return sqlite.prepare('SELECT * FROM leads WHERE order_id=?').get(orderId) || null;
}

// ---- Update status by order_id (used by LiqPay callback) ----
async function updateStatusByOrderId(orderId, status, markPaid) {
  if (USE_PG) {
    const paid = markPaid ? ', paid_at=NOW()' : '';
    await pg.query(`UPDATE leads SET status=$1${paid} WHERE order_id=$2`, [status, orderId]);
  } else {
    const paid = markPaid ? `, paid_at=datetime('now','localtime')` : '';
    sqlite.prepare(`UPDATE leads SET status=?${paid} WHERE order_id=?`).run(status, orderId);
  }
}

// ---- Update status by id (admin manual) ----
async function updateStatusById(id, status, markPaid) {
  if (USE_PG) {
    const paid = markPaid ? ', paid_at=NOW()' : '';
    await pg.query(`UPDATE leads SET status=$1${paid} WHERE id=$2`, [status, id]);
  } else {
    const paid = markPaid ? `, paid_at=datetime('now','localtime')` : '';
    sqlite.prepare(`UPDATE leads SET status=?${paid} WHERE id=?`).run(status, id);
  }
}

// ---- Update manager comment ----
async function updateComment(id, comment) {
  if (USE_PG) {
    await pg.query('UPDATE leads SET comment=$1 WHERE id=$2', [comment, id]);
  } else {
    sqlite.prepare('UPDATE leads SET comment=? WHERE id=?').run(comment, id);
  }
}

module.exports = {
  USE_PG, init, insertLead, allLeads, getByOrderId,
  updateStatusByOrderId, updateStatusById, updateComment,
};
