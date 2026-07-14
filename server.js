'use strict';

const express  = require('express');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

// ── Database setup ──────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'tracker.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    balance INTEGER NOT NULL DEFAULT 0,
    added   INTEGER NOT NULL DEFAULT 0,
    spent   INTEGER NOT NULL DEFAULT 0,
    budget  INTEGER
  );

  INSERT OR IGNORE INTO state (id, balance, added, spent)
  VALUES (1, 0, 0, 0);

  CREATE TABLE IF NOT EXISTS history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT    NOT NULL,
    amount    INTEGER NOT NULL DEFAULT 0,
    note      TEXT    NOT NULL DEFAULT '',
    balance   INTEGER NOT NULL,
    created   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS task_types (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    tokens     REAL    NOT NULL DEFAULT 1,
    created    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  INSERT OR IGNORE INTO task_types (name, tokens) VALUES
    ('New journey- simple',                              10),
    ('New journey- medium',                              20),
    ('New journey- complex',                             30),
    ('Master Templates',                                  8),
    ('NPS Scripts/R&R',                                   5),
    ('Emails',                                            4),
    ('Standard Email - Drag & Drop',                      3),
    ('Persado- simple',                                   5),
    ('Persado- complex',                                 10),
    ('Vouchers',                                          4),
    ('Automation studio notification',                    6),
    ('Case creation',                                     3),
    ('Case Amendment',                                    2),
    ('Content block re-publishing per one journey',       2),
    ('Landing page - simple',                             8),
    ('Landing page - complex',                           16),
    ('SMS Activity',                                      3),
    ('Journey amendment - simple',                        5),
    ('Journey amendment - medium',                       10),
    ('Journey amendment - complex',                      15),
    ('Email Amendment',                                   2),
    ('SMS Amendment',                                     2),
    ('Messaging Apps - Simple',                           4),
    ('Messaging Apps - Complex',                          8),
    ('Incident - simple',                                 3),
    ('Incident - complex',                                6),
    ('POC (HRS spent)',                                   8),
    ('Consultancy Services',                              5),
    ('Global export - simple',                            4),
    ('Global export - complex',                           8),
    ('Service cloud surveys- simple',                     5),
    ('Service cloud surveys - complex',                  10),
    ('Service cloud surveys amendment - simple',          3),
    ('Service cloud surveys amendment - complex',         6),
    ('Annex activities',                                  4),
    ('Annex Campaign',                                    6),
    ('Data Export via S3 bucket - simple',                4),
    ('Data export via S3 bucket - Medium',                8),
    ('Data export via S3 bucket - complex',              12),
    ('Gmail Annotation Simple',                           4),
    ('Gmail Annotation Medium',                           8),
    ('Gmail Annotation Complex',                         12),
    ('Rendering fixes - simple',                          3),
    ('Rendering email for HTML  Complexity',              6),
    ('Major Change in Emails',                            5),
    ('Dynamic Email',                                    10),
    ('Audience requirement changes -Simple',              3),
    ('Audience requirement changes -Medium',              6),
    ('Audience requirement changes -Complex',            10),
    ('Content test',                                      4),
    ('Last minute changes',                               3),
    ('Campaign managers effort',                          5),
    ('S3 bucket adjustment- simple',                      3),
    ('S3 bucket adjustment Complex',                      6),
    ('Investigation and analyses simple',                 4),
    ('Investigation and analyses Medium',                 8),
    ('Investigation and analyses Complex',               12),
    ('Monitoring script - simple',                        4),
    ('Monitoring script- complex',                        8),
    ('AMP Emails',                                       10),
    ('Email Language switcher',                           6),
    ('Simple Journey Performance Report',                 4),
    ('Simple Journey Performance Report (once Bitly data enabled for SFMC)', 5),
    ('Advanced Journey Performance Report',               8),
    ('Visual Journey Performance Report',                10),
    ('Bulk Simple Journeys Performance Report',           6),
    ('Bulk Simple Journeys Performance Report (once Bitly data enabled for SFMC)', 7),
    ('Bulk Advanced Journeys Performance Report',        10),
    ('Regional Email Journey Performance Report',         8),
    ('Regional Email + SMS + Viber Journey Performance Report', 12),
    ('Regional Email + SMS  + Viber Journey Performance Report  (once Bitly data enabled for SFMC)', 14),
    ('Viber Communication Report',                        6),
    ('Bulk Viber Communication Report',                   8),
    ('Conversion Report',                                 6),
    ('Data Analytic Support',                             5),
    ('Landing Page Amendment',                            4),
    ('QR code creation (rate per 5 codes)',               3),
    ('Dynamic emails- additional',                        5),
    ('SMS Clicks Tracking',                               4),
    ('Non-GSM script – Initial market configuration',     6),
    ('Non-GSM script - Up to 5 SMSs',                     4),
    ('Technical Support',                                 5),
    ('Data Issues Monitoring & Effort',                   6),
    ('Insight Support - Simple',                          4),
    ('Insight Support - Medium',                          8),
    ('Insight Support - Complex',                        12),
    ('LOM Monthly Effort',                                8),
    ('Master Template Localization Drag&Drop',            6),
    ('New Content Block Drag&Drop',                       5),
    ('Content Block Update/ Migration',                   4),
    ('Push Notification',                                 4),
    ('Templatized Email Small',                           3),
    ('Templatized Email Medium',                          5),
    ('Templatized Email Large',                           8),
    ('MMS',                                               5),
    ('Minor Changes in Emails',                           1),
    ('Changes in SMS',                                    1),
    ('Changes in Messaging App',                          2),
    ('Navy Seals Support',                                8);
`);

// ── Prepared statements ─────────────────────────────────────────────────────
const getState     = db.prepare('SELECT * FROM state WHERE id = 1');
const getHistory   = db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 200');
const getTaskTypes = db.prepare('SELECT * FROM task_types ORDER BY name ASC');

const addTx = db.transaction((amount, note, newBalance, newAdded) => {
  db.prepare('UPDATE state SET balance = ?, added = ? WHERE id = 1').run(newBalance, newAdded);
  db.prepare("INSERT INTO history (type, amount, note, balance) VALUES ('add', ?, ?, ?)").run(amount, note, newBalance);
});

const spendTx = db.transaction((amount, note, newBalance, newSpent) => {
  db.prepare('UPDATE state SET balance = ?, spent = ? WHERE id = 1').run(newBalance, newSpent);
  db.prepare("INSERT INTO history (type, amount, note, balance) VALUES ('spend', ?, ?, ?)").run(amount, note, newBalance);
});

const resetTx = db.transaction((note) => {
  db.prepare('UPDATE state SET balance = 0, added = 0, spent = 0 WHERE id = 1').run();
  db.prepare("INSERT INTO history (type, amount, note, balance) VALUES ('reset', 0, ?, 0)").run(note);
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── API — state / history ────────────────────────────────────────────────────
app.get('/api/state', (_req, res) => {
  res.json({ state: getState.get(), history: getHistory.all() });
});

app.post('/api/add', (req, res) => {
  const { amount, note = '' } = req.body;
  if (!Number.isInteger(amount) || amount <= 0)
    return res.status(400).json({ error: 'amount must be a positive integer' });
  const s = getState.get();
  addTx(amount, note, s.balance + amount, s.added + amount);
  res.json(getState.get());
});

app.post('/api/spend', (req, res) => {
  const { amount, note = '' } = req.body;
  if (!Number.isInteger(amount) || amount <= 0)
    return res.status(400).json({ error: 'amount must be a positive integer' });
  const s = getState.get();
  if (amount > s.balance)
    return res.status(400).json({ error: 'Insufficient balance' });
  spendTx(amount, note, s.balance - amount, s.spent + amount);
  res.json(getState.get());
});

app.post('/api/reset', (req, res) => {
  const { note = 'Manual reset' } = req.body;
  resetTx(note);
  res.json(getState.get());
});

app.post('/api/budget', (req, res) => {
  const { budget } = req.body;
  if (!Number.isInteger(budget) || budget <= 0)
    return res.status(400).json({ error: 'budget must be a positive integer' });
  db.prepare('UPDATE state SET budget = ? WHERE id = 1').run(budget);
  res.json(getState.get());
});

app.delete('/api/history', (_req, res) => {
  db.prepare('DELETE FROM history').run();
  res.json({ ok: true });
});

// ── API — task types ─────────────────────────────────────────────────────────
app.get('/api/task-types', (_req, res) => {
  res.json(getTaskTypes.all());
});

app.post('/api/task-types', (req, res) => {
  const { name, tokens } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0)
    return res.status(400).json({ error: 'name is required' });
  if (typeof tokens !== 'number' || tokens <= 0)
    return res.status(400).json({ error: 'tokens must be a positive number' });
  try {
    db.prepare('INSERT INTO task_types (name, tokens) VALUES (?, ?)').run(name.trim(), tokens);
    res.json(getTaskTypes.all());
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: `"${name.trim()}" already exists` });
    throw e;
  }
});

app.put('/api/task-types/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { tokens } = req.body;
  if (typeof tokens !== 'number' || tokens <= 0)
    return res.status(400).json({ error: 'tokens must be a positive number' });
  const r = db.prepare('UPDATE task_types SET tokens = ? WHERE id = ?').run(tokens, id);
  if (r.changes === 0) return res.status(404).json({ error: 'Task type not found' });
  res.json(getTaskTypes.all());
});

app.delete('/api/task-types/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM task_types WHERE id = ?').run(id);
  res.json(getTaskTypes.all());
});

// ── API — calculate (wide format) ────────────────────────────────────────────
// Input: { rows: [ { "Ticket ID": "...", "New journey- simple": "2", ... } ] }
// META columns (not task types) — all others are treated as task-type columns
const META_COLS = new Set([
  'ticket id', 'project url', 'business line', 'rrp product',
  'ticket description', 'market', 'status',
  'total no. of tokens', 'weekend hours?',
  'delivered on time', 'post-live issue',
  'number of minor changes in single email',
  'number of minor changes in multiple emails',
  'number of simple changes in sms',
  'number of advanced changes in sms',
  'number of simple change in messaging app',
  'number of advanced change in messaging app'
]);

app.post('/api/calculate', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'rows array is required' });

  // Build token-cost lookup: lowercase column name → cost per unit
  const costMap = {};
  getTaskTypes.all().forEach(t => { costMap[t.name.trim().toLowerCase()] = t.tokens; });

  const results = rows.map((row, rowIdx) => {
    // metadata
    const ticketId   = row['Ticket ID']          || row['ticket id']          || `Row ${rowIdx + 1}`;
    const description= row['Ticket Description'] || row['ticket description'] || '';
    const market     = row['Market']             || row['market']             || '';
    const status     = row['Status']             || row['status']             || '';
    const fileClaimed= parseFloat(row['Total No. of Tokens'] || row['total no. of tokens'] || 0) || 0;

    let computed = 0;
    const taskBreakdown = [];

    Object.entries(row).forEach(([col, rawVal]) => {
      const colKey = col.trim().toLowerCase();
      if (META_COLS.has(colKey)) return;          // skip meta columns
      const qty = parseFloat(rawVal);
      if (!qty || qty <= 0) return;               // skip zero / empty
      const costPerUnit = costMap[colKey];
      const tokens = costPerUnit !== undefined ? qty * costPerUnit : 0;
      computed += tokens;
      taskBreakdown.push({
        column:       col.trim(),
        qty,
        costPerUnit:  costPerUnit !== undefined ? costPerUnit : null,
        tokens,
        known:        costPerUnit !== undefined
      });
    });

    computed = Math.round(computed * 100) / 100;
    return { ticketId, description, market, status, fileClaimed, computed, taskBreakdown };
  });

  const grandTotal      = Math.round(results.reduce((s, r) => s + r.computed, 0) * 100) / 100;
  const fileClaimedTotal= Math.round(results.reduce((s, r) => s + r.fileClaimed, 0) * 100) / 100;

  res.json({ grandTotal, fileClaimedTotal, results });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`Token Budget Tracker running at http://${HOST}:${PORT}`);
});
