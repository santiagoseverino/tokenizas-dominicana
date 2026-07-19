const store = require("../db");
const { layout, money, statusLabel } = require("../lib/ui");

function registerInvestRoutes(app) {
  app.get("/invest", (req, res) => {
    const projects = store.all(`
      SELECT p.*, o.raised, o.hard_cap
      FROM projects p
      LEFT JOIN offerings o ON o.project_id = p.id
      WHERE p.status IN ('open', 'due_diligence', 'funded')
      ORDER BY CASE p.status WHEN 'open' THEN 1 WHEN 'due_diligence' THEN 2 ELSE 3 END, p.id
    `);
    const defaultProject = projects.find((project) => project.status === "open") || projects[0];
    res.send(layout("Invertir", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">Orden de prueba</p><h1>Crear una inversion tokenizada</h1><p class="muted">Selecciona un proyecto, monto y metodo de pago. Esta pantalla simula la reserva y emision operativa para pruebas.</p></div>
        <section class="investPage">
          <form class="panel investPanel" method="post" action="/invest">
            <h2>Nueva orden</h2>
            <label>Proyecto<select name="project_id">${projects.map((project) => `<option value="${project.id}" ${defaultProject && defaultProject.id === project.id ? "selected" : ""}>${project.title} - ${project.token_symbol}</option>`).join("")}</select></label>
            <label>Monto a invertir<input name="amount" type="number" min="100" step="100" value="${defaultProject ? defaultProject.min_investment : 1000}" /></label>
            <label>Metodo de pago<select name="payment_method"><option>USDC Solana</option><option>Transferencia bancaria</option></select></label>
            <button class="button primary" type="submit">Crear orden</button>
          </form>
          <div class="panel">
            <h2>Proyectos disponibles</h2>
            ${projects.map((project) => {
              const raisedPct = project.hard_cap ? Math.min(100, Math.round((project.raised / project.hard_cap) * 100)) : 0;
              return `<article class="miniProject"><img src="${project.image_url}" alt="${project.title}" /><div><div class="pill">${statusLabel(project.status)}</div><h3>${project.title}</h3><p>${project.location}</p><div class="progress"><span style="width:${raisedPct}%"></span></div><p class="muted">${money.format(project.raised || 0)} de ${money.format(project.hard_cap || project.target_raise)} reservados.</p><a href="/projects/${project.slug}">Ver detalle</a></div></article>`;
            }).join("")}
          </div>
        </section>
      </main>
    `, req));
  });

  app.post("/invest", (req, res) => {
    const project = store.get("SELECT * FROM projects WHERE id = ?", [req.body.project_id]);
    const amount = Number(req.body.amount || 0);
    if (!project || amount < project.min_investment) return res.status(400).send("Orden invalida");
    const tokens = Math.floor(amount / project.token_price);
    store.run("INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, created_at) VALUES (1, ?, ?, ?, ?, 'pending_payment', ?)", [project.id, amount, tokens, req.body.payment_method, new Date().toISOString()]);
    store.run("UPDATE offerings SET raised = raised + ? WHERE project_id = ?", [amount, project.id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Maria Rodriguez", "created_order", project.title, `${tokens} tokens reservados por ${money.format(amount)}.`, new Date().toISOString()]);
    res.redirect("/dashboard");
  });
}

module.exports = registerInvestRoutes;
