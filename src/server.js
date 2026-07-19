const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./db");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFile();

const app = express();
const port = process.env.PORT || 3000;
const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "TokenizasAdmin2026!";
const sessionSecret = process.env.SESSION_SECRET || "change-this-tokenizas-secret";
const whatsappNumber = process.env.WHATSAPP_NUMBER || "18090000000";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use((req, res, next) => {
  if (req.query.lang && ["es", "en", "de", "fr"].includes(req.query.lang)) {
    res.setHeader("Set-Cookie", `tokenizas_lang=${req.query.lang}; Path=/; SameSite=Lax; Max-Age=31536000`);
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tokenizas-dominicana" });
});

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

const i18n = {
  es: {
    projects: "Proyectos", invest: "Invertir", dashboard: "Dashboard", legal: "Ley RD", login: "Login",
    contact: "Contacto", whatsapp: "WhatsApp",
    heroEyebrow: "Tokenizacion inmobiliaria en Solana",
    heroTitle: "Invierte de forma fraccionada en proyectos inmobiliarios dominicanos.",
    heroLead: "Plataforma demo para originar activos, validar inversionistas, estructurar ofertas, emitir tokens controlados y administrar distribuciones.",
    viewProjects: "Ver proyectos", createOrder: "Crear orden", pilotProjects: "Proyectos piloto", targetCapital: "Capital objetivo", reservedCapital: "Capital reservado",
    pipeline: "Pipeline", readyAssets: "Activos listos para pruebas", legalTitle: "Marco legal sobre tokens en Republica Dominicana",
    legalLead: "Republica Dominicana no tiene una ley cripto integral especifica para tokenizacion inmobiliaria. El camino prudente es estructurar ofertas que puedan calificar como valores bajo la Ley 249-17 y la supervision de la SIMV, con KYC/AML, prospecto/documentacion y proteccion al inversionista. Los criptoactivos no son moneda de curso legal ni tienen respaldo del Banco Central.",
    legal1: "Un token inmobiliario no debe presentarse como titulo de propiedad registrado. Normalmente representa un derecho economico, contractual o participacion en un vehiculo legal.",
    legal2: "Si el token funciona como valor mobiliario, debe revisarse con asesores legales y, cuando aplique, con la Superintendencia del Mercado de Valores.",
    legal3: "La plataforma debe separar claramente registro legal, contratos, cap table interno y registro blockchain.",
    loginTitle: "Panel administrativo", loginLead: "Ingresa tus credenciales para administrar proyectos, KYC y auditoria.", privateAccess: "Acceso privado", username: "Usuario", password: "Clave", enter: "Entrar", logout: "Cerrar sesion"
    , contactTitle: "Solicita mas informacion", contactLead: "Cuéntanos sobre tu proyecto, inmueble o perfil de inversionista. Te contactaremos por email o WhatsApp.", name: "Nombre", company: "Empresa", email: "Email", phone: "WhatsApp", interest: "Interes", message: "Mensaje", consent: "Acepto ser contactado sobre Tokenizas Dominicana.", send: "Enviar solicitud", leadSaved: "Solicitud recibida. Te contactaremos pronto.", modulesTitle: "Una plataforma completa para tokenizar activos", modulesLead: "Integramos originacion, cumplimiento, contratos, inversionistas y operaciones en una sola experiencia.", backOffice: "Back office de activos", backOfficeText: "Gestion de cartera, documentos, estados de ofertas, solicitudes de inversionistas y registro de auditoria.", smartContracts: "Motor blockchain", smartContractsText: "Emision controlada de tokens en Solana, reglas de transferencia, whitelist y eventos verificables.", investorPortal: "Portal del inversionista", investorPortalText: "Dashboard con proyectos, tokens, ordenes, distribuciones y documentos relevantes.", landingPages: "Paginas por proyecto", landingPagesText: "Fichas comerciales optimizadas con imagenes, estructura legal, metricas, riesgos y llamados a inversion.", advantagesTitle: "Por que elegir Tokenizas Dominicana", useCasesTitle: "Casos de uso", demoTitle: "Agenda una consulta"
  },
  en: {
    projects: "Projects", invest: "Invest", dashboard: "Dashboard", legal: "DR Law", login: "Login",
    contact: "Contact", whatsapp: "WhatsApp",
    heroEyebrow: "Real estate tokenization on Solana",
    heroTitle: "Fractional access to Dominican real estate projects.",
    heroLead: "A demo platform to originate assets, validate investors, structure offerings, issue controlled tokens, and manage distributions.",
    viewProjects: "View projects", createOrder: "Create order", pilotProjects: "Pilot projects", targetCapital: "Target capital", reservedCapital: "Reserved capital",
    pipeline: "Pipeline", readyAssets: "Assets ready for testing", legalTitle: "Token law in the Dominican Republic",
    legalLead: "The Dominican Republic does not yet have a comprehensive crypto statute specifically for real estate tokenization. The prudent route is to structure offerings that may qualify as securities under Law 249-17 and SIMV supervision, with KYC/AML, disclosure documents, and investor protection. Cryptoassets are not legal tender and are not backed by the Central Bank.",
    legal1: "A real estate token should not be presented as a registered property title. It usually represents an economic, contractual, or vehicle-level right.",
    legal2: "If the token behaves as a security, it should be reviewed by counsel and, where applicable, the securities regulator.",
    legal3: "The platform must clearly separate the legal registry, contracts, internal cap table, and blockchain record.",
    loginTitle: "Admin panel", loginLead: "Enter your credentials to manage projects, KYC, and audit records.", privateAccess: "Private access", username: "Username", password: "Password", enter: "Sign in", logout: "Log out",
    contactTitle: "Request more information", contactLead: "Tell us about your project, property, or investor profile. We will contact you by email or WhatsApp.", name: "Name", company: "Company", email: "Email", phone: "WhatsApp", interest: "Interest", message: "Message", consent: "I agree to be contacted about Tokenizas Dominicana.", send: "Send request", leadSaved: "Request received. We will contact you soon.", modulesTitle: "A complete platform for asset tokenization", modulesLead: "Origination, compliance, contracts, investors, and operations in one experience.", backOffice: "Asset back office", backOfficeText: "Portfolio management, documents, offering status, investor requests, and audit records.", smartContracts: "Blockchain engine", smartContractsText: "Controlled Solana token issuance, transfer rules, whitelist, and verifiable events.", investorPortal: "Investor portal", investorPortalText: "Dashboard with projects, tokens, orders, distributions, and documents.", landingPages: "Project pages", landingPagesText: "Commercial pages with images, legal structure, metrics, risks, and investment calls to action.", advantagesTitle: "Why choose Tokenizas Dominicana", useCasesTitle: "Use cases", demoTitle: "Book a consultation"
  },
  de: {
    projects: "Projekte", invest: "Investieren", dashboard: "Dashboard", legal: "Recht RD", login: "Login",
    contact: "Kontakt", whatsapp: "WhatsApp",
    heroEyebrow: "Immobilien-Tokenisierung auf Solana",
    heroTitle: "Fraktionierter Zugang zu Immobilienprojekten in der Dominikanischen Republik.",
    heroLead: "Demo-Plattform fuer Asset-Originierung, Investorenpruefung, Angebotsstrukturierung, kontrollierte Token-Ausgabe und Ausschüttungen.",
    viewProjects: "Projekte ansehen", createOrder: "Order erstellen", pilotProjects: "Pilotprojekte", targetCapital: "Zielkapital", reservedCapital: "Reserviertes Kapital",
    pipeline: "Pipeline", readyAssets: "Assets fuer Tests bereit", legalTitle: "Token-Rechtslage in der Dominikanischen Republik",
    legalLead: "Die Dominikanische Republik hat noch kein umfassendes Kryptogesetz speziell fuer Immobilien-Tokenisierung. Der vorsichtige Weg ist eine Strukturierung als moegliches Wertpapier unter Gesetz 249-17 und SIMV-Aufsicht, mit KYC/AML, Offenlegungsunterlagen und Investorenschutz. Kryptoassets sind kein gesetzliches Zahlungsmittel und werden nicht von der Zentralbank garantiert.",
    legal1: "Ein Immobilien-Token sollte nicht als registrierter Eigentumstitel dargestellt werden. Meist repraesentiert er ein wirtschaftliches, vertragliches oder vehikelbezogenes Recht.",
    legal2: "Wenn der Token wie ein Wertpapier wirkt, sollte er rechtlich und gegebenenfalls mit der Wertpapieraufsicht geprueft werden.",
    legal3: "Die Plattform muss Grundbuch, Verträge, interne Beteiligungstabelle und Blockchain-Eintrag klar trennen.",
    loginTitle: "Adminbereich", loginLead: "Melde dich an, um Projekte, KYC und Auditdaten zu verwalten.", privateAccess: "Privater Zugang", username: "Benutzer", password: "Passwort", enter: "Einloggen", logout: "Abmelden",
    contactTitle: "Weitere Informationen anfordern", contactLead: "Erzaehle uns von deinem Projekt, deiner Immobilie oder deinem Anlegerprofil. Wir melden uns per E-Mail oder WhatsApp.", name: "Name", company: "Unternehmen", email: "E-Mail", phone: "WhatsApp", interest: "Interesse", message: "Nachricht", consent: "Ich stimme zu, zu Tokenizas Dominicana kontaktiert zu werden.", send: "Anfrage senden", leadSaved: "Anfrage erhalten. Wir melden uns bald.", modulesTitle: "Eine komplette Plattform fuer Asset-Tokenisierung", modulesLead: "Originierung, Compliance, Vertraege, Investoren und Betrieb in einer Erfahrung.", backOffice: "Asset Back Office", backOfficeText: "Portfolioverwaltung, Dokumente, Angebotsstatus, Investorenanfragen und Auditprotokolle.", smartContracts: "Blockchain Engine", smartContractsText: "Kontrollierte Solana-Token-Ausgabe, Transferregeln, Whitelist und pruefbare Events.", investorPortal: "Investorenportal", investorPortalText: "Dashboard mit Projekten, Tokens, Orders, Ausschüttungen und Dokumenten.", landingPages: "Projektseiten", landingPagesText: "Kommerzielle Seiten mit Bildern, Rechtsstruktur, Kennzahlen, Risiken und Investment-Aufrufen.", advantagesTitle: "Warum Tokenizas Dominicana", useCasesTitle: "Anwendungsfaelle", demoTitle: "Beratung buchen"
  },
  fr: {
    projects: "Projets", invest: "Investir", dashboard: "Tableau", legal: "Loi RD", login: "Connexion",
    contact: "Contact", whatsapp: "WhatsApp",
    heroEyebrow: "Tokenisation immobiliere sur Solana",
    heroTitle: "Acces fractionne aux projets immobiliers dominicains.",
    heroLead: "Plateforme de demo pour sourcer les actifs, verifier les investisseurs, structurer les offres, emettre des tokens controles et gerer les distributions.",
    viewProjects: "Voir les projets", createOrder: "Creer un ordre", pilotProjects: "Projets pilotes", targetCapital: "Capital cible", reservedCapital: "Capital reserve",
    pipeline: "Pipeline", readyAssets: "Actifs prets pour les tests", legalTitle: "Cadre juridique des tokens en Republique dominicaine",
    legalLead: "La Republique dominicaine ne dispose pas encore d'une loi crypto complete specifique a la tokenisation immobiliere. La voie prudente consiste a structurer les offres pouvant etre qualifiees de valeurs mobilieres sous la Loi 249-17 et la supervision de la SIMV, avec KYC/AML, documents d'information et protection des investisseurs. Les cryptoactifs ne sont pas une monnaie ayant cours legal et ne sont pas garantis par la Banque centrale.",
    legal1: "Un token immobilier ne doit pas etre presente comme un titre de propriete enregistre. Il represente generalement un droit economique, contractuel ou lie a un vehicule juridique.",
    legal2: "Si le token fonctionne comme une valeur mobiliere, il doit etre examine par des conseillers juridiques et, le cas echeant, par le regulateur des valeurs mobilieres.",
    legal3: "La plateforme doit separer clairement le registre legal, les contrats, le cap table interne et l'enregistrement blockchain.",
    loginTitle: "Panneau admin", loginLead: "Connectez-vous pour gerer les projets, KYC et journaux d'audit.", privateAccess: "Acces prive", username: "Utilisateur", password: "Mot de passe", enter: "Connexion", logout: "Deconnexion",
    contactTitle: "Demander plus d'informations", contactLead: "Parlez-nous de votre projet, bien immobilier ou profil investisseur. Nous vous contacterons par email ou WhatsApp.", name: "Nom", company: "Entreprise", email: "Email", phone: "WhatsApp", interest: "Interet", message: "Message", consent: "J'accepte d'etre contacte au sujet de Tokenizas Dominicana.", send: "Envoyer", leadSaved: "Demande recue. Nous vous contacterons bientot.", modulesTitle: "Une plateforme complete pour la tokenisation d'actifs", modulesLead: "Origination, conformite, contrats, investisseurs et operations dans une seule experience.", backOffice: "Back office actifs", backOfficeText: "Gestion de portefeuille, documents, statut des offres, demandes investisseurs et audit.", smartContracts: "Moteur blockchain", smartContractsText: "Emission controlee de tokens Solana, regles de transfert, whitelist et evenements verifiables.", investorPortal: "Portail investisseur", investorPortalText: "Tableau avec projets, tokens, ordres, distributions et documents.", landingPages: "Pages projet", landingPagesText: "Pages commerciales avec images, structure legale, indicateurs, risques et appels a investir.", advantagesTitle: "Pourquoi choisir Tokenizas Dominicana", useCasesTitle: "Cas d'utilisation", demoTitle: "Planifier une consultation"
  }
};

function getLang(req) {
  const queryLang = req.query.lang;
  if (queryLang && i18n[queryLang]) return queryLang;
  const cookieLang = parseCookies(req).tokenizas_lang;
  return i18n[cookieLang] ? cookieLang : "es";
}

function tr(req) {
  return i18n[getLang(req)];
}

function langSwitcher(req) {
  const current = getLang(req);
  return `<div class="langSwitch">${["es", "en", "de", "fr"].map((lang) => `<a class="${current === lang ? "active" : ""}" href="?lang=${lang}">${lang.toUpperCase()}</a>`).join("")}</div>`;
}

function layout(title, body, req) {
  const t = req ? tr(req) : i18n.es;
  return `<!doctype html>
  <html lang="${req ? getLang(req) : "es"}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} | Tokenizas Dominicana</title>
      <link rel="stylesheet" href="/styles.css" />
      <link rel="preconnect" href="https://images.unsplash.com">
    </head>
    <body>
      <header class="topbar">
        <a class="brand" href="/"><img src="/logo.svg" alt="Tokenizas Dominicana" /></a>
        <nav>
          <a href="/projects">${t.projects}</a>
          <a href="/invest">${t.invest}</a>
          <a href="/dashboard">${t.dashboard}</a>
          <a href="/legal">${t.legal}</a>
          <a href="/contact">${t.contact}</a>
        </nav>
        ${req ? langSwitcher(req) : ""}
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

function parseCookies(req) {
  return (req.headers.cookie || "").split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index === -1) return cookies;
    cookies[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return cookies;
  }, {});
}

function signSession(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function sessionCookieValue() {
  const payload = `${adminUser}:${Date.now()}`;
  return `${payload}.${signSession(payload)}`;
}

function isAdmin(req) {
  const token = parseCookies(req).tokenizas_admin;
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = signSession(payload);
  if (signature.length !== expectedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;
  const [user, issuedAt] = payload.split(":");
  const ageMs = Date.now() - Number(issuedAt);
  return user === adminUser && ageMs > 0 && ageMs < 1000 * 60 * 60 * 12;
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.redirect("/login");
}

function loginPage(req, error = "") {
  const t = tr(req);
  return layout("Login", `
    <main class="authPage">
      <form class="panel loginPanel" method="post" action="/login">
        <p class="eyebrow">${t.privateAccess}</p>
        <h1>${t.loginTitle}</h1>
        <p class="muted">${t.loginLead}</p>
        ${error ? `<div class="alert">${error}</div>` : ""}
        <label>${t.username}
          <input name="username" autocomplete="username" required />
        </label>
        <label>${t.password}
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="button primary" type="submit">${t.enter}</button>
      </form>
    </main>
  `, req);
}

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

app.get("/login", (req, res) => {
  if (isAdmin(req)) return res.redirect("/admin");
  res.send(loginPage(req));
});

app.post("/login", (req, res) => {
  if (req.body.username !== adminUser || req.body.password !== adminPassword) {
    return res.status(401).send(loginPage(req, "Usuario o clave incorrectos."));
  }

  res.setHeader("Set-Cookie", [
    `tokenizas_admin=${encodeURIComponent(sessionCookieValue())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  ]);
  res.redirect("/admin");
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "tokenizas_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.redirect("/login");
});

app.get("/legal", (req, res) => {
  const t = tr(req);
  res.send(layout(t.legalTitle, `
    <main>
      <section class="legalHero">
        <div class="sectionHead">
          <p class="eyebrow">${t.legal}</p>
          <h1>${t.legalTitle}</h1>
          <p class="lead">${t.legalLead}</p>
        </div>
      </section>
      <section class="legalGrid">
        <article class="panel lawCard">
          <strong>01</strong>
          <h3>Token != titulo</h3>
          <p>${t.legal1}</p>
        </article>
        <article class="panel lawCard">
          <strong>02</strong>
          <h3>Valores / securities</h3>
          <p>${t.legal2}</p>
        </article>
        <article class="panel lawCard">
          <strong>03</strong>
          <h3>Registro separado</h3>
          <p>${t.legal3}</p>
        </article>
      </section>
      <section class="panel legalNote">
        <h2>Fuentes regulatorias de referencia</h2>
        <p>Para produccion real se debe validar con abogados dominicanos, la Superintendencia del Mercado de Valores, la Direccion General de Impuestos Internos, la Unidad de Analisis Financiero y politicas del Banco Central sobre activos virtuales.</p>
      </section>
    </main>
  `, req));
});

app.get("/contact", (req, res) => {
  res.send(contactPage(req));
});

app.post("/contact", (req, res) => {
  const t = tr(req);
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const interest = String(req.body.interest || "").trim();
  if (!name || !email || !interest || req.body.consent !== "yes") {
    return res.status(400).send(contactPage(req, "Completa nombre, email, interes y consentimiento."));
  }

  store.run(`
    INSERT INTO leads (name, company, email, whatsapp, interest, message, consent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    name,
    String(req.body.company || "").trim(),
    email,
    String(req.body.whatsapp || "").trim(),
    interest,
    String(req.body.message || "").trim(),
    "yes",
    new Date().toISOString()
  ]);

  store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [
    name,
    "created_lead",
    "contact",
    `${interest} - ${email}`,
    new Date().toISOString()
  ]);

  res.send(contactPage(req, "", t.leadSaved));
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
  `, req));
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
  `, req));
});

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
      <div class="sectionHead">
        <p class="eyebrow">Orden de prueba</p>
        <h1>Crear una inversion tokenizada</h1>
        <p class="muted">Selecciona un proyecto, monto y metodo de pago. Esta pantalla simula la reserva y emision operativa para pruebas.</p>
      </div>
      <section class="investPage">
        <form class="panel investPanel" method="post" action="/invest">
          <h2>Nueva orden</h2>
          <label>Proyecto
            <select name="project_id">
              ${projects.map((project) => `<option value="${project.id}" ${defaultProject && defaultProject.id === project.id ? "selected" : ""}>${project.title} - ${project.token_symbol}</option>`).join("")}
            </select>
          </label>
          <label>Monto a invertir
            <input name="amount" type="number" min="100" step="100" value="${defaultProject ? defaultProject.min_investment : 1000}" />
          </label>
          <label>Metodo de pago
            <select name="payment_method">
              <option>USDC Solana</option>
              <option>Transferencia bancaria</option>
            </select>
          </label>
          <button class="button primary" type="submit">Crear orden</button>
        </form>
        <div class="panel">
          <h2>Proyectos disponibles</h2>
          ${projects.map((project) => {
            const raisedPct = project.hard_cap ? Math.min(100, Math.round((project.raised / project.hard_cap) * 100)) : 0;
            return `<article class="miniProject">
              <img src="${project.image_url}" alt="${project.title}" />
              <div>
                <div class="pill">${statusLabel(project.status)}</div>
                <h3>${project.title}</h3>
                <p>${project.location}</p>
                <div class="progress"><span style="width:${raisedPct}%"></span></div>
                <p class="muted">${money.format(project.raised || 0)} de ${money.format(project.hard_cap || project.target_raise)} reservados.</p>
                <a href="/projects/${project.slug}">Ver detalle</a>
              </div>
            </article>`;
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
  `, req));
});

app.get("/admin", requireAdmin, (req, res) => {
  const t = tr(req);
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
        <p><a class="button small" href="/logout">${t.logout}</a></p>
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
  `, req));
});

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
}

function featureCard(title, text, index) {
  return `<article class="featureCard">
    <strong>${index}</strong>
    <h3>${title}</h3>
    <p>${text}</p>
  </article>`;
}

function whatsappUrl(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function contactPage(req, error = "", success = "") {
  const t = tr(req);
  return layout(t.contactTitle, `
    <main class="page contactPage">
      <section class="contactIntro">
        <div>
          <p class="eyebrow">${t.demoTitle}</p>
          <h1>${t.contactTitle}</h1>
          <p class="lead">${t.contactLead}</p>
          <a class="button whatsapp" href="${whatsappUrl(t.contactTitle)}" target="_blank" rel="noopener">${t.whatsapp}</a>
        </div>
        <form class="panel contactForm" method="post" action="/contact">
          ${error ? `<div class="alert">${error}</div>` : ""}
          ${success ? `<div class="success">${success}</div>` : ""}
          <label>${t.name}
            <input name="name" required />
          </label>
          <label>${t.company}
            <input name="company" />
          </label>
          <label>${t.email}
            <input name="email" type="email" required />
          </label>
          <label>${t.phone}
            <input name="whatsapp" />
          </label>
          <label>${t.interest}
            <select name="interest" required>
              <option value="">Seleccionar</option>
              <option>Invertir en proyectos inmobiliarios</option>
              <option>Tokenizar un inmueble</option>
              <option>Crear plataforma white-label</option>
              <option>Alianza legal, financiera o tecnologica</option>
            </select>
          </label>
          <label>${t.message}
            <textarea name="message" rows="5"></textarea>
          </label>
          <label class="checkLine">
            <input name="consent" type="checkbox" value="yes" required />
            <span>${t.consent}</span>
          </label>
          <button class="button primary" type="submit">${t.send}</button>
        </form>
      </section>
    </main>
  `, req);
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
