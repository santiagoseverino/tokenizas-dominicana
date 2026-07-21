const store = require("../db");
const { currentInvestor } = require("../middleware/auth");
const { localizeProjects } = require("../lib/project-content");
const { verifySplTokenTransfer } = require("../lib/solana");
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
    const buyableItems = items.filter((item) => !user || Number(user.id) !== Number(item.seller_user_id));
    const ownItems = user ? items.filter((item) => Number(user.id) === Number(item.seller_user_id)) : [];
    const renderListingCard = (item, { ownListing = false } = {}) => {
      const total = Number(item.quantity) * Number(item.price_per_token);
      return `<article class="card">
        <img src="${item.image_url}" alt="${item.project_title}" />
        <div class="cardBody">
          <div class="pill">${item.token_symbol}${String(item.seller_name || "").includes("Demo") ? " Demo" : ""}</div>
          <h3>${item.project_title}</h3>
          <p>${item.location}</p>
          <div class="cardStats">
            <span>${number.format(item.quantity)} tokens</span>
            <span>${money.format(item.price_per_token)} / token</span>
          </div>
          <p class="muted">Vendedor: ${item.seller_name} - Total: ${money.format(total)}</p>
          ${user && !ownListing ? `<form method="post" action="/marketplace/listings/${item.id}/buy"><button class="button primary small" type="submit">Comprar listado</button></form>` : ""}
          ${ownListing ? `<p class="muted">Este listado es tuyo. Para probar compra, entra con otro usuario inversionista.</p><form method="post" action="/marketplace/listings/${item.id}/cancel"><button class="button danger small" type="submit">Cancelar listado</button></form>` : ""}
          ${!user ? `<a class="button small" href="/investor/login">Entrar para comprar</a>` : ""}
        </div>
      </article>`;
    };
    res.send(layout("Marketplace", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">Marketplace secundario</p>
          <h1>Compra y venta de tokens de proyectos</h1>
          <p class="muted">Compra tokens listados por otros inversionistas. La venta queda pendiente hasta que el vendedor complete la transferencia SPL desde Phantom y Tokenizas la verifique en Solana devnet.</p>
          ${user ? `<p><a class="button small" href="/dashboard">Mi dashboard</a></p>` : `<p><a class="button primary small" href="/investor/login">Entrar para comprar</a><a class="button small" href="/investor/register">Crear cuenta</a></p>`}
        </div>
        ${req.query.trade === "unavailable" ? `<div class="alert">Ese listado ya no esta disponible o el vendedor no tiene balance suficiente.</div>` : ""}
        <section class="panel">
          <h3>Disponible para comprar</h3>
          <div class="grid cards">${buyableItems.map((item) => renderListingCard(item)).join("") || `<p class="muted">No hay listados disponibles para tu usuario. Si eres admin, entra a /admin/marketplace y pulsa Crear demo CACAO.</p>`}</div>
        </section>
        ${user ? `<section class="panel"><h3>Mis listados</h3><div class="grid cards">${ownItems.map((item) => renderListingCard(item, { ownListing: true })).join("") || `<p class="muted">No tienes listados activos. Puedes listar tokens desde tu dashboard, en Wallet y tokens.</p>`}</div></section>` : ""}
        <section class="panel">
          <h3>Como funciona la compra</h3>
          <div class="featureGrid">
            <article class="featureCard"><strong>1</strong><h3>Compra listado</h3><p>El comprador selecciona un listado disponible.</p></article>
            <article class="featureCard"><strong>2</strong><h3>Transferencia SPL</h3><p>El vendedor transfiere los tokens desde Phantom al comprador.</p></article>
            <article class="featureCard"><strong>3</strong><h3>Verificacion</h3><p>Tokenizas verifica mint, cantidad y wallet destino en Solana devnet.</p></article>
          </div>
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
    const sellerWallet = store.get("SELECT wallet FROM users WHERE id = ?", [listing.seller_user_id]);
    const mint = store.get("SELECT mint_address FROM token_mints WHERE project_id = ?", [listing.project_id]);
    const now = new Date().toISOString();
    const total = Number(listing.quantity) * Number(listing.price_per_token);
    store.run("UPDATE marketplace_listings SET status = 'pending_transfer', sold_at = ? WHERE id = ?", [now, listing.id]);
    store.run("INSERT INTO marketplace_trades (listing_id, project_id, seller_user_id, buyer_user_id, token_symbol, quantity, price_per_token, total_amount, status, seller_wallet, buyer_wallet, mint_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_onchain_transfer', ?, ?, ?, ?)", [
      listing.id,
      listing.project_id,
      listing.seller_user_id,
      buyer.id,
      listing.token_symbol,
      listing.quantity,
      listing.price_per_token,
      total,
      sellerWallet && sellerWallet.wallet ? sellerWallet.wallet : sellerBalance.wallet_address,
      buyerWallet && buyerWallet.wallet ? buyerWallet.wallet : "wallet pendiente",
      mint && mint.mint_address ? mint.mint_address : "",
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

  app.post("/marketplace/trades/:id/verify-transfer", async (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const trade = store.get("SELECT * FROM marketplace_trades WHERE id = ? AND seller_user_id = ? AND status = 'pending_onchain_transfer'", [req.params.id, user.id]);
    if (!trade) return res.redirect("/dashboard");
    const signature = String(req.body.signature || "").trim();
    try {
      await verifySplTokenTransfer({
        signature,
        mintAddress: trade.mint_address,
        destinationOwner: trade.buyer_wallet,
        amount: trade.quantity
      });
      const now = new Date().toISOString();
      const sellerBalance = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [trade.project_id, trade.seller_user_id]);
      if (sellerBalance) {
        store.run("UPDATE token_balances SET balance = MAX(0, balance - ?), locked_balance = MAX(0, locked_balance - ?), updated_at = ? WHERE id = ?", [trade.quantity, trade.quantity, now, sellerBalance.id]);
      }
      const buyerBalance = store.get("SELECT * FROM token_balances WHERE project_id = ? AND user_id = ?", [trade.project_id, trade.buyer_user_id]);
      if (buyerBalance) {
        store.run("UPDATE token_balances SET balance = balance + ?, locked_balance = locked_balance + ?, wallet_address = ?, updated_at = ? WHERE id = ?", [trade.quantity, trade.quantity, trade.buyer_wallet, now, buyerBalance.id]);
      } else {
        store.run("INSERT INTO token_balances (project_id, user_id, wallet_address, token_symbol, balance, locked_balance, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [trade.project_id, trade.buyer_user_id, trade.buyer_wallet, trade.token_symbol, trade.quantity, trade.quantity, now]);
      }
      store.run("UPDATE marketplace_trades SET status = 'settled_onchain', transfer_signature = ?, transfer_verified_at = ? WHERE id = ?", [signature, now, trade.id]);
      store.run("UPDATE marketplace_listings SET status = 'sold' WHERE id = ?", [trade.listing_id]);
      res.redirect("/dashboard?marketplace=transfer_verified");
    } catch (error) {
      store.run("UPDATE marketplace_trades SET transfer_signature = ? WHERE id = ?", [signature, trade.id]);
      res.redirect("/dashboard?marketplace=transfer_failed");
    }
  });
}

module.exports = registerMarketplaceRoutes;
