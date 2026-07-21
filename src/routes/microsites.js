const store = require("../db");
const config = require("../config");
const { checklistProgress, getProjectChecklist } = require("../lib/project-checklist");
const { getLang } = require("../lib/i18n");
const { localizeProject } = require("../lib/project-content");
const { money, number, statusLabel } = require("../lib/ui");

const reservedHosts = new Set(["", "www", "tokenizas", "admin", "api", "mail"]);
const languageFlags = { es: "🇩🇴", en: "🇺🇸", de: "🇩🇪", fr: "🇫🇷" };
const checklistText = {
  es: {
    owner_kyb: "KYB del dueno o empresa emisora",
    legal_owner: "Titularidad legal o derecho economico documentado",
    legal_opinion: "Opinion legal sobre la estructura de tokenizacion",
    budget: "Presupuesto detallado y uso de fondos",
    financial_model: "Modelo financiero y retorno proyectado",
    permits: "Permisos, licencias o no objeciones aplicables",
    tokenomics: "Tokenomics: supply, precio, simbolo y reglas",
    solana_mint: "Mint Solana devnet/mainnet y metadata del token",
    public_content: "Contenido publico, imagenes y documentos visibles",
    final_review: "Revision final antes de publicar o abrir inversion"
  },
  en: {
    owner_kyb: "KYB for owner or issuing company",
    legal_owner: "Documented legal ownership or economic right",
    legal_opinion: "Legal opinion on tokenization structure",
    budget: "Detailed budget and use of funds",
    financial_model: "Financial model and projected return",
    permits: "Applicable permits, licenses, or no-objection letters",
    tokenomics: "Tokenomics: supply, price, symbol, and rules",
    solana_mint: "Solana devnet/mainnet mint and token metadata",
    public_content: "Public content, images, and visible documents",
    final_review: "Final review before publication or opening investment"
  },
  de: {
    owner_kyb: "KYB des Inhabers oder der emittierenden Gesellschaft",
    legal_owner: "Dokumentiertes Eigentum oder wirtschaftliches Recht",
    legal_opinion: "Rechtsgutachten zur Tokenisierungsstruktur",
    budget: "Detailliertes Budget und Mittelverwendung",
    financial_model: "Finanzmodell und erwartete Rendite",
    permits: "Anwendbare Genehmigungen, Lizenzen oder No-Objection-Schreiben",
    tokenomics: "Tokenomics: Supply, Preis, Symbol und Regeln",
    solana_mint: "Solana Devnet/Mainnet Mint und Token-Metadata",
    public_content: "Oeffentliche Inhalte, Bilder und sichtbare Dokumente",
    final_review: "Finale Pruefung vor Veroeffentlichung oder Investitionsstart"
  },
  fr: {
    owner_kyb: "KYB du porteur ou de la societe emettrice",
    legal_owner: "Propriete legale ou droit economique documente",
    legal_opinion: "Avis juridique sur la structure de tokenisation",
    budget: "Budget detaille et utilisation des fonds",
    financial_model: "Modele financier et rendement projete",
    permits: "Permis, licences ou lettres de non-objection applicables",
    tokenomics: "Tokenomics : supply, prix, symbole et regles",
    solana_mint: "Mint Solana devnet/mainnet et metadata du token",
    public_content: "Contenu public, images et documents visibles",
    final_review: "Verification finale avant publication ou ouverture de l'investissement"
  }
};

const cacaoSlides = [
  "/cacao/cacao-tree.webp",
  "/cacao/cacao-pods-close.jpg",
  "/cacao/cacao-branch.webp"
];

const cacaoText = {
  es: {
    logoSub: "Token Bayaguana",
    nav: { token: "Token", funds: "Fondos", roadmap: "Ruta", readiness: "Readiness", invest: "Invertir" },
    heroEyebrow: "Tokenizacion agricola / Bayaguana",
    heroLead: "Proyecto de finca de cacao tokenizada para probar inversion fraccionada, emision en Solana devnet, seguimiento transparente del expediente y capital operativo para produccion agricola.",
    buy: "Comprar tokens CACAO",
    explore: "Explorar token",
    tokenTitle: "Tokenizacion agricola para una finca de cacao en Bayaguana.",
    tokenLead: "El token CACAO representa una participacion economica digital de prueba vinculada al desarrollo productivo de la finca, mantenimiento operativo, preparacion de cosecha y formalizacion comercial.",
    tokenPrice: "precio por token demo",
    mintPending: "Mint Solana en preparacion",
    cards: [
      ["Produccion", "Capital para mejoras productivas, mantenimiento agricola, herramientas, preparacion de cosecha y organizacion operativa."],
      ["Token", "Supply configurado de {supply} {symbol}, con compras fraccionarias para pruebas en Solana devnet."],
      ["Seguimiento", "Readiness, documentos, mint, pagos y emision de tokens se verifican desde Tokenizas Dominicana."]
    ],
    fundsTitle: "Uso de fondos",
    targetTitle: "Meta inicial: {target}",
    fundsLead: "La ronda demo busca validar el flujo completo: interes del inversionista, pago en Solana devnet, emision SPL y balance visible en wallet.",
    fundRows: ["Mejoras y mantenimiento agricola", "Preparacion de cosecha y operacion", "Formalizacion, documentos y seguimiento", "Reserva operativa"],
    roundProgress: "Progreso de ronda",
    reserved: "Reservado",
    target: "Meta",
    minimum: "Minimo",
    roadmap: "Plan de ejecucion",
    roadmapItems: [
      ["Expediente", "Completar documentos, permisos y revision del proyecto."],
      ["Tokenizacion", "Crear mint, metadata y flujo de emision controlada."],
      ["Produccion", "Ejecutar mejoras de finca y seguimiento operativo."],
      ["Reportes", "Publicar avances, balances y resultados de la ronda demo."]
    ],
    offering: "Oferta",
    structure: "Estructura de inversion",
    keyData: "Datos clave",
    status: "Estado",
    supply: "Supply",
    yield: "Rendimiento esperado",
    risk: "Riesgo",
    readinessTitle: "Checklist profesional",
    readinessLead: "Resumen publico del expediente del proyecto.",
    documents: "Documentos",
    docsPending: "Documentos en preparacion.",
    requestInfo: "Solicitar informacion",
    investProject: "Invertir en este proyecto"
  },
  en: {
    logoSub: "Bayaguana Token",
    nav: { token: "Token", funds: "Funds", roadmap: "Roadmap", readiness: "Readiness", invest: "Invest" },
    heroEyebrow: "Agricultural tokenization / Bayaguana",
    heroLead: "A tokenized cacao farm project designed to test fractional investment, Solana devnet issuance, transparent readiness tracking, and operating capital for agricultural production.",
    buy: "Buy CACAO tokens",
    explore: "Explore token",
    tokenTitle: "Agricultural tokenization for a cacao farm in Bayaguana.",
    tokenLead: "CACAO is a demo digital economic participation token linked to farm productivity improvements, operating maintenance, harvest preparation, and commercial formalization.",
    tokenPrice: "demo price per token",
    mintPending: "Solana mint in preparation",
    cards: [
      ["Production", "Capital for productive improvements, farm maintenance, tools, harvest preparation, and operating organization."],
      ["Token", "Configured supply of {supply} {symbol}, with fractional purchases for Solana devnet testing."],
      ["Tracking", "Readiness, documents, mint, payments, and token issuance are verified through Tokenizas Dominicana."]
    ],
    fundsTitle: "Use of funds",
    targetTitle: "Initial target: {target}",
    fundsLead: "The demo round validates the full flow: investor interest, Solana devnet payment, SPL issuance, and wallet-visible balance.",
    fundRows: ["Agricultural improvements and maintenance", "Harvest preparation and operations", "Formalization, documents, and tracking", "Operating reserve"],
    roundProgress: "Round progress",
    reserved: "Reserved",
    target: "Target",
    minimum: "Minimum",
    roadmap: "Execution roadmap",
    roadmapItems: [
      ["File", "Complete documents, permits, and project review."],
      ["Tokenization", "Create mint, metadata, and controlled issuance flow."],
      ["Production", "Execute farm improvements and operating tracking."],
      ["Reports", "Publish progress, balances, and demo round results."]
    ],
    offering: "Offering",
    structure: "Investment structure",
    keyData: "Key data",
    status: "Status",
    supply: "Supply",
    yield: "Expected yield",
    risk: "Risk",
    readinessTitle: "Professional checklist",
    readinessLead: "Public summary of the project file.",
    documents: "Documents",
    docsPending: "Documents in preparation.",
    requestInfo: "Request information",
    investProject: "Invest in this project"
  },
  de: {
    logoSub: "Bayaguana Token",
    nav: { token: "Token", funds: "Mittel", roadmap: "Plan", readiness: "Readiness", invest: "Investieren" },
    heroEyebrow: "Landwirtschaftliche Tokenisierung / Bayaguana",
    heroLead: "Ein tokenisiertes Kakaofarm-Projekt zum Testen fraktionierter Investitionen, Solana-Devnet-Ausgabe, transparenter Readiness-Pruefung und Betriebskapital fuer landwirtschaftliche Produktion.",
    buy: "CACAO Tokens kaufen",
    explore: "Token ansehen",
    tokenTitle: "Landwirtschaftliche Tokenisierung fuer eine Kakaofarm in Bayaguana.",
    tokenLead: "CACAO ist ein Demo-Token fuer digitale wirtschaftliche Beteiligung, verbunden mit Produktivitaetsverbesserungen, Betriebspflege, Erntevorbereitung und kommerzieller Formalisierung.",
    tokenPrice: "Demo-Preis pro Token",
    mintPending: "Solana Mint in Vorbereitung",
    cards: [
      ["Produktion", "Kapital fuer produktive Verbesserungen, Farmwartung, Werkzeuge, Erntevorbereitung und operative Organisation."],
      ["Token", "Konfigurierter Supply von {supply} {symbol}, mit fraktionierten Kaeufen fuer Solana-Devnet-Tests."],
      ["Tracking", "Readiness, Dokumente, Mint, Zahlungen und Token-Ausgabe werden ueber Tokenizas Dominicana verifiziert."]
    ],
    fundsTitle: "Mittelverwendung",
    targetTitle: "Anfangsziel: {target}",
    fundsLead: "Die Demo-Runde validiert den kompletten Ablauf: Investoreninteresse, Solana-Devnet-Zahlung, SPL-Ausgabe und sichtbarer Wallet-Bestand.",
    fundRows: ["Landwirtschaftliche Verbesserungen und Wartung", "Erntevorbereitung und Betrieb", "Formalisierung, Dokumente und Tracking", "Operative Reserve"],
    roundProgress: "Rundenfortschritt",
    reserved: "Reserviert",
    target: "Ziel",
    minimum: "Minimum",
    roadmap: "Ausfuehrungsplan",
    roadmapItems: [
      ["Akte", "Dokumente, Genehmigungen und Projektpruefung abschliessen."],
      ["Tokenisierung", "Mint, Metadata und kontrollierten Ausgabeprozess erstellen."],
      ["Produktion", "Farmverbesserungen und operatives Tracking ausfuehren."],
      ["Berichte", "Fortschritte, Bestaende und Ergebnisse der Demo-Runde veroeffentlichen."]
    ],
    offering: "Angebot",
    structure: "Investitionsstruktur",
    keyData: "Kerndaten",
    status: "Status",
    supply: "Supply",
    yield: "Erwartete Rendite",
    risk: "Risiko",
    readinessTitle: "Professionelle Checkliste",
    readinessLead: "Oeffentliche Zusammenfassung der Projektakte.",
    documents: "Dokumente",
    docsPending: "Dokumente in Vorbereitung.",
    requestInfo: "Informationen anfordern",
    investProject: "In dieses Projekt investieren"
  },
  fr: {
    logoSub: "Token Bayaguana",
    nav: { token: "Token", funds: "Fonds", roadmap: "Plan", readiness: "Readiness", invest: "Investir" },
    heroEyebrow: "Tokenisation agricole / Bayaguana",
    heroLead: "Projet de ferme de cacao tokenisee pour tester l'investissement fractionne, l'emission sur Solana devnet, le suivi transparent du dossier et le capital operationnel agricole.",
    buy: "Acheter des tokens CACAO",
    explore: "Explorer le token",
    tokenTitle: "Tokenisation agricole pour une ferme de cacao a Bayaguana.",
    tokenLead: "CACAO est un token demo de participation economique numerique lie aux ameliorations productives, a l'entretien operationnel, a la preparation de recolte et a la formalisation commerciale.",
    tokenPrice: "prix demo par token",
    mintPending: "Mint Solana en preparation",
    cards: [
      ["Production", "Capital pour ameliorations productives, entretien agricole, outils, preparation de recolte et organisation operationnelle."],
      ["Token", "Supply configure de {supply} {symbol}, avec achats fractionnes pour tests sur Solana devnet."],
      ["Suivi", "Readiness, documents, mint, paiements et emission de tokens sont verifies via Tokenizas Dominicana."]
    ],
    fundsTitle: "Utilisation des fonds",
    targetTitle: "Objectif initial : {target}",
    fundsLead: "La ronde demo valide le flux complet : interet investisseur, paiement Solana devnet, emission SPL et solde visible dans le wallet.",
    fundRows: ["Ameliorations agricoles et entretien", "Preparation de recolte et operations", "Formalisation, documents et suivi", "Reserve operationnelle"],
    roundProgress: "Progression de la ronde",
    reserved: "Reserve",
    target: "Objectif",
    minimum: "Minimum",
    roadmap: "Plan d'execution",
    roadmapItems: [
      ["Dossier", "Completer documents, permis et verification du projet."],
      ["Tokenisation", "Creer mint, metadata et flux d'emission controlee."],
      ["Production", "Executer les ameliorations de la ferme et le suivi operationnel."],
      ["Rapports", "Publier les avances, soldes et resultats de la ronde demo."]
    ],
    offering: "Offre",
    structure: "Structure d'investissement",
    keyData: "Donnees cles",
    status: "Statut",
    supply: "Supply",
    yield: "Rendement attendu",
    risk: "Risque",
    readinessTitle: "Checklist professionnelle",
    readinessLead: "Resume public du dossier projet.",
    documents: "Documents",
    docsPending: "Documents en preparation.",
    requestInfo: "Demander des informations",
    investProject: "Investir dans ce projet"
  }
};

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

function cacaoT(req) {
  return cacaoText[getLang(req)] || cacaoText.es;
}

function checklistLabel(item, req) {
  return (checklistText[getLang(req)] || checklistText.es)[item.item_key] || item.label;
}

function formatText(template, values) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] || "");
}

function cacaoLanguageSwitch(req) {
  const current = getLang(req);
  return `<div class="cacaoLang">${["es", "en", "de", "fr"].map((lang) => `<a class="${current === lang ? "active" : ""}" href="?lang=${lang}#inicio"><span>${languageFlags[lang]}</span>${lang.toUpperCase()}</a>`).join("")}</div>`;
}

function cacaoLogo(req) {
  const t = cacaoT(req);
  return `<a class="cacaoLogo" href="#inicio" aria-label="CACAO Bayaguana">
    <span class="cacaoMark">CB</span>
    <span><strong>CACAO</strong><em>${t.logoSub}</em></span>
  </a>`;
}

function cacaoNav(req, tokenizasUrl, project) {
  const t = cacaoT(req);
  return `<header class="cacaoNav">
    ${cacaoLogo(req)}
    <nav>
      <a href="#token">${t.nav.token}</a>
      <a href="#fondos">${t.nav.funds}</a>
      <a href="#roadmap">${t.nav.roadmap}</a>
      <a href="#readiness">${t.nav.readiness}</a>
      <a href="${tokenizasUrl}/projects/${project.slug}?lang=${getLang(req)}#invertir">${t.nav.invest}</a>
    </nav>
    ${cacaoLanguageSwitch(req)}
  </header>`;
}

function cacaoHero(req, project, tokenizasUrl) {
  const t = cacaoT(req);
  return `<section class="cacaoHero" id="inicio">
    <div class="cacaoSlider" aria-hidden="true">
      ${cacaoSlides.map((src, index) => `<img src="${src}" alt="" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />`).join("")}
    </div>
    ${cacaoNav(req, tokenizasUrl, project)}
    <div class="cacaoHeroContent">
      <p class="eyebrow">${t.heroEyebrow}</p>
      <h1>CACAO Bayaguana</h1>
      <p class="lead">${t.heroLead}</p>
      <div class="actions">
        <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}?lang=${getLang(req)}#invertir">${t.buy}</a>
        <a class="button" href="#token">${t.explore}</a>
      </div>
    </div>
  </section>`;
}

function cacaoMicrositeSections(req, project, offering, mint, raisedPct, tokenizasUrl) {
  const t = cacaoT(req);
  const hardCap = offering.hard_cap || project.target_raise;
  const values = { supply: number.format(project.token_supply), symbol: project.token_symbol, target: money.format(project.target_raise) };
  return `
    <section class="farmTokenBand" id="token">
      <div>
        <p class="eyebrow">CACAO Token</p>
        <h2>${t.tokenTitle}</h2>
        <p>${t.tokenLead}</p>
      </div>
      <div class="tokenGlass">
        <span>${project.token_symbol}</span>
        <strong>${money.format(project.token_price)}</strong>
        <p>${t.tokenPrice}</p>
        ${mint ? `<small>${mint.mint_address}</small>` : `<small>${t.mintPending}</small>`}
      </div>
    </section>
    <section class="farmGrid">
      ${t.cards.map(([title, text], index) => `<article><span>0${index + 1}</span><h3>${title}</h3><p>${formatText(text, values)}</p></article>`).join("")}
    </section>
    <section class="microSection farmUseFunds" id="fondos">
      <div>
        <p class="eyebrow">${t.fundsTitle}</p>
        <h2>${formatText(t.targetTitle, values)}</h2>
        <p>${t.fundsLead}</p>
        <div class="fundRows">
          ${t.fundRows.map((label, index) => `<div><span>${label}</span><strong>${[40, 30, 20, 10][index]}%</strong></div>`).join("")}
        </div>
      </div>
      <aside class="panel">
        <h3>${t.roundProgress}</h3>
        <div class="progress"><span style="width:${raisedPct}%"></span></div>
        <div class="fact"><span>${t.reserved}</span><strong>${money.format(offering.raised || 0)}</strong></div>
        <div class="fact"><span>${t.target}</span><strong>${money.format(hardCap)}</strong></div>
        <div class="fact"><span>${t.minimum}</span><strong>${money.format(project.min_investment)}</strong></div>
        <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}?lang=${getLang(req)}#invertir">${t.buy}</a>
      </aside>
    </section>
    <section class="farmRoadmap" id="roadmap">
      <p class="eyebrow">Roadmap</p>
      <h2>${t.roadmap}</h2>
      <div>${t.roadmapItems.map(([title, text], index) => `<article><span>Q${index + 1}</span><h3>${title}</h3><p>${text}</p></article>`).join("")}</div>
    </section>
  `;
}

function genericMicrositeHero(project, tokenizasUrl, req) {
  const t = cacaoT(req);
  return `<section class="microHero">
    <div class="microHeroMedia"><img src="${project.image_url}" alt="${project.title}" /></div>
    <div class="microHeroContent">
      <a class="microBrand" href="${tokenizasUrl}"><img src="/tokenizas-dominicana-logo.png" alt="Tokenizas Dominicana" /></a>
      <p class="eyebrow">${project.category || "Proyecto tokenizado"} / ${project.location}</p>
      <h1>${project.title}</h1>
      <p class="lead">${project.description}</p>
      <div class="actions">
        <a class="button primary" href="${tokenizasUrl}/projects/${project.slug}?lang=${getLang(req)}#invertir">${t.investProject}</a>
        <a class="button" href="${tokenizasUrl}/contact?lang=${getLang(req)}">${t.requestInfo}</a>
      </div>
    </div>
  </section>`;
}

function micrositeHtml(req, project) {
  const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]) || {};
  const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [project.id]);
  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [project.id]);
  const checklist = getProjectChecklist(project.id, true);
  const progress = checklistProgress(checklist);
  const raisedPct = Math.min(100, Math.round((Number(offering.raised || 0) / Number(offering.hard_cap || project.target_raise || 1)) * 100));
  const tokenizasUrl = config.siteUrl;
  const t = cacaoT(req);
  return `<!doctype html>
  <html lang="${getLang(req)}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${project.title} | Tokenizas Dominicana</title>
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>
      <main class="microSite">
        ${project.slug === "finca-cacao-bayaguana" ? cacaoHero(req, project, tokenizasUrl) : genericMicrositeHero(project, tokenizasUrl, req)}
        <section class="microStats">
          <article><span>${t.target}</span><strong>${money.format(project.target_raise)}</strong></article>
          <article><span>Token</span><strong>${project.token_symbol}</strong></article>
          <article><span>${t.tokenPrice}</span><strong>${money.format(project.token_price)}</strong></article>
          <article><span>Readiness</span><strong>${progress.percent}%</strong></article>
        </section>
        ${project.slug === "finca-cacao-bayaguana" ? cacaoMicrositeSections(req, project, offering, mint, raisedPct, tokenizasUrl) : ""}
        <section class="microSection">
          <div>
            <p class="eyebrow">${t.offering}</p>
            <h2>${t.structure}</h2>
            <p>${project.legal_structure}</p>
            <div class="progress"><span style="width:${raisedPct}%"></span></div>
            <p class="muted">${money.format(offering.raised || 0)} / ${money.format(offering.hard_cap || project.target_raise)}</p>
          </div>
          <aside class="panel">
            <h3>${t.keyData}</h3>
            <div class="fact"><span>${t.status}</span><strong>${statusLabel(project.status, req)}</strong></div>
            <div class="fact"><span>${t.supply}</span><strong>${number.format(project.token_supply)}</strong></div>
            <div class="fact"><span>${t.yield}</span><strong>${project.expected_yield}%</strong></div>
            <div class="fact"><span>${t.risk}</span><strong>${project.risk_level}</strong></div>
            ${mint ? `<div class="fact"><span>Mint</span><strong class="monoBreak">${mint.mint_address}</strong></div>` : ""}
          </aside>
        </section>
        <section class="microSection" id="readiness">
          <div class="panel readinessPanel">
            <div class="checklistHeader">
              <div><p class="eyebrow">Readiness</p><h3>${t.readinessTitle}</h3><p class="muted">${t.readinessLead}</p></div>
              <strong>${progress.percent}%</strong>
            </div>
            <div class="progress compactProgress"><span style="width:${progress.percent}%"></span></div>
            <div class="ownerChecklist">${checklist.map((item) => `<div class="ownerCheckItem ${item.status}"><b>${checklistLabel(item, req)}</b><span>${statusLabel(item.status, req)}</span></div>`).join("")}</div>
          </div>
          <aside class="panel">
            <h3>${t.documents}</h3>
            ${docs.map((doc) => `<div class="row"><span>${doc.title}</span><b>${statusLabel(doc.status, req)}</b></div>`).join("") || `<p class="muted">${t.docsPending}</p>`}
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
