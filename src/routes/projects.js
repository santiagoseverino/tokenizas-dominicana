const store = require("../db");
const { tr } = require("../lib/i18n");
const { checklistProgress, getProjectChecklist, statusLabels: checklistStatusLabels } = require("../lib/project-checklist");
const { localizeProject, localizeProjects } = require("../lib/project-content");
const { fact, layout, money, number, projectCard, statusLabel } = require("../lib/ui");

const categoryFilters = {
  "real-estate": { title: "Bienes raices", pageTitle: "Proyectos inmobiliarios", slugs: ["punta-cana-villas", "santo-domingo-torre"], patterns: ["renta corta", "residencial", "torre", "villas"] },
  agriculture: { title: "Agricultura", pageTitle: "Proyectos de agricultura", slugs: ["finca-cacao-bayaguana"], patterns: ["agro", "cacao", "finca", "agricola"] },
  art: { title: "Arte", pageTitle: "Proyectos de arte", patterns: ["arte", "galeria", "coleccion"] },
  music: { title: "Musica", pageTitle: "Proyectos de musica", slugs: ["lionel-the-star-entertainment"], patterns: ["musica", "royalties", "catalogo"] },
  tourism: { title: "Turismo", pageTitle: "Proyectos de turismo", slugs: ["samana-eco-hotel", "punta-cana-villas"], patterns: ["turistica", "hotel", "hospitality", "eco"] },
  "health-wellness": { title: "Health and wellness", pageTitle: "Proyectos de salud y bienestar", patterns: ["salud", "bienestar", "wellness", "health", "spa", "clinica", "medical"] },
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
      <div class="grid cards">${projects.map((project) => projectCard(project, req)).join("") || `<p class="muted">${tr(req).projectPages.empty}</p>`}</div>
    </main>
  `, req);
}

function shortSummary(text, max = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentence = clean.slice(0, max).replace(/\s+\S*$/, "");
  return `${sentence}...`;
}

function registerProjectRoutes(app) {
  app.get("/projects", (req, res) => {
    const category = String(req.query.category || "");
    const selectedCategory = categoryFilters[category];
    const t = tr(req);
    const categoryTitle = selectedCategory ? t.categoryLabels[category] : t.projectPages.all;
    const projects = localizeProjects(store.all("SELECT * FROM projects ORDER BY created_at DESC").filter((project) => projectMatchesCategory(project, category)), req);
    res.send(renderProjectGridPage(req, {
      title: selectedCategory ? t.projectPages.categoryTitles[category] : t.projectPages.tokenizable,
      eyebrow: t.projectPages.primaryMarket,
      subtitle: `${t.projectPages.category}: ${categoryTitle}`,
      projects
    }));
  });

  app.get("/primary-marketplace", (req, res) => {
    const projects = localizeProjects(store.all(`
      SELECT p.*
      FROM projects p
      JOIN token_mints tm ON tm.project_id = p.id
      ORDER BY tm.created_at DESC
    `), req);
    res.send(renderProjectGridPage(req, {
      title: tr(req).projectPages.marketplaceTitle,
      eyebrow: tr(req).projectPages.marketplaceEyebrow,
      subtitle: tr(req).projectPages.marketplaceLead,
      projects
    }));
  });

  app.get("/token-metadata/:slug.json", (req, res) => {
    const project = store.get("SELECT * FROM projects WHERE slug = ?", [req.params.slug]);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const image = String(project.image_url || "").startsWith("http")
      ? project.image_url
      : `${req.protocol}://${req.get("host")}${project.image_url || "/tokenizas-dominicana-logo.png"}`;
    res.json({
      name: project.title,
      symbol: project.token_symbol,
      description: project.description,
      image,
      external_url: `${req.protocol}://${req.get("host")}/projects/${project.slug}`,
      attributes: [
        { trait_type: "Category", value: project.category || "asset" },
        { trait_type: "Location", value: project.location },
        { trait_type: "Target Raise", value: String(project.target_raise) }
      ]
    });
  });

  app.get("/projects/:slug", (req, res) => {
    const project = localizeProject(store.get("SELECT * FROM projects WHERE slug = ?", [req.params.slug]), req);
    if (!project) return res.status(404).send(tr(req).projectPages.notFound);
    const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]);
    const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [project.id]);
    const events = store.all("SELECT * FROM token_events WHERE project_id = ?", [project.id]);
    const checklist = getProjectChecklist(project.id, true);
    const checklistStats = checklistProgress(checklist);
    const raisedPct = Math.min(100, Math.round((offering.raised / offering.hard_cap) * 100));
    const t = tr(req).projectPages;

    res.send(layout(project.title, `
      <main>
        <section class="projectSummaryHero">
          <div class="projectSummaryCopy">
            <p class="eyebrow">${project.location}</p>
            <h1>${project.title}</h1>
            <p class="lead">${shortSummary(project.description)}</p>
            <div class="actions">
              <a class="button primary" href="#invertir">${t.testOrder}</a>
              <a class="button" href="#mas-informacion">Mas informacion</a>
            </div>
          </div>
          <div class="projectSummaryImage">
            <img src="${project.image_url}" alt="${project.title}" />
          </div>
        </section>
        <section class="detailGrid" id="invertir">
          <div>
            <h2>${t.offerStructure}</h2>
            <p>${shortSummary(project.legal_structure, 180)}</p>
            <div class="progress"><span style="width:${raisedPct}%"></span></div>
            <p class="muted">${money.format(offering.raised)} ${t.reservedOf} ${money.format(offering.hard_cap)}.</p>
            <form class="investForm" method="post" action="/invest">
              <input type="hidden" name="project_id" value="${project.id}" />
              <label>${t.tokenQuantity}<input name="tokens" type="number" min="0.001" step="0.001" value="0.005" /></label>
              <p class="muted">${t.tokenPrice}: ${money.format(project.token_price)}. ${t.fractionalHint}</p>
              <label>${t.paymentMethod}<select name="payment_method"><option>${tr(req).paymentMethods.usdc}</option><option>${tr(req).paymentMethods.bank}</option></select></label>
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
        <section class="split" id="mas-informacion">
          <div class="panel"><h3>Mas informacion del proyecto</h3><p>${project.description}</p><div class="event"><b>${t.offerStructure}</b><p>${project.legal_structure}</p></div></div>
          <aside class="panel"><h3>${t.keyData}</h3>${fact(t.target, money.format(project.target_raise))}${fact(t.minimum, money.format(project.min_investment))}${fact("Token", project.token_symbol)}${fact("Supply", number.format(project.token_supply))}${fact(t.expectedYield, `${project.expected_yield}%`)}</aside>
        </section>
        <section class="page publicReadiness">
          <div class="panel readinessPanel">
            <div class="checklistHeader">
              <div>
                <p class="eyebrow">Readiness</p>
                <h3>Checklist profesional del proyecto</h3>
                <p class="muted">Resumen publico de due diligence, permisos, presupuesto y tokenizacion.</p>
              </div>
              <strong>${checklistStats.percent}%</strong>
            </div>
            <div class="progress compactProgress"><span style="width:${checklistStats.percent}%"></span></div>
            <div class="ownerChecklist">
              ${checklist.map((item) => `<div class="ownerCheckItem ${item.status}"><b>${item.label}</b><span>${checklistStatusLabels[item.status] || item.status}</span></div>`).join("")}
            </div>
          </div>
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
