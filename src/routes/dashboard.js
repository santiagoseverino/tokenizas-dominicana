const store = require("../db");
const { currentInvestor } = require("../middleware/auth");
const { layout, money, number, statusLabel } = require("../lib/ui");

function registerDashboardRoutes(app) {
  app.get("/dashboard", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const investments = store.all(`
      SELECT i.*, p.title, p.token_symbol, p.image_url, p.location
      FROM investments i JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `, [user.id]);
    const balances = store.all(`
      SELECT tb.*, p.title project_title, tm.mint_address, tm.network
      FROM token_balances tb
      JOIN projects p ON p.id = tb.project_id
      LEFT JOIN token_mints tm ON tm.project_id = tb.project_id
      WHERE tb.user_id = ?
      ORDER BY tb.updated_at DESC
    `, [user.id]);
    const balanceProjectIds = new Set(balances.map((balance) => Number(balance.project_id)));
    const reservedTokens = investments.filter((item) => item.status !== "tokens_issued" || !balanceProjectIds.has(Number(item.project_id)));
    const total = investments.reduce((sum, item) => sum + item.amount, 0);
    const createdId = Number(req.query.created || 0);
    res.send(layout("Dashboard", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">Inversionista</p><h1>${user.name}</h1><p class="muted">KYC: ${statusLabel(user.kyc_status)} - Wallet: ${user.wallet}</p></div>
        ${createdId ? `<div class="success">Orden creada correctamente. Ya aparece abajo como pago pendiente.</div>` : ""}
        <section class="metrics compact">
          <article><strong>${money.format(total)}</strong><span>Invertido/reservado</span></article>
          <article><strong>${number.format(investments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
          <article><strong>${investments.length}</strong><span>Ordenes</span></article>
        </section>
        <section class="split">
          <div class="panel">
            <h3>Ordenes</h3>
            <div class="portfolio">${investments.map((item) => `<article class="holding ${createdId === item.id ? "highlight" : ""}"><img src="${item.image_url}" alt="${item.title}" /><div><h3>${item.title}</h3><p>${item.location}</p></div><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${money.format(item.amount)}</span><em>${statusLabel(item.status)}</em></article>`).join("")}</div>
          </div>
          <div class="panel">
            <h3>Wallet y tokens</h3>
            ${balances.map((balance) => `<div class="event"><b>${balance.balance} ${balance.token_symbol}</b><span>${balance.project_title}</span><p>Emitidos / bloqueados: ${balance.locked_balance}</p><span>Mint: ${balance.mint_address || "pendiente"}</span><span>Wallet: ${balance.wallet_address}</span></div>`).join("")}
            ${reservedTokens.map((item) => `<div class="event ${createdId === item.id ? "highlightBox" : ""}"><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${item.title}</span><p>${statusLabel(item.status)} - tokens reservados, pendientes de emision</p><span>Monto: ${money.format(item.amount)}</span><span>Wallet: pendiente hasta emision</span></div>`).join("")}
            ${!balances.length && !reservedTokens.length ? "<p class=\"muted\">Sin tokens ni reservas todavia.</p>" : ""}
          </div>
        </section>
      </main>
    `, req));
  });
}

module.exports = registerDashboardRoutes;
