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
      phone TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      identity_verified INTEGER NOT NULL DEFAULT 0,
      identity_check_status TEXT NOT NULL DEFAULT 'pending',
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
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_expected_sol REAL,
      payment_signature TEXT,
      payment_received_at TEXT,
      issue_signature TEXT,
      issue_token_account TEXT,
      issue_mint_address TEXT,
      issued_at TEXT,
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

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      seller_user_id INTEGER NOT NULL,
      token_symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      price_per_token REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      canceled_at TEXT,
      sold_at TEXT
    );

    CREATE TABLE IF NOT EXISTS marketplace_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      seller_user_id INTEGER NOT NULL,
      buyer_user_id INTEGER NOT NULL,
      token_symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      price_per_token REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'settled_internal',
      transfer_signature TEXT,
      transfer_verified_at TEXT,
      seller_wallet TEXT,
      buyer_wallet TEXT,
      mint_address TEXT,
      created_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issuer_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      whatsapp TEXT,
      country TEXT NOT NULL,
      project_name TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      legal_owner TEXT NOT NULL,
      target_raise INTEGER NOT NULL,
      total_budget INTEGER NOT NULL,
      budget_breakdown TEXT NOT NULL,
      legal_structure TEXT NOT NULL,
      permits_summary TEXT NOT NULL,
      project_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      internal_notes TEXT,
      project_id INTEGER,
      status_token TEXT,
      owner_notified_at TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS issuer_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      notes TEXT,
      uploaded_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS issuer_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recorded',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      item_key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      visible_to_owner INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, item_key)
    );
  `);

  const leadColumns = all("PRAGMA table_info(leads)").map((column) => column.name);
  const projectColumns = all("PRAGMA table_info(projects)").map((column) => column.name);
  const userColumns = all("PRAGMA table_info(users)").map((column) => column.name);
  const investmentColumns = all("PRAGMA table_info(investments)").map((column) => column.name);
  const tradeColumns = all("PRAGMA table_info(marketplace_trades)").map((column) => column.name);
  const issuerColumns = all("PRAGMA table_info(issuer_applications)").map((column) => column.name);
  if (!userColumns.includes("password_hash")) {
    db.run("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
  if (!userColumns.includes("phone")) {
    db.run("ALTER TABLE users ADD COLUMN phone TEXT");
  }
  if (!userColumns.includes("email_verified")) {
    db.run("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes("phone_verified")) {
    db.run("ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes("identity_verified")) {
    db.run("ALTER TABLE users ADD COLUMN identity_verified INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes("identity_check_status")) {
    db.run("ALTER TABLE users ADD COLUMN identity_check_status TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!investmentColumns.includes("investor_note")) {
    db.run("ALTER TABLE investments ADD COLUMN investor_note TEXT");
  }
  if (!investmentColumns.includes("payment_status")) {
    db.run("ALTER TABLE investments ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!investmentColumns.includes("payment_expected_sol")) {
    db.run("ALTER TABLE investments ADD COLUMN payment_expected_sol REAL");
  }
  if (!investmentColumns.includes("payment_signature")) {
    db.run("ALTER TABLE investments ADD COLUMN payment_signature TEXT");
  }
  if (!investmentColumns.includes("payment_received_at")) {
    db.run("ALTER TABLE investments ADD COLUMN payment_received_at TEXT");
  }
  if (!investmentColumns.includes("issue_signature")) {
    db.run("ALTER TABLE investments ADD COLUMN issue_signature TEXT");
  }
  if (!investmentColumns.includes("issue_token_account")) {
    db.run("ALTER TABLE investments ADD COLUMN issue_token_account TEXT");
  }
  if (!investmentColumns.includes("issue_mint_address")) {
    db.run("ALTER TABLE investments ADD COLUMN issue_mint_address TEXT");
  }
  if (!investmentColumns.includes("issued_at")) {
    db.run("ALTER TABLE investments ADD COLUMN issued_at TEXT");
  }
  if (!tradeColumns.includes("transfer_signature")) {
    db.run("ALTER TABLE marketplace_trades ADD COLUMN transfer_signature TEXT");
  }
  if (!tradeColumns.includes("transfer_verified_at")) {
    db.run("ALTER TABLE marketplace_trades ADD COLUMN transfer_verified_at TEXT");
  }
  if (!tradeColumns.includes("seller_wallet")) {
    db.run("ALTER TABLE marketplace_trades ADD COLUMN seller_wallet TEXT");
  }
  if (!tradeColumns.includes("buyer_wallet")) {
    db.run("ALTER TABLE marketplace_trades ADD COLUMN buyer_wallet TEXT");
  }
  if (!tradeColumns.includes("mint_address")) {
    db.run("ALTER TABLE marketplace_trades ADD COLUMN mint_address TEXT");
  }
  if (!issuerColumns.includes("project_id")) {
    db.run("ALTER TABLE issuer_applications ADD COLUMN project_id INTEGER");
  }
  if (!issuerColumns.includes("status_token")) {
    db.run("ALTER TABLE issuer_applications ADD COLUMN status_token TEXT");
  }
  if (!issuerColumns.includes("owner_notified_at")) {
    db.run("ALTER TABLE issuer_applications ADD COLUMN owner_notified_at TEXT");
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
