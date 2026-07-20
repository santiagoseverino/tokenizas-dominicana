const store = require("../db");
const { tr } = require("../lib/i18n");
const { localizeProjects } = require("../lib/project-content");
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
    const projects = localizeProjects(store.all("SELECT * FROM projects ORDER BY id LIMIT 3"), req);

    res.send(layout("Inicio", `
      <main>
        <section class="hero">
          <div class="heroSlides" aria-hidden="true">
            <span style="background-image:url('/category-images/real-estate.webp')"></span>
            <span style="background-image:url('/category-images/agriculture.webp')"></span>
            <span style="background-image:url('/category-images/music.webp')"></span>
            <span style="background-image:url('/category-images/tourism.webp')"></span>
            <span style="background-image:url('/category-images/art.webp')"></span>
          </div>
          <div class="heroOverlay"></div>
          <div class="heroContent">
            <p class="eyebrow">${t.heroEyebrow}</p>
            <h1 class="homeHeroTitle">${t.heroTitle}</h1>
            <p class="lead">${t.heroLead}</p>
            <div class="heroCategoryChips" aria-label="${t.projects}">
              ${["real-estate", "agriculture", "music", "art", "tourism", "health-wellness", "business"].map((category) => `<a href="/projects?category=${category}">${t.categoryLabels[category]}</a>`).join("")}
            </div>
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
          <div class="grid cards">${projects.map((project) => projectCard(project, req)).join("")}</div>
        </section>
        <section class="section featureBand">
          <div class="sectionHead">
            <p class="eyebrow">${t.platformText.eyebrow}</p>
            <h2>${t.modulesTitle}</h2>
            <p class="muted">${t.modulesLead}</p>
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
            <h2>${t.platformText.audience}</h2>
          </div>
          <div class="valueList">
            ${t.platformText.values.map((item) => `<p>${item}</p>`).join("")}
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
