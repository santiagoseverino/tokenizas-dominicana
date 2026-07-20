const store = require("../db");
const { tr } = require("../lib/i18n");
const { fact, layout, money, number, projectCard, statusLabel } = require("../lib/ui");

const categoryFilters = {
  "real-estate": { title: "Bienes raices", pageTitle: "Proyectos inmobiliarios", slugs: ["punta-cana-villas", "santo-domingo-torre"], patterns: ["renta corta", "residencial", "torre", "villas"] },
  agriculture: { title: "Agricultura", pageTitle: "Proyectos de agricultura", slugs: ["finca-cacao-bayaguana"], patterns: ["agro", "cacao", "finca", "agricola"] },
  art: { title: "Arte", pageTitle: "Proyectos de arte", patterns: ["arte", "galeria", "coleccion"] },
  music: { title: "Musica", pageTitle: "Proyectos de musica", slugs: ["lionel-the-star-entertainment"], patterns: ["musica", "royalties", "catalogo"] },
  tourism: { title: "Turismo", pageTitle: "Proyectos de turismo", slugs: ["samana-eco-hotel", "punta-cana-villas"], patterns: ["turistica", "hotel", "hospitality", "eco"] },
  business: { title: "Negocios", pageTitle: "Proyectos de negocios", patterns: ["negocio", "pyme", "empresa"] },
  energy: { title: "Energia", pageTitle: "Proyectos de energia", patterns: ["energia", "solar", "renovable"] }
};

function projectMatchesCategory(project, category) {
  if (!category || !categoryFilters[category]) return true;
  if (project.category) return project.category === category;
  if (categoryFilters[category].slugs) return categoryFilters[category].slugs.includes(project.slug);
  const value = `${project.slug} ${project.title} ${project.type} ${project.description}`.toLowerCase();
  return categoryFilters[category].patterns.some((pattern) => value.includes(pattern));
}

function renderProjectGridPage(req, { title, eyebrow, subtitle, projects }) {
  return layout(title, `
    <main class="page">
      <div class="sectionHead">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="muted">${subtitle}</p>
      </div>
      <div class="grid cards">${projects.map(projectCard).join("") || `<p class="muted">${tr(req).projectPages.empty}</p>`}</div>
    </main>
  `, req);
}

function registerProjectRoutes(app) {
  app.get("/projects", (req, res) => {
    const category = String(req.query.category || "");
    const selectedCategory = categoryFilters[category];
    const t = tr(req);
    const categoryTitle = selectedCategory ? t.categoryLabels[category] : t.projectPages.all;
    const projects = store.all("SELECT * FROM projects ORDER BY created_at DESC").filter((project) => projectMatchesCategory(project, category));
    res.send(renderProjectGridPage(req, {
      title: selectedCategory ? t.projectPages.categoryTitles[category] : t.projectPages.tokenizable,
      eyebrow: t.projectPages.primaryMarket,
      subtitle: `${t.projectPages.category}: ${categoryTitle}`,
      projects
    }));
  });

  app.get("/marketplace", (req, res) => {
    const projects = store.all(`
      SELECT p.*
      FROM projects p
      JOIN token_mints tm ON tm.project_id = p.id
      ORDER BY tm.created_at DESC
    `);
    res.send(renderProjectGridPage(req, {
      title: tr(req).projectPages.marketplaceTitle,
      eyebrow: tr(req).projectPages.marketplaceEyebrow,
      subtitle: tr(req).projectPages.marketplaceLead,
      projects
    }));
  });

  app.get("/projects/:slug", (req, res) => {
    const project = store.get("SELECT * FROM projects WHERE slug = ?", [req.params.slug]);
    if (!project) return res.status(404).send(tr(req).projectPages.notFound);
    const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]);
    const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [project.id]);
    const events = store.all("SELECT * FROM token_events WHERE project_id = ?", [project.id]);
    const raisedPct = Math.min(100, Math.round((offering.raised / offering.hard_cap) * 100));
    const t = tr(req).projectPages;

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
            <h2>${t.offerStructure}</h2>
            <p>${project.legal_structure}</p>
            <div class="progress"><span style="width:${raisedPct}%"></span></div>
            <p class="muted">${money.format(offering.raised)} ${t.reservedOf} ${money.format(offering.hard_cap)}.</p>
            <form class="investForm" method="post" action="/invest">
              <input type="hidden" name="project_id" value="${project.id}" />
              <label>${t.investAmount}<input name="amount" type="number" min="${project.min_investment}" step="100" value="${project.min_investment}" /></label>
              <label>${t.paymentMethod}<select name="payment_method"><option>USDC Solana</option><option>Bank transfer</option></select></label>
              <button class="button primary" type="submit">${t.testOrder}</button>
            </form>
          </div>
          <aside class="panel">
            <h3>${t.keyData}</h3>
            ${fact(t.target, money.format(project.target_raise))}
            ${fact(t.minimum, money.format(project.min_investment))}
            ${fact("Token", project.token_symbol)}
            ${fact("Supply", number.format(project.token_supply))}
            ${fact(t.expectedYield, `${project.expected_yield}%`)}
            ${fact(t.risk, project.risk_level)}
            ${fact("Lockup", `${offering.lockup_months} ${t.months}`)}
          </aside>
        </section>
        <section class="split">
          <div class="panel"><h3>${t.documents}</h3>${docs.map((doc) => `<div class="row"><span>${doc.title}</span><b>${statusLabel(doc.status, req)}</b></div>`).join("")}</div>
          <div class="panel"><h3>${t.solanaEvents}</h3>${events.map((event) => `<div class="event"><b>${event.event_type}</b><span>${event.signature}</span><p>${event.note}</p></div>`).join("")}</div>
        </section>
      </main>
    `, req));
  });
}

module.exports = registerProjectRoutes;
