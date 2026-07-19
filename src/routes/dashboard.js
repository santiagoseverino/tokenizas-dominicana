const store = require("../db");
const { layout, money, number, statusLabel } = require("../lib/ui");

function registerDashboardRoutes(app) {
  app.get("/dashboard", (req, res) => {
    const user = store.get("SELECT * FROM users WHERE id = 1");
    const investments = store.all(`
      SELECT i.*, p.title, p.token_symbol, p.image_url, p.location
      FROM investments i JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `, [user.id]);
    const total = investments.reduce((sum, item) => sum + item.amount, 0);
    res.send(layout("Dashboard", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">Inversionista</p><h1>${user.name}</h1><p class="muted">KYC: ${statusLabel(user.kyc_status)} - Wallet: ${user.wallet}</p></div>
        <section class="metrics compact">
          <article><strong>${money.format(total)}</strong><span>Invertido/reservado</span></article>
          <article><strong>${number.format(investments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
          <article><strong>${investments.length}</strong><span>Ordenes</span></article>
        </section>
        <div class="portfolio">${investments.map((item) => `<article class="holding"><img src="${item.image_url}" alt="${item.title}" /><div><h3>${item.title}</h3><p>${item.location}</p></div><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${money.format(item.amount)}</span><em>${statusLabel(item.status)}</em></article>`).join("")}</div>
      </main>
    `, req));
  });
}

module.exports = registerDashboardRoutes;
