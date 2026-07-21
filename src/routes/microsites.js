const store = require("../db");
const config = require("../config");
const { checklistProgress, getProjectChecklist, statusLabels: checklistStatusLabels } = require("../lib/project-checklist");
const { localizeProject } = require("../lib/project-content");
const { money, number, statusLabel } = require("../lib/ui");

const reservedHosts = new Set(["", "www", "tokenizas", "admin", "api", "mail"]);

function normalizeHost(host) {
  return String(host || "").split(":")[0].toLowerCase();
}

function normalizeAlias(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function rootDomain() {
  try {
    return new URL(config.siteUrl).hostname.replace(/^tokenizas\./, "");
  } catch (_) {
    return "dominicana.com";
  }
}

function projectAliases(project) {
  const aliases = new Set([
    normalizeAlias(project.slug),
    normalizeAlias(project.title),
    normalizeAlias(String(project.slug || "").replace(/^finca-/, ""))
  ]);
  if (project.slug === "finca-cacao-bayaguana") {
    aliases.add("cacaobayaguana");
    aliases.add("cacaobayagua");
  }
  return aliases;
}

function findProjectBySubdomain(subdomain) {
  const alias = normalizeAlias(subdomain);
  if (!alias || reservedHosts.has(alias)) return null;
  return store.all("SELECT * FROM projects ORDER BY id").find((project) => projectAliases(project).has(alias));
}

function micrositeHtml(req, project) {
  const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]) || {};
  const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [project.id]);
  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  const checklist = getProjectChecklist(project.id, true);
  const progress = checklistProgress(checklist);
  const raisedPct = Math.min(100, Math.round((Number(offering.raised || 0) / Number(offering.hard_cap || project.target_raise || 1)) * 100));
  const tokenizasUrl = config.siteUrl;
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${project.title} | Tokenizas Dominicana</title>
      <link rel="stylesheet" href="/styles.css" />
      <link rel="preconnect" href="https://images.unsplash.com">
    </head>
    <body>
      <main class="microSite">
        <section class="microHero">
          <div class="microHeroMedia"><img src="${project.image_url}" alt="${project.title}" /></div>
          <div class="microHeroContent">
            <a class="microBrand" href="${tokenizasUrl}"><img src="/tokenizas-dominicana-logo.png" alt="Tokenizas Dominicana" /></a>
            <p class="eyebrow">${project.category || "Proyecto tokenizado"} / ${project.location}</p>
            <h1>${project.title}</h1>
            <p class="lead">${project.description}</p>
            <div class="actions">
              <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}#invertir">Invertir en este proyecto</a>
              <a class="button" href="${tokenizasUrl}/contact">Solicitar informacion</a>
            </div>
          </div>
        </section>
        <section class="microStats">
          <article><span>Meta</span><strong>${money.format(project.target_raise)}</strong></article>
          <article><span>Token</span><strong>${project.token_symbol}</strong></article>
          <article><span>Precio token</span><strong>${money.format(project.token_price)}</strong></article>
          <article><span>Readiness</span><strong>${progress.percent}%</strong></article>
        </section>
        <section class="microSection">
          <div>
            <p class="eyebrow">Oferta</p>
            <h2>Estructura de inversion</h2>
            <p>${project.legal_structure}</p>
            <div class="progress"><span style="width:${raisedPct}%"></span></div>
            <p class="muted">${money.format(offering.raised || 0)} reservados de ${money.format(offering.hard_cap || project.target_raise)}.</p>
          </div>
          <aside class="panel">
            <h3>Datos clave</h3>
            <div class="fact"><span>Estado</span><strong>${statusLabel(project.status)}</strong></div>
            <div class="fact"><span>Supply</span><strong>${number.format(project.token_supply)}</strong></div>
            <div class="fact"><span>Rendimiento esperado</span><strong>${project.expected_yield}%</strong></div>
            <div class="fact"><span>Riesgo</span><strong>${project.risk_level}</strong></div>
            ${mint ? `<div class="fact"><span>Mint</span><strong class="monoBreak">${mint.mint_address}</strong></div>` : ""}
          </aside>
        </section>
        <section class="microSection">
          <div class="panel readinessPanel">
            <div class="checklistHeader">
              <div><p class="eyebrow">Readiness</p><h3>Checklist profesional</h3><p class="muted">Resumen publico del expediente del proyecto.</p></div>
              <strong>${progress.percent}%</strong>
            </div>
            <div class="progress compactProgress"><span style="width:${progress.percent}%"></span></div>
            <div class="ownerChecklist">${checklist.map((item) => `<div class="ownerCheckItem ${item.status}"><b>${item.label}</b><span>${checklistStatusLabels[item.status] || item.status}</span></div>`).join("")}</div>
          </div>
          <aside class="panel">
            <h3>Documentos</h3>
            ${docs.map((doc) => `<div class="row"><span>${doc.title}</span><b>${statusLabel(doc.status)}</b></div>`).join("") || `<p class="muted">Documentos en preparacion.</p>`}
          </aside>
        </section>
      </main>
    </body>
  </html>`;
}

function registerMicrositeRoutes(app) {
  app.get("*", (req, res, next) => {
    const host = normalizeHost(req.headers["x-forwarded-host"] || req.headers.host);
    const domain = rootDomain();
    if (!host.endsWith(`.${domain}`)) return next();
    const subdomain = host.slice(0, -1 * (`.${domain}`).length);
    const project = findProjectBySubdomain(subdomain);
    if (!project) return next();
    const localized = localizeProject(project, req);
    res.send(micrositeHtml(req, localized));
  });
}

module.exports = registerMicrositeRoutes;
