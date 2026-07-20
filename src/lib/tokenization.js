const crypto = require("crypto");
const store = require("../db");
const config = require("../config");
const { createDemoWalletAddress, createMintOnTestnet, isRealSolanaEnabled, isValidSolanaAddress, mintTokensOnTestnet } = require("./solana");

function fakeSolanaAddress(prefix) {
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`.slice(0, 44);
}

function fakeSignature() {
  return crypto.randomBytes(44).toString("base64url").slice(0, 88);
}

async function ensureProjectMint(project) {
  const existing = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  const realMode = isRealSolanaEnabled();
  if (existing) {
    const canUpgradeDemoMint = realMode && (!isValidSolanaAddress(existing.mint_address) || existing.status === "configured_demo" || !String(existing.network || "").includes(config.solanaCluster));
    if (!canUpgradeDemoMint) return existing;

    const now = new Date().toISOString();
    const chainMint = await createMintOnTestnet(project);
    store.run(`
      UPDATE token_mints
      SET network = ?, mint_address = ?, treasury_wallet = ?, authority_wallet = ?, multisig_wallet = ?,
          token_standard = ?, decimals = ?, transfer_rules = ?, status = ?
      WHERE id = ?
    `, [
      `solana-${config.solanaCluster}`,
      chainMint.mintAddress,
      chainMint.treasuryWallet,
      chainMint.authorityWallet,
      chainMint.authorityWallet,
      "SPL Token",
      config.solanaTokenDecimals,
      "KYC whitelist, transfer hook, lockup, admin freeze authority",
      "onchain_devnet",
      existing.id
    ]);
    const upgraded = store.get("SELECT * FROM token_mints WHERE id = ?", [existing.id]);
    store.run("INSERT INTO token_events (project_id, event_type, signature, authority, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      project.id,
      "mint_upgraded_to_devnet",
      chainMint.metadataSignature || "created-by-solana-devnet",
      upgraded.multisig_wallet,
      `Mint demo reemplazado por SPL real ${project.token_symbol} en ${upgraded.network}. Metadata: ${chainMint.metadataAddress || "pendiente"}.`,
      now
    ]);
    return upgraded;
  }

  const now = new Date().toISOString();
  const chainMint = realMode ? await createMintOnTestnet(project) : null;
  store.run(`
    INSERT INTO token_mints
    (project_id, network, mint_address, treasury_wallet, authority_wallet, multisig_wallet, token_standard, decimals, transfer_rules, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    project.id,
    realMode ? `solana-${config.solanaCluster}` : "solana-testnet-demo",
    chainMint ? chainMint.mintAddress : fakeSolanaAddress("Mint"),
    chainMint ? chainMint.treasuryWallet : fakeSolanaAddress("Treasury"),
    chainMint ? chainMint.authorityWallet : fakeSolanaAddress("Authority"),
    chainMint ? chainMint.authorityWallet : fakeSolanaAddress("Squads"),
    realMode ? "SPL Token" : "Token Extensions demo",
    config.solanaTokenDecimals,
    "KYC whitelist, transfer hook, lockup, admin freeze authority",
    realMode ? "onchain_devnet" : "configured_demo",
    now
  ]);

  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  store.run("INSERT INTO token_events (project_id, event_type, signature, authority, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    project.id,
    "mint_configured",
    realMode ? (chainMint.metadataSignature || "created-by-solana-devnet") : fakeSignature(),
    mint.multisig_wallet,
    `Mint ${project.token_symbol} configurado en ${mint.network}${chainMint && chainMint.metadataAddress ? ` con metadata ${chainMint.metadataAddress}` : ""}.`,
    now
  ]);
  return mint;
}

async function ensureWalletForUser(user) {
  const existing = store.get("SELECT * FROM wallets WHERE owner_type = 'user' AND owner_id = ?", [user.id]);
  if (existing) return existing;
  const address = user.wallet || createDemoWalletAddress() || fakeSolanaAddress("User");
  store.run("INSERT INTO wallets (owner_type, owner_id, label, address, network, wallet_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    "user",
    user.id,
    `${user.name} Solana wallet`,
    address,
    isRealSolanaEnabled() ? `solana-${config.solanaCluster}` : "solana-testnet-demo",
    "external",
    user.kyc_status === "approved" ? "whitelisted" : "review",
    new Date().toISOString()
  ]);
  return store.get("SELECT * FROM wallets WHERE owner_type = 'user' AND owner_id = ?", [user.id]);
}

async function issueTokensForInvestment(investmentId) {
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
  const mint = await ensureProjectMint(project);
  const wallet = await ensureWalletForUser({
    id: investment.user_id,
    name: investment.name,
    wallet: investment.wallet,
    kyc_status: investment.kyc_status
  });
  const now = new Date().toISOString();
  const chainIssue = isRealSolanaEnabled()
    ? await mintTokensOnTestnet({ mintAddress: mint.mint_address, recipientAddress: wallet.address, amount: investment.tokens })
    : null;
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
    chainIssue ? chainIssue.signature : fakeSignature(),
    mint.multisig_wallet,
    `${investment.tokens} ${investment.token_symbol} emitidos a ${wallet.address}${chainIssue ? ` en token account ${chainIssue.tokenAccount}` : ""}.`,
    now
  ]);
  return { investment, mint, wallet };
}

module.exports = { ensureProjectMint, ensureWalletForUser, issueTokensForInvestment };
