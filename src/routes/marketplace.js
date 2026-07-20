const store = require("../db");
const { currentInvestor } = require("../middleware/auth");
const { localizeProjects } = require("../lib/project-content");
const { layout, money, number, statusLabel } = require("../lib/ui");

function availableBalance(balance) {
  const listed = store.get(`
    SELECT COALESCE(SUM(quantity), 0) total
    FROM marketplace_listings
    WHERE seller_user_id = ? AND project_id = ? AND status = 'active'
  `, [balance.user_id, balance.project_id]);
  return Math.max(0, Number(balance.balance || 0) - Number(listed.total || 0));
}

function listings(req) {
  return localizeProjects(store.all(`
    SELECT ml.*, p.slug, p.title, p.location, p.image_url, u.name seller_name
    FROM marketplace_listings ml
    JOIN projects p ON p.id = ml.project_id
    JOIN users u ON u.id = ml.seller_user_id
    WHERE ml.status = 'active'
    ORDER BY ml.created_at DESC
  `).map((item) => ({ ...item, title: item.title })), req).map((item) => ({ ...item, project_title: item.title }));
}

function registerMarketplaceRoutes(app) {
  app.get("/marketplace", (req, res) => {
    const user = currentInvestor(req);
    const items = listings(req);
    res.send(layout("Marketplace", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">Marketplace secundario</p>
          <h1>Compra y venta de tokens de proyectos</h1>
          <p class="muted">Mercado interno para probar liquidez secundaria. Las compras mueven el balance dentro de Tokenizas; la transferencia SPL wallet-to-wallet queda como siguiente fase.</p>
          ${user ? `<p><a class="button small" href="/dashboard">Mi dashboard</a></p>` : `<p><a class="button primary small" href="/investor/login">Entrar para comprar</a></p>`}
        </div>
        <section class="grid cards">
          ${items.map((item) => {
            const total = Number(item.quantity) * Number(item.price_per_token);
            const ownListing = user && Number(user.id) === Number(item.seller_user_id);
            return `<article class="card">
              <img src="${item.image_url}" alt="${item.project_title}" />
              <div class="cardBody">
                <div class="pill">${item.token_symbol}</div>
                <h3>${item.project_title}</h3>
                <p>${item.location}</p>
                <div class="cardStats">
                  <span>${number.format(item.quantity)} tokens</span>
                  <span>${money.format(item.price_per_token)} / token</span>
                </div>
                <p class="muted">Vendedor: ${item.seller_name} - Total: ${money.format(total)}</p>
                ${user && !ownListing ? `<form method="post" action="/marketplace/listings/${item.id}/buy"><button class="button primary small" type="submit">Comprar listado</button></form>` : ""}
                ${ownListing ? `<form method="post" action="/marketplace/listings/${item.id}/cancel"><button class="button danger small" type="submit">Cancelar listado</button></form>` : ""}
                ${!user ? `<a class="button small" href="/investor/login">Entrar para comprar</a>` : ""}
              </div>
            </article>`;
          }).join("") || `<div class="panel"><p class="muted">Todavia no hay tokens listados en el marketplace.</p></div>`}
        </section>
      </main>
    `, req));
  });

  app.post("/marketplace/listings", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const balance = store.get("SELECT * FROM token_balances WHERE id = ? AND user_id = ?", [req.body.balance_id, user.id]);
    const quantity = Number(req.body.quantity || 0);
    const price = Number(req.body.price_per_token || 0);
    if (!balance || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0 || quantity > availableBalance(balance)) {
      return res.redirect("/dashboard?marketplace=invalid");
    }
    store.run(`
      INSERT INTO marketplace_listings (project_id, seller_user_id, token_symbol, quantity, price_per_token, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `, [balance.project_id, user.id, balance.token_symbol, quantity, price, new Date().toISOString()]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'marketplace_listed', ?, ?, ?)", [
      user.name,
      `project:${balance.project_id}`,
      `${quantity} ${balance.token_symbol} listados a ${money.format(price)} por token.`,
      new Date().toISOString()
    ]);
    res.redirect("/dashboard?marketplace=listed");
  });

  app.post("/marketplace/listings/:id/cancel", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    store.run("UPDATE marketplace_listings SET status = 'canceled', canceled_at = ? WHERE id = ? AND seller_user_id = ? AND status = 'active'", [
      new Date().toISOString(),
      req.params.id,
      user.id
    ]);
    res.redirect("/dashboard?marketplace=canceled");
  });

  app.post("/marketplace/listings/:id/buy", (req, res) => {
    const buyer = currentInvestor(req);
    if (!buyer) return res.redirect("/investor/login");
    const listing = store.get("SELECT * FROM marketplace_listings WHERE id = ? AND status = 'active'", [req.params.id]);
    if (!listing || Number(listing.seller_user_id) === Number(buyer.id)) return res.redirect("/marketplace");
    const sellerBalance = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [listing.project_id, listing.seller_user_id]);
    if (!sellerBalance || Number(sellerBalance.balance) < Number(listing.quantity)) return res.redirect("/marketplace?trade=unavailable");
    const buyerWallet = store.get("SELECT wallet FROM users WHERE id = ?", [buyer.id]);
    const now = new Date().toISOString();
    const total = Number(listing.quantity) * Number(listing.price_per_token);
    store.run("UPDATE token_balances SET balance = balance - ?, locked_balance = MAX(0, locked_balance - ?), updated_at = ? WHERE id = ?", [listing.quantity, listing.quantity, now, sellerBalance.id]);
    const existingBuyerBalance = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [listing.project_id, buyer.id]);
    if (existingBuyerBalance) {
      store.run("UPDATE token_balances SET balance = balance + ?, locked_balance = locked_balance + ?, updated_at = ? WHERE id = ?", [listing.quantity, listing.quantity, now, existingBuyerBalance.id]);
    } else {
      store.run("INSERT INTO token_balances (project_id, user_id, wallet_address, token_symbol, balance, locked_balance, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
        listing.project_id,
        buyer.id,
        buyerWallet.wallet || "wallet pendiente",
        listing.token_symbol,
        listing.quantity,
        listing.quantity,
        now
      ]);
    }
    store.run("UPDATE marketplace_listings SET status = 'sold', sold_at = ? WHERE id = ?", [now, listing.id]);
    store.run("INSERT INTO marketplace_trades (listing_id, project_id, seller_user_id, buyer_user_id, token_symbol, quantity, price_per_token, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'settled_internal', ?)", [
      listing.id,
      listing.project_id,
      listing.seller_user_id,
      buyer.id,
      listing.token_symbol,
      listing.quantity,
      listing.price_per_token,
      total,
      now
    ]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'marketplace_bought', ?, ?, ?)", [
      buyer.name,
      `listing:${listing.id}`,
      `${listing.quantity} ${listing.token_symbol} comprados por ${money.format(total)}.`,
      now
    ]);
    res.redirect("/dashboard?marketplace=bought");
  });
}

module.exports = registerMarketplaceRoutes;
