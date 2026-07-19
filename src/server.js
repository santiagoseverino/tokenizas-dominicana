const express = require("express");
const path = require("path");
const store = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tokenizas-dominicana" });
});

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

function layout(title, body) {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} | Tokenizas Dominicana</title>
      <link rel="stylesheet" href="/styles.css" />
      <link rel="preconnect" href="https://images.unsplash.com">
    </head>
    <body>
      <header class="topbar">
        <a class="brand" href="/">Tokenizas<span>Dominicana</span></a>
        <nav>
          <a href="/projects">Proyectos</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>
      ${body}
    </body>
  </html>`;
}

function statusLabel(status) {
  const labels = {
    open: "Abierto",
    due_diligence: "Due diligence",
    funded: "Financiado",
    tokens_issued: "Tokens emitidos",
    compliance_review: "Revision compliance"
  };
  return labels[status] || status;
}

app.get("/", (req, res) => {
  const stats = store.get(`
    SELECT
      COUNT(*) projects,
      COALESCE(SUM(target_raise), 0) target,
      COALESCE((SELECT SUM(raised) FROM offerings), 0) raised
    FROM projects
  `);

  const projects = store.all("SELECT * FROM projects ORDER BY id LIMIT 3");
  res.send(layout("Inicio", `
    <main>
      <section class="hero">
        <div class="heroOverlay"></div>
        <div class="heroContent">
          <p class="eyebrow">Real estate tokenization en Solana</p>
          <h1>Invierte de forma fraccionada en proyectos inmobiliarios dominicanos.</h1>
          <p class="lead">Plataforma demo para originar activos, validar inversionistas, estructurar ofertas, emitir tokens controlados y administrar distribuciones.</p>
          <div class="actions">
            <a class="button primary" href="/projects">Ver proyectos</a>
            <a class="button ghost" href="/admin">Panel admin</a>
          </div>
        </div>
      </section>
      <section class="metrics">
        <article><strong>${stats.projects}</strong><span>Proyectos piloto</span></article>
        <article><strong>${money.format(stats.target)}</strong><span>Capital objetivo</span></article>
        <article><strong>${money.format(stats.raised)}</strong><span>Capital reservado</span></article>
      </section>
      <section class="section">
        <div class="sectionHead">
          <p class="eyebrow">Pipeline</p>
          <h2>Activos listos para pruebas</h2>
        </div>
        <div class="grid cards">${projects.map(projectCard).join("")}</div>
      </section>
    </main>
  `));
});

app.get("/projects", (req, res) => {
  const projects = store.all("SELECT * FROM projects ORDER BY created_at DESC");
  res.send(layout("Proyectos", `
    <main class="page">
      <div class="sectionHead">
        <p class="eyebrow">Marketplace primario</p>
        <h1>Proyectos inmobiliarios</h1>
      </div>
      <div class="grid cards">${projects.map(projectCard).join("")}</div>
    </main>
  `));
});

app.get("/projects/:slug", (req, res) => {
  const project = store.get("SELECT * FROM projects WHERE slug = ?", [req.params.slug]);
  if (!project) return res.status(404).send("Proyecto no encontrado");

  const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]);
  const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [project.id]);
  const events = store.all("SELECT * FROM token_events WHERE project_id = ?", [project.id]);
  const raisedPct = Math.min(100, Math.round((offering.raised / offering.hard_cap) * 100));

  res.send(layout(project.title, `
    <main>
      <section class="detailHero" style="background-image:url('${project.image_url}')">
        <div class="heroOverlay"></div>
        <div class="heroContent narrow">
          <p class="eyebrow">${project.location}</p>
          <h1>${project.title}</h1>
          <p class="lead">${project.description}</p>
        </div>
      </section>
      <section class="detailGrid">
        <div>
          <h2>Estructura de la oferta</h2>
          <p>${project.legal_structure}</p>
          <div class="progress"><span style="width:${raisedPct}%"></span></div>
          <p class="muted">${money.format(offering.raised)} reservados de ${money.format(offering.hard_cap)}.</p>
          <form class="investForm" method="post" action="/invest">
            <input type="hidden" name="project_id" value="${project.id}" />
            <label>Monto a invertir
              <input name="amount" type="number" min="${project.min_investment}" step="100" value="${project.min_investment}" />
            </label>
            <label>Metodo de pago
              <select name="payment_method">
                <option>USDC Solana</option>
                <option>Transferencia bancaria</option>
              </select>
            </label>
            <button class="button primary" type="submit">Crear orden de prueba</button>
          </form>
        </div>
        <aside class="panel">
          <h3>Datos clave</h3>
          ${fact("Meta", money.format(project.target_raise))}
          ${fact("Minimo", money.format(project.min_investment))}
          ${fact("Token", project.token_symbol)}
          ${fact("Supply", number.format(project.token_supply))}
          ${fact("Yield esperado", `${project.expected_yield}%`)}
          ${fact("Riesgo", project.risk_level)}
          ${fact("Lockup", `${offering.lockup_months} meses`)}
        </aside>
      </section>
      <section class="split">
        <div class="panel">
          <h3>Documentos</h3>
          ${docs.map((doc) => `<div class="row"><span>${doc.title}</span><b>${statusLabel(doc.status)}</b></div>`).join("")}
        </div>
        <div class="panel">
          <h3>Eventos Solana simulados</h3>
          ${events.map((event) => `<div class="event"><b>${event.event_type}</b><span>${event.signature}</span><p>${event.note}</p></div>`).join("")}
        </div>
      </section>
    </main>
  `));
});

app.post("/invest", (req, res) => {
  const project = store.get("SELECT * FROM projects WHERE id = ?", [req.body.project_id]);
  const amount = Number(req.body.amount || 0);
  if (!project || amount < project.min_investment) return res.status(400).send("Orden invalida");

  const tokens = Math.floor(amount / project.token_price);
  store.run(`
    INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, created_at)
    VALUES (1, ?, ?, ?, ?, 'pending_payment', ?)
  `, [project.id, amount, tokens, req.body.payment_method, new Date().toISOString()]);

  store.run("UPDATE offerings SET raised = raised + ? WHERE project_id = ?", [amount, project.id]);
  store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Maria Rodriguez", "created_order", project.title, `${tokens} tokens reservados por ${money.format(amount)}.`, new Date().toISOString()]);

  res.redirect("/dashboard");
});

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
      <div class="sectionHead">
        <p class="eyebrow">Inversionista</p>
        <h1>${user.name}</h1>
        <p class="muted">KYC: ${statusLabel(user.kyc_status)} · Wallet: ${user.wallet}</p>
      </div>
      <section class="metrics compact">
        <article><strong>${money.format(total)}</strong><span>Invertido/reservado</span></article>
        <article><strong>${number.format(investments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
        <article><strong>${investments.length}</strong><span>Ordenes</span></article>
      </section>
      <div class="portfolio">${investments.map((item) => `
        <article class="holding">
          <img src="${item.image_url}" alt="${item.title}" />
          <div>
            <h3>${item.title}</h3>
            <p>${item.location}</p>
          </div>
          <b>${number.format(item.tokens)} ${item.token_symbol}</b>
          <span>${money.format(item.amount)}</span>
          <em>${statusLabel(item.status)}</em>
        </article>
      `).join("")}</div>
    </main>
  `));
});

app.get("/admin", (req, res) => {
  const projects = store.all(`
    SELECT p.*, o.raised FROM projects p LEFT JOIN offerings o ON o.project_id = p.id ORDER BY p.id
  `);
  const users = store.all("SELECT * FROM users ORDER BY id");
  const logs = store.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8");
  res.send(layout("Admin", `
    <main class="page">
      <div class="sectionHead">
        <p class="eyebrow">Back office</p>
        <h1>Control operativo</h1>
      </div>
      <section class="split">
        <div class="panel">
          <h3>Proyectos</h3>
          ${projects.map((project) => `<div class="row"><span>${project.title}</span><b>${money.format(project.raised || 0)}</b></div>`).join("")}
        </div>
        <div class="panel">
          <h3>KYC / KYB</h3>
          ${users.map((user) => `<div class="row"><span>${user.name}</span><b>${statusLabel(user.kyc_status)}</b></div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <h3>Auditoria</h3>
        ${logs.map((log) => `<div class="event"><b>${log.action}</b><span>${log.actor} · ${log.entity}</span><p>${log.details}</p></div>`).join("")}
      </section>
    </main>
  `));
});

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
}

function projectCard(project) {
  return `<article class="card">
    <img src="${project.image_url}" alt="${project.title}" />
    <div class="cardBody">
      <div class="pill">${statusLabel(project.status)}</div>
      <h3>${project.title}</h3>
      <p>${project.location}</p>
      <div class="cardStats">
        <span>${money.format(project.min_investment)} min.</span>
        <span>${project.expected_yield}% yield</span>
      </div>
      <a class="button small" href="/projects/${project.slug}">Abrir</a>
    </div>
  </article>`;
}

store.initDb().then(() => {
  app.listen(port, () => {
    console.log(`Tokenizas Dominicana listo en http://localhost:${port}`);
  });
});
