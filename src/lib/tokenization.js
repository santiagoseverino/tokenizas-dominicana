const crypto = require("crypto");
const store = require("../db");

function fakeSolanaAddress(prefix) {
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`.slice(0, 44);
}

function fakeSignature() {
  return crypto.randomBytes(44).toString("base64url").slice(0, 88);
}

function ensureProjectMint(project) {
  const existing = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  if (existing) return existing;

  const now = new Date().toISOString();
  store.run(`
    INSERT INTO token_mints
    (project_id, network, mint_address, treasury_wallet, authority_wallet, multisig_wallet, token_standard, decimals, transfer_rules, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    project.id,
    "solana-devnet",
    fakeSolanaAddress("Mint"),
    fakeSolanaAddress("Treasury"),
    fakeSolanaAddress("Authority"),
    fakeSolanaAddress("Squads"),
    "Token Extensions",
    0,
    "KYC whitelist, transfer hook, lockup, admin freeze authority",
    "configured",
    now
  ]);

  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  store.run("INSERT INTO token_events (project_id, event_type, signature, authority, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    project.id,
    "mint_configured",
    fakeSignature(),
    mint.multisig_wallet,
    `Mint ${project.token_symbol} configurado en ${mint.network}.`,
    now
  ]);
  return mint;
}

function ensureWalletForUser(user) {
  const existing = store.get("SELECT * FROM wallets WHERE owner_type = 'user' AND owner_id = ?", [user.id]);
  if (existing) return existing;
  const address = user.wallet || fakeSolanaAddress("User");
  store.run("INSERT INTO wallets (owner_type, owner_id, label, address, network, wallet_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    "user",
    user.id,
    `${user.name} Solana wallet`,
    address,
    "solana-devnet",
    "external",
    user.kyc_status === "approved" ? "whitelisted" : "review",
    new Date().toISOString()
  ]);
  return store.get("SELECT * FROM wallets WHERE owner_type = 'user' AND owner_id = ?", [user.id]);
}

function issueTokensForInvestment(investmentId) {
  const investment = store.get(`
    SELECT i.*, u.name, u.email, u.kyc_status, u.wallet, p.token_symbol, p.title, p.id project_id
    FROM investments i
    JOIN users u ON u.id = i.user_id
    JOIN projects p ON p.id = i.project_id
    WHERE i.id = ?
  `, [investmentId]);
  if (!investment) throw new Error("Investment not found");
  if (investment.kyc_status !== "approved") throw new Error("Investor KYC is not approved");
  if (investment.status === "tokens_issued") throw new Error("Tokens were already issued for this order");

  const project = store.get("SELECT * FROM projects WHERE id = ?", [investment.project_id]);
  const mint = ensureProjectMint(project);
  const wallet = ensureWalletForUser({
    id: investment.user_id,
    name: investment.name,
    wallet: investment.wallet,
    kyc_status: investment.kyc_status
  });
  const now = new Date().toISOString();
  const current = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [investment.project_id, investment.user_id]);
  if (current) {
    store.run("UPDATE token_balances SET balance = balance + ?, locked_balance = locked_balance + ?, updated_at = ? WHERE id = ?", [investment.tokens, investment.tokens, now, current.id]);
  } else {
    store.run("INSERT INTO token_balances (project_id, user_id, wallet_address, token_symbol, balance, locked_balance, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      investment.project_id,
      investment.user_id,
      wallet.address,
      investment.token_symbol,
      investment.tokens,
      investment.tokens,
      now
    ]);
  }
  store.run("UPDATE investments SET status = 'tokens_issued' WHERE id = ?", [investment.id]);
  store.run("INSERT INTO token_events (project_id, event_type, signature, authority, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    investment.project_id,
    "tokens_issued",
    fakeSignature(),
    mint.multisig_wallet,
    `${investment.tokens} ${investment.token_symbol} emitidos a ${wallet.address}.`,
    now
  ]);
  return { investment, mint, wallet };
}

module.exports = { ensureProjectMint, ensureWalletForUser, issueTokensForInvestment };
