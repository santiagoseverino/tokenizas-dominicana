const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = path.join(__dirname, "..", "data", "tokenizas.sqlite");
let SQL;
let db;

async function initDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  migrate();
  return db;
}

function saveDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function migrate() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      country TEXT NOT NULL,
      kyc_status TEXT NOT NULL,
      wallet TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'real-estate',
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      legal_structure TEXT NOT NULL,
      target_raise INTEGER NOT NULL,
      min_investment INTEGER NOT NULL,
      token_symbol TEXT NOT NULL,
      token_supply INTEGER NOT NULL,
      token_price REAL NOT NULL,
      expected_yield REAL NOT NULL,
      status TEXT NOT NULL,
      image_url TEXT NOT NULL,
      description TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offerings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      round_name TEXT NOT NULL,
      soft_cap INTEGER NOT NULL,
      hard_cap INTEGER NOT NULL,
      raised INTEGER NOT NULL,
      opens_at TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      lockup_months INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      tokens INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      signature TEXT NOT NULL,
      authority TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_mints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL UNIQUE,
      network TEXT NOT NULL,
      mint_address TEXT NOT NULL,
      treasury_wallet TEXT NOT NULL,
      authority_wallet TEXT NOT NULL,
      multisig_wallet TEXT NOT NULL,
      token_standard TEXT NOT NULL,
      decimals INTEGER NOT NULL,
      transfer_rules TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_type TEXT NOT NULL,
      owner_id INTEGER,
      label TEXT NOT NULL,
      address TEXT NOT NULL UNIQUE,
      network TEXT NOT NULL,
      wallet_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      balance INTEGER NOT NULL,
      locked_balance INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      paid_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT NOT NULL,
      whatsapp TEXT,
      interest TEXT NOT NULL,
      message TEXT,
      consent TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      internal_notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kyc_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      notes TEXT,
      uploaded_at TEXT NOT NULL,
      reviewed_at TEXT
    );
  `);

  const leadColumns = all("PRAGMA table_info(leads)").map((column) => column.name);
  const projectColumns = all("PRAGMA table_info(projects)").map((column) => column.name);
  const userColumns = all("PRAGMA table_info(users)").map((column) => column.name);
  const investmentColumns = all("PRAGMA table_info(investments)").map((column) => column.name);
  if (!userColumns.includes("password_hash")) {
    db.run("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
  if (!investmentColumns.includes("investor_note")) {
    db.run("ALTER TABLE investments ADD COLUMN investor_note TEXT");
  }
  if (!projectColumns.includes("category")) {
    db.run("ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT 'real-estate'");
    db.run("UPDATE projects SET category = 'agriculture' WHERE slug = 'finca-cacao-bayaguana'");
    db.run("UPDATE projects SET category = 'music' WHERE slug = 'lionel-the-star-entertainment'");
    db.run("UPDATE projects SET category = 'tourism' WHERE slug IN ('samana-eco-hotel', 'punta-cana-villas')");
    db.run("UPDATE projects SET category = 'art' WHERE lower(type) LIKE '%arte%' OR lower(title) LIKE '%arte%'");
  }
  if (!leadColumns.includes("status")) {
    db.run("ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new'");
  }
  if (!leadColumns.includes("internal_notes")) {
    db.run("ALTER TABLE leads ADD COLUMN internal_notes TEXT");
  }
  saveDb();
}

function getSetting(key, fallback = "") {
  const row = get("SELECT value FROM settings WHERE key = ?", [key]);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  run(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `, [key, value, new Date().toISOString()]);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0];
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDb();
}

function exec(sql) {
  db.run(sql);
  saveDb();
}

module.exports = { initDb, all, get, getSetting, run, setSetting, exec, saveDb };
