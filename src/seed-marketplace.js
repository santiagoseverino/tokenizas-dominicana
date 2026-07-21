const store = require("./db");

function ensureUser({ name, email, wallet }) {
  let user = store.get("SELECT * FROM users WHERE email = ?", [email]);
  if (user) return user;
  const now = new Date().toISOString();
  store.run(`
    INSERT INTO users (name, email, role, country, kyc_status, wallet, email_verified, phone_verified, identity_verified, identity_check_status, created_at)
    VALUES (?, ?, 'investor', 'Dominican Republic', 'approved', ?, 1, 1, 1, 'approved', ?)
  `, [name, email, wallet, now]);
  return store.get("SELECT * FROM users WHERE email = ?", [email]);
}

function ensureCacaoProject() {
  return store.get("SELECT * FROM projects WHERE slug = 'finca-cacao-bayaguana'")
    || store.get("SELECT * FROM projects WHERE token_symbol = 'CACAO'");
}

function ensureBalance({ project, user, balance }) {
  const existing = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [project.id, user.id]);
  const now = new Date().toISOString();
  if (existing) {
    if (Number(existing.balance) < balance) {
      store.run("UPDATE token_balances SET balance = ?, locked_balance = ?, wallet_address = ?, updated_at = ? WHERE id = ?", [balance, balance, user.wallet, now, existing.id]);
    }
    return store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [project.id, user.id]);
  }
  store.run(`
    INSERT INTO token_balances (project_id, user_id, wallet_address, token_symbol, balance, locked_balance, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [project.id, user.id, user.wallet, project.token_symbol, balance, balance, now]);
  return store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [project.id, user.id]);
}

function ensureActiveListing({ project, seller }) {
  const existing = store.get(`
    SELECT * FROM marketplace_listings
    WHERE project_id = ? AND seller_user_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `, [project.id, seller.id]);
  if (existing) return existing;
  store.run(`
    INSERT INTO marketplace_listings (project_id, seller_user_id, token_symbol, quantity, price_per_token, status, created_at)
    VALUES (?, ?, ?, 0.1, 25, 'active', ?)
  `, [project.id, seller.id, project.token_symbol, new Date().toISOString()]);
  return store.get("SELECT * FROM marketplace_listings WHERE project_id = ? AND seller_user_id = ? ORDER BY id DESC LIMIT 1", [project.id, seller.id]);
}

function ensurePendingTrade({ project, listing, seller, buyer, mintAddress }) {
  const existing = store.get(`
    SELECT * FROM marketplace_trades
    WHERE project_id = ? AND seller_user_id = ? AND buyer_user_id = ? AND status = 'pending_onchain_transfer'
    ORDER BY id DESC LIMIT 1
  `, [project.id, seller.id, buyer.id]);
  if (existing) return existing;
  store.run(`
    INSERT INTO marketplace_trades (listing_id, project_id, seller_user_id, buyer_user_id, token_symbol, quantity, price_per_token, total_amount, status, seller_wallet, buyer_wallet, mint_address, created_at)
    VALUES (?, ?, ?, ?, ?, 0.05, 28, 1.4, 'pending_onchain_transfer', ?, ?, ?, ?)
  `, [
    listing.id,
    project.id,
    seller.id,
    buyer.id,
    project.token_symbol,
    seller.wallet,
    buyer.wallet,
    mintAddress || "",
    new Date().toISOString()
  ]);
  return store.get("SELECT * FROM marketplace_trades WHERE project_id = ? AND seller_user_id = ? AND buyer_user_id = ? ORDER BY id DESC LIMIT 1", [project.id, seller.id, buyer.id]);
}

(async () => {
  await store.initDb();
  const project = ensureCacaoProject();
  if (!project) throw new Error("No existe el proyecto Finca de Cacao Bayaguana. Ejecuta primero: npm run seed:cacao");
  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  const seller = ensureUser({
    name: "Demo CACAO Seller",
    email: "seller.cacao.demo@tokenizas.local",
    wallet: "8mWiHHKzvqPHErguBMmtaWgvKZd87dkiHK4zVcU88E6n"
  });
  const buyer = ensureUser({
    name: "Demo CACAO Buyer",
    email: "buyer.cacao.demo@tokenizas.local",
    wallet: "CZCwju3MgH443aAzdTGjLnhSf9w2EPWg6h4rSBQH7Gs9"
  });
  ensureBalance({ project, user: seller, balance: 1 });
  const activeListing = ensureActiveListing({ project, seller });
  const pendingTrade = ensurePendingTrade({ project, listing: activeListing, seller, buyer, mintAddress: mint && mint.mint_address });
  store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Seeder', 'seed_marketplace', 'CACAO', 'Listados y compras demo de marketplace creados', ?)", [new Date().toISOString()]);
  store.saveDb();
  console.log("Marketplace demo listo:");
  console.log(`- Proyecto: ${project.title}`);
  console.log(`- Listado activo #${activeListing.id}: 0.1 ${project.token_symbol} a $25/token`);
  console.log(`- Trade pendiente #${pendingTrade.id}: 0.05 ${project.token_symbol} a $28/token`);
})();
