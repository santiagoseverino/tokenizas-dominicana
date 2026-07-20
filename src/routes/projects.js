const store = require("../db");
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
      <div class="grid cards">${projects.map(projectCard).join("") || "<p class=\"muted\">Todavia no hay proyectos publicados aqui.</p>"}</div>
    </main>
  `, req);
}

function registerProjectRoutes(app) {
  app.get("/projects", (req, res) => {
    const category = String(req.query.category || "");
    const selectedCategory = categoryFilters[category];
    const categoryTitle = selectedCategory ? selectedCategory.title : "Todos";
    const projects = store.all("SELECT * FROM projects ORDER BY created_at DESC").filter((project) => projectMatchesCategory(project, category));
    res.send(renderProjectGridPage(req, {
      title: selectedCategory ? selectedCategory.pageTitle : "Proyectos tokenizables",
      eyebrow: "Marketplace primario",
      subtitle: `Categoria: ${categoryTitle}`,
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
      title: "Marketplace tokenizado",
      eyebrow: "Tokens configurados",
      subtitle: "Proyectos que ya tienen mint configurado y estan listos para ordenes, reservas o emision operativa.",
      projects
    }));
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
              <label>Monto a invertir<input name="amount" type="number" min="${project.min_investment}" step="100" value="${project.min_investment}" /></label>
              <label>Metodo de pago<select name="payment_method"><option>USDC Solana</option><option>Transferencia bancaria</option></select></label>
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
          <div class="panel"><h3>Documentos</h3>${docs.map((doc) => `<div class="row"><span>${doc.title}</span><b>${statusLabel(doc.status)}</b></div>`).join("")}</div>
          <div class="panel"><h3>Eventos Solana simulados</h3>${events.map((event) => `<div class="event"><b>${event.event_type}</b><span>${event.signature}</span><p>${event.note}</p></div>`).join("")}</div>
        </section>
      </main>
    `, req));
  });
}

module.exports = registerProjectRoutes;
