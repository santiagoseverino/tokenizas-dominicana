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

const cacaoSlides = [
  "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=1600&q=72",
  "https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=1600&q=72",
  "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1600&q=72"
];

function cacaoLogo() {
  return `<a class="cacaoLogo" href="#inicio" aria-label="CACAO Bayaguana">
    <span class="cacaoMark">CB</span>
    <span><strong>CACAO</strong><em>Bayaguana Token</em></span>
  </a>`;
}

function cacaoNav(tokenizasUrl, project) {
  return `<header class="cacaoNav">
    ${cacaoLogo()}
    <nav>
      <a href="#token">Token</a>
      <a href="#fondos">Fondos</a>
      <a href="#roadmap">Roadmap</a>
      <a href="#readiness">Readiness</a>
      <a href="${tokenizasUrl}/projects/${project.slug}#invertir">Invertir</a>
    </nav>
  </header>`;
}

function cacaoHero(project, tokenizasUrl) {
  return `<section class="cacaoHero" id="inicio">
    <div class="cacaoSlider" aria-hidden="true">
      ${cacaoSlides.map((src, index) => `<img src="${src}" alt="" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />`).join("")}
    </div>
    ${cacaoNav(tokenizasUrl, project)}
    <div class="cacaoHeroContent">
      <p class="eyebrow">Agricultural tokenization / Bayaguana</p>
      <h1>CACAO Bayaguana</h1>
      <p class="lead">A tokenized cacao farm project designed to test fractional investment, Solana devnet issuance, transparent readiness tracking, and operating capital for agricultural production.</p>
      <div class="actions">
        <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}#invertir">Buy CACAO tokens</a>
        <a class="button" href="#token">Explore token</a>
      </div>
    </div>
  </section>`;
}

function cacaoMicrositeSections(project, offering, mint, raisedPct, tokenizasUrl) {
  const hardCap = offering.hard_cap || project.target_raise;
  return `
    <section class="farmTokenBand" id="token">
      <div>
        <p class="eyebrow">CACAO Token</p>
        <h2>Tokenizacion agricola para una finca de cacao en Bayaguana.</h2>
        <p>El token CACAO representa una participacion economica digital de prueba vinculada al desarrollo productivo de la finca, mantenimiento operativo, preparacion de cosecha y formalizacion comercial.</p>
      </div>
      <div class="tokenGlass">
        <span>${project.token_symbol}</span>
        <strong>${money.format(project.token_price)}</strong>
        <p>precio por token demo</p>
        ${mint ? `<small>${mint.mint_address}</small>` : `<small>Mint Solana en preparacion</small>`}
      </div>
    </section>
    <section class="farmGrid">
      <article>
        <span>01</span>
        <h3>Produccion</h3>
        <p>Capital para mejoras productivas, mantenimiento agricola, herramientas, preparacion de cosecha y organizacion operativa.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Token</h3>
        <p>Supply configurado de ${number.format(project.token_supply)} ${project.token_symbol}, con compras fraccionarias para pruebas en Solana devnet.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Seguimiento</h3>
        <p>Readiness, documentos, mint, pagos y emision de tokens se verifican desde Tokenizas Dominicana.</p>
      </article>
    </section>
    <section class="microSection farmUseFunds" id="fondos">
      <div>
        <p class="eyebrow">Uso de fondos</p>
        <h2>Meta inicial: ${money.format(project.target_raise)}</h2>
        <p>La ronda demo busca validar el flujo completo: interes del inversionista, pago en Solana devnet, emision SPL y balance visible en wallet.</p>
        <div class="fundRows">
          <div><span>Mejoras y mantenimiento agricola</span><strong>40%</strong></div>
          <div><span>Preparacion de cosecha y operacion</span><strong>30%</strong></div>
          <div><span>Formalizacion, documentos y seguimiento</span><strong>20%</strong></div>
          <div><span>Reserva operativa</span><strong>10%</strong></div>
        </div>
      </div>
      <aside class="panel">
        <h3>Progreso de ronda</h3>
        <div class="progress"><span style="width:${raisedPct}%"></span></div>
        <div class="fact"><span>Reservado</span><strong>${money.format(offering.raised || 0)}</strong></div>
        <div class="fact"><span>Meta</span><strong>${money.format(hardCap)}</strong></div>
        <div class="fact"><span>Minimo</span><strong>${money.format(project.min_investment)}</strong></div>
        <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}#invertir">Comprar CACAO</a>
      </aside>
    </section>
    <section class="farmRoadmap" id="roadmap">
      <p class="eyebrow">Roadmap</p>
      <h2>Plan de ejecucion</h2>
      <div>
        <article><span>Q1</span><h3>Expediente</h3><p>Completar documentos, permisos y revision del proyecto.</p></article>
        <article><span>Q2</span><h3>Tokenizacion</h3><p>Crear mint, metadata y flujo de emision controlada.</p></article>
        <article><span>Q3</span><h3>Produccion</h3><p>Ejecutar mejoras de finca y seguimiento operativo.</p></article>
        <article><span>Q4</span><h3>Reportes</h3><p>Publicar avances, balances y resultados de la ronda demo.</p></article>
      </div>
    </section>
  `;
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
        ${project.slug === "finca-cacao-bayaguana" ? cacaoHero(project, tokenizasUrl) : `<section class="microHero">
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
        </section>`}
        <section class="microStats">
          <article><span>Meta</span><strong>${money.format(project.target_raise)}</strong></article>
          <article><span>Token</span><strong>${project.token_symbol}</strong></article>
          <article><span>Precio token</span><strong>${money.format(project.token_price)}</strong></article>
          <article><span>Readiness</span><strong>${progress.percent}%</strong></article>
        </section>
        ${project.slug === "finca-cacao-bayaguana" ? cacaoMicrositeSections(project, offering, mint, raisedPct, tokenizasUrl) : ""}
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
        <section class="microSection" id="readiness">
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
