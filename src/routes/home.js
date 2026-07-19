const store = require("../db");
const { tr } = require("../lib/i18n");
const { featureCard, layout, money, projectCard, whatsappUrl } = require("../lib/ui");

function registerHomeRoutes(app) {
  app.get("/", (req, res) => {
    const t = tr(req);
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
            <p class="eyebrow">${t.heroEyebrow}</p>
            <h1>${t.heroTitle}</h1>
            <p class="lead">${t.heroLead}</p>
            <div class="actions">
              <a class="button primary" href="/projects">${t.viewProjects}</a>
              <a class="button ghost" href="/invest">${t.createOrder}</a>
            </div>
          </div>
        </section>
        <section class="metrics">
          <article><strong>${stats.projects}</strong><span>${t.pilotProjects}</span></article>
          <article><strong>${money.format(stats.target)}</strong><span>${t.targetCapital}</span></article>
          <article><strong>${money.format(stats.raised)}</strong><span>${t.reservedCapital}</span></article>
        </section>
        <section class="section">
          <div class="sectionHead">
            <p class="eyebrow">${t.pipeline}</p>
            <h2>${t.readyAssets}</h2>
          </div>
          <div class="grid cards">${projects.map(projectCard).join("")}</div>
        </section>
        <section class="section featureBand">
          <div class="sectionHead">
            <p class="eyebrow">Tokenization platform</p>
            <h2>${t.modulesTitle}</h2>
            <p class="muted">${t.modulesLead}</p>
          </div>
          <div class="offerSlider" aria-label="Categorias tokenizables">
            ${[
              ["Bienes raices", "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=720&q=68"],
              ["Agricultura", "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=720&q=68"],
              ["Arte", "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=720&q=68"],
              ["Musica", "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=720&q=68"],
              ["Turismo", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=720&q=68"]
            ].map((item) => `<article class="offerSlide"><img src="${item[1]}" alt="${item[0]}" loading="lazy" decoding="async" width="720" height="420" /><strong>${item[0]}</strong></article>`).join("")}
          </div>
          <div class="grid featureGrid">
            ${featureCard(t.backOffice, t.backOfficeText, "01")}
            ${featureCard(t.smartContracts, t.smartContractsText, "02")}
            ${featureCard(t.investorPortal, t.investorPortalText, "03")}
            ${featureCard(t.landingPages, t.landingPagesText, "04")}
          </div>
        </section>
        <section class="section valueSection">
          <div>
            <p class="eyebrow">${t.advantagesTitle}</p>
            <h2>Built for issuers, developers, family offices and cross-border investors.</h2>
          </div>
          <div class="valueList">
            <p>Due diligence workflow, project documentation, investor eligibility and cap table visibility.</p>
            <p>Primary offerings, controlled transfers, operational reporting and distribution tracking.</p>
            <p>White-label style pages for each project with professional visuals and compliance-first language.</p>
          </div>
        </section>
        <section class="section ctaBand">
          <div>
            <p class="eyebrow">${t.demoTitle}</p>
            <h2>${t.contactTitle}</h2>
            <p>${t.contactLead}</p>
          </div>
          <div class="actions">
            <a class="button primary" href="/contact">${t.contact}</a>
            <a class="button whatsapp" href="${whatsappUrl(t.contactTitle)}" target="_blank" rel="noopener">${t.whatsapp}</a>
          </div>
        </section>
      </main>
    `, req));
  });
}

module.exports = registerHomeRoutes;
