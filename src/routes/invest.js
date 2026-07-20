const store = require("../db");
const { currentInvestor } = require("../middleware/auth");
const { tr } = require("../lib/i18n");
const { localizeProjects } = require("../lib/project-content");
const { layout, money, statusLabel } = require("../lib/ui");

function registerInvestRoutes(app) {
  app.get("/invest", (req, res) => {
    const projects = localizeProjects(store.all(`
      SELECT p.*, o.raised, o.hard_cap
      FROM projects p
      LEFT JOIN offerings o ON o.project_id = p.id
      WHERE p.status IN ('open', 'due_diligence', 'funded')
      ORDER BY CASE p.status WHEN 'open' THEN 1 WHEN 'due_diligence' THEN 2 ELSE 3 END, p.id
    `), req);
    const defaultProject = projects.find((project) => project.status === "open") || projects[0];
    const t = tr(req);
    res.send(layout("Invertir", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">${t.createOrder}</p><h1>${t.investor.createOrder}</h1><p class="muted">${t.investor.loginLead}</p></div>
        ${currentInvestor(req) ? "" : `<div class="alert">${t.investor.noAccount} <a href="/investor/register">${t.investor.register}</a> / <a href="/investor/login">${t.investor.login}</a>.</div>`}
        <section class="investPage">
          <form class="panel investPanel" method="post" action="/invest">
            <h2>${t.createOrder}</h2>
            <label>${t.projects}<select name="project_id">${projects.map((project) => `<option value="${project.id}" ${defaultProject && defaultProject.id === project.id ? "selected" : ""}>${project.title} - ${project.token_symbol}</option>`).join("")}</select></label>
            <label>${t.targetCapital}<input name="amount" type="number" min="100" step="100" value="${defaultProject ? defaultProject.min_investment : 1000}" /></label>
            <label>${t.status}<select name="payment_method"><option>USDC Solana</option><option>Bank transfer</option></select></label>
            <label>KYC<textarea name="investor_note" rows="4" placeholder="${t.investor.missingDocs}"></textarea></label>
            <button class="button primary" type="submit">${t.createOrder}</button>
          </form>
          <div class="panel">
            <h2>${t.projects}</h2>
            ${projects.map((project) => {
              const raisedPct = project.hard_cap ? Math.min(100, Math.round((project.raised / project.hard_cap) * 100)) : 0;
              return `<article class="miniProject"><img src="${project.image_url}" alt="${project.title}" /><div><div class="pill">${statusLabel(project.status, req)}</div><h3>${project.title}</h3><p>${project.location}</p><div class="progress"><span style="width:${raisedPct}%"></span></div><p class="muted">${money.format(project.raised || 0)} / ${money.format(project.hard_cap || project.target_raise)} ${t.reservedCapital}.</p><a href="/projects/${project.slug}">${t.viewProjects}</a></div></article>`;
            }).join("")}
          </div>
        </section>
      </main>
    `, req));
  });

  app.post("/invest", (req, res) => {
    const user = currentInvestor(req);
    if (!user) return res.redirect("/investor/login");
    const project = store.get("SELECT * FROM projects WHERE id = ?", [req.body.project_id]);
    const amount = Number(req.body.amount || 0);
    if (!project || amount < project.min_investment) return res.status(400).send("Orden invalida");
    const tokens = Math.floor(amount / project.token_price);
    const status = user.kyc_status === "approved" ? "pending_payment" : "compliance_review";
    store.run("INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, investor_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [user.id, project.id, amount, tokens, req.body.payment_method, status, req.body.investor_note || "", new Date().toISOString()]);
    const investment = store.get("SELECT id FROM investments WHERE user_id = ? AND project_id = ? ORDER BY id DESC LIMIT 1", [user.id, project.id]);
    store.run("UPDATE offerings SET raised = raised + ? WHERE project_id = ?", [amount, project.id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [user.name, "created_order", project.title, `${tokens} tokens reservados por ${money.format(amount)}.`, new Date().toISOString()]);
    res.redirect(`/dashboard?created=${investment.id}`);
  });
}

module.exports = registerInvestRoutes;
