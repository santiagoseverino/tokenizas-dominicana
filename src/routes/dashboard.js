const store = require("../db");
const { currentInvestor } = require("../middleware/auth");
const { localizeProjects } = require("../lib/project-content");
const { getSolPaymentExpected, getTreasuryAddress, verifySolPayment } = require("../lib/solana");
const { tr } = require("../lib/i18n");
const { layout, money, number, statusLabel } = require("../lib/ui");

function solanaExplorerTx(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function looksLikeSolanaSignature(signature) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(signature || ""));
}

function explorerButton(signature, label) {
  return looksLikeSolanaSignature(signature)
    ? `<a class="button small" href="${solanaExplorerTx(signature)}" target="_blank" rel="noopener">${label}</a>`
    : "";
}

function renderPaymentBox(item, req) {
  if (item.status !== "pending_payment" && item.status !== "payment_failed") return "";
  const expectedSol = item.payment_expected_sol || getSolPaymentExpected(item.tokens);
  const treasury = getTreasuryAddress();
  return `<div class="paymentBox">
    <b>Pago Solana devnet</b>
    <span>Envia exactamente o mas de ${number.format(expectedSol)} SOL devnet a:</span>
    <span class="monoBreak">${treasury || "Treasury no configurada"}</span>
    <span>Referencia: orden #${item.id}</span>
    <form method="post" action="/investments/${item.id}/sol-payment">
      <label>Firma de transaccion<input name="signature" placeholder="Pega aqui la firma de Solana" value="${item.payment_signature || ""}" required /></label>
      <button class="button small primary" type="submit">Verificar pago on-chain</button>
    </form>
  </div>`;
}

function renderReceipt(item, events, req) {
  if (item.status === "canceled") return "";
  const d = tr(req).dashboardText;
  const issueEvent = events.find((event) => Number(event.project_id) === Number(item.project_id) && event.event_type === "tokens_issued" && String(event.note || "").includes(String(item.token_symbol)));
  const paymentDone = item.payment_status === "received" || item.payment_received_at;
  return `<article class="receiptItem">
    <div>
      <span class="statusBadge">Orden #${item.id}</span>
      <h4>${item.title}</h4>
      <p>${number.format(item.tokens)} ${item.token_symbol} - ${money.format(item.amount)} - ${statusLabel(item.status, req)}</p>
    </div>
    <div class="receiptSteps">
      <div class="receiptStep done"><b>${d.receiptOrderCreated}</b><span>${item.created_at}</span></div>
      <div class="receiptStep ${paymentDone ? "done" : ""}"><b>${d.receiptPayment}</b><span>${paymentDone ? `${number.format(item.payment_expected_sol || 0)} SOL` : d.pending}</span>${explorerButton(item.payment_signature, d.viewPaymentTx)}</div>
      <div class="receiptStep ${item.status === "tokens_issued" ? "done" : ""}"><b>${d.receiptIssued}</b><span>${issueEvent ? issueEvent.created_at : d.pending}</span>${issueEvent ? explorerButton(issueEvent.signature, d.viewIssueTx) : ""}</div>
    </div>
  </article>`;
}

function registerDashboardRoutes(app) {
  app.get("/dashboard", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const investments = localizeProjects(store.all(`
      SELECT i.*, p.title, p.token_symbol, p.image_url, p.location
      FROM investments i JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `, [user.id]), req);
    const balances = localizeProjects(store.all(`
      SELECT tb.*, p.slug, p.title project_title, tm.mint_address, tm.network
      FROM token_balances tb
      JOIN projects p ON p.id = tb.project_id
      LEFT JOIN token_mints tm ON tm.project_id = tb.project_id
      WHERE tb.user_id = ?
      ORDER BY tb.updated_at DESC
    `, [user.id]).map((balance) => ({ ...balance, slug: balance.slug, title: balance.project_title })), req).map((balance) => ({ ...balance, project_title: balance.title }));
    const events = store.all(`
      SELECT te.*
      FROM token_events te
      JOIN investments i ON i.project_id = te.project_id
      WHERE i.user_id = ?
      ORDER BY te.id DESC
    `, [user.id]);
    const balanceProjectIds = new Set(balances.map((balance) => Number(balance.project_id)));
    const reservedTokens = investments.filter((item) => item.status !== "canceled" && (item.status !== "tokens_issued" || !balanceProjectIds.has(Number(item.project_id))));
    const activeInvestments = investments.filter((item) => item.status !== "canceled");
    const total = activeInvestments.reduce((sum, item) => sum + item.amount, 0);
    const createdId = Number(req.query.created || 0);
    const t = tr(req);
    const d = t.dashboardText;
    res.send(layout("Dashboard", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">${d.investor}</p><h1>${user.name}</h1><p class="muted">KYC: ${statusLabel(user.kyc_status, req)} - ${t.wallet}: ${user.wallet}</p></div>
        ${createdId ? `<div class="success">${d.orderCreated}</div>` : ""}
        ${req.query.canceled ? `<div class="success">${d.orderCanceled}</div>` : ""}
        ${req.query.payment === "received" ? `<div class="success">Pago confirmado on-chain. La orden ya esta lista para emitir tokens.</div>` : ""}
        ${req.query.payment === "failed" ? `<div class="alert">No se pudo confirmar el pago. Revisa la firma y que el monto haya llegado a la treasury.</div>` : ""}
        <section class="metrics compact">
          <article><strong>${money.format(total)}</strong><span>${d.investedReserved}</span></article>
          <article><strong>${number.format(activeInvestments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
          <article><strong>${activeInvestments.length}</strong><span>${d.orders}</span></article>
        </section>
        <section class="split">
          <div class="panel">
            <h3>${d.orders}</h3>
            <div class="portfolio">${investments.map((item) => `<article class="holding ${createdId === item.id ? "highlight" : ""}"><img src="${item.image_url}" alt="${item.title}" /><div><h3>${item.title}</h3><p>${item.location}</p>${renderPaymentBox(item, req)}${item.status !== "tokens_issued" && item.status !== "canceled" ? `<form method="post" action="/investments/${item.id}/cancel"><button class="button danger small" type="submit">${d.cancelOrder}</button></form>` : ""}</div><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${money.format(item.amount)}</span><em>${statusLabel(item.status, req)}</em></article>`).join("")}</div>
          </div>
          <div class="panel">
            <h3>${d.walletTokens}</h3>
            ${balances.map((balance) => `<div class="event"><b>${balance.balance} ${balance.token_symbol}</b><span>${balance.project_title}</span><p>${d.issuedLocked}: ${balance.locked_balance}</p><span>Mint: ${balance.mint_address || d.pending}</span><span>${t.wallet}: ${balance.wallet_address}</span></div>`).join("")}
            ${reservedTokens.map((item) => `<div class="event ${createdId === item.id ? "highlightBox" : ""}"><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${item.title}</span><p>${statusLabel(item.status, req)} - ${d.reservedPending}</p><span>${d.amount}: ${money.format(item.amount)}</span><span>${t.wallet}: ${d.pending}</span></div>`).join("")}
            ${!balances.length && !reservedTokens.length ? `<p class="muted">${d.empty}</p>` : ""}
          </div>
        </section>
        <section class="panel">
          <h3>${d.operationReceipt}</h3>
          <div class="receiptList">${investments.map((item) => renderReceipt(item, events, req)).join("") || `<p class="muted">${d.empty}</p>`}</div>
        </section>
      </main>
    `, req));
  });

  app.post("/investments/:id/cancel", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const investment = store.get("SELECT * FROM investments WHERE id = ? AND user_id = ?", [req.params.id, user.id]);
    if (!investment || investment.status === "tokens_issued") return res.redirect("/dashboard");
    store.run("UPDATE investments SET status = 'canceled' WHERE id = ?", [investment.id]);
    store.run("UPDATE offerings SET raised = MAX(0, raised - ?) WHERE project_id = ?", [investment.amount, investment.project_id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [user.name, "canceled_order", `investment:${investment.id}`, `${money.format(investment.amount)} canceled.`, new Date().toISOString()]);
    res.redirect("/dashboard?canceled=1");
  });

  app.post("/investments/:id/sol-payment", async (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const investment = store.get("SELECT * FROM investments WHERE id = ? AND user_id = ?", [req.params.id, user.id]);
    if (!investment || !["pending_payment", "payment_failed"].includes(investment.status)) return res.redirect("/dashboard");
    const signature = String(req.body.signature || "").trim();
    const expectedSol = investment.payment_expected_sol || getSolPaymentExpected(investment.tokens);
    const treasuryAddress = getTreasuryAddress();
    try {
      const result = await verifySolPayment({ signature, expectedSol, treasuryAddress });
      store.run("UPDATE investments SET status = 'payment_received', payment_status = 'received', payment_signature = ?, payment_expected_sol = ?, payment_received_at = ? WHERE id = ?", [
        result.signature,
        expectedSol,
        new Date().toISOString(),
        investment.id
      ]);
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'verified_sol_payment', ?, ?, ?)", [
        user.name,
        `investment:${investment.id}`,
        `${result.receivedSol.toFixed(9)} SOL recibidos en ${result.treasuryAddress}`,
        new Date().toISOString()
      ]);
      res.redirect("/dashboard?payment=received");
    } catch (error) {
      store.run("UPDATE investments SET status = 'payment_failed', payment_status = 'failed', payment_signature = ? WHERE id = ?", [signature, investment.id]);
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'failed_sol_payment_verification', ?, ?, ?)", [
        user.name,
        `investment:${investment.id}`,
        error.message || String(error),
        new Date().toISOString()
      ]);
      res.redirect("/dashboard?payment=failed");
    }
  });
}

module.exports = registerDashboardRoutes;
