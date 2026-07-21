const { getLang, tr } = require("./i18n");
const { money, number, statusLabel } = require("./format");
const { whatsappNumber } = require("../config");

function langSwitcher(req) {
  const current = getLang(req);
  const flags = { es: "/flags/es.svg", en: "/flags/en.svg", de: "/flags/de.svg", fr: "/flags/fr.svg" };
  return `<div class="langSwitch">${["es", "en", "de", "fr"].map((lang) => `<a class="${current === lang ? "active" : ""}" href="?lang=${lang}"><img src="${flags[lang]}" alt="${lang.toUpperCase()}" loading="lazy" decoding="async" />${lang.toUpperCase()}</a>`).join("")}</div>`;
}

function layout(title, body, req) {
  const t = req ? tr(req) : tr({ query: {}, cookies: {} });
  const categories = t.categoryLabels || {};
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
        <a class="brand" href="/"><img src="/tokenizas-dominicana-logo.png" alt="Tokenizas Dominicana" width="439" height="203" /></a>
        <nav>
          <div class="navDrop">
            <a href="/projects">${t.projects}</a>
            <div class="dropMenu">
              <a href="/projects?category=real-estate">${categories["real-estate"]}</a>
              <a href="/projects?category=agriculture">${categories.agriculture}</a>
              <a href="/projects?category=art">${categories.art}</a>
              <a href="/projects?category=music">${categories.music}</a>
              <a href="/projects?category=tourism">${categories.tourism}</a>
              <a href="/projects?category=health-wellness">${categories["health-wellness"]}</a>
              <a href="/projects?category=business">${categories.business}</a>
              <a href="/projects?category=energy">${categories.energy}</a>
            </div>
          </div>
          <a href="/marketplace">Marketplace</a>
          <a href="/invest">${t.invest}</a>
          <a href="/investor/login">${t.investorAccess || t.investor.login}</a>
          <a href="/issuer/apply">${t.tokenize}</a>
          <a href="/investor">${t.dashboard}</a>
          <a href="/legal">${t.legal}</a>
          <a href="/contact">${t.contact}</a>
        </nav>
        ${req ? langSwitcher(req) : ""}
      </header>
      ${body}
    </body>
  </html>`;
}

function projectCard(project, req) {
  const t = req ? tr(req) : tr({ query: {}, cookies: {} });
  const projectText = t.projectPages || {};
  return `<article class="card">
    <img src="${project.image_url}" alt="${project.title}" />
    <div class="cardBody">
      <div class="pill">${statusLabel(project.status, req)}</div>
      <h3>${project.title}</h3>
      <p>${project.location}</p>
      <div class="cardStats">
        <span>${money.format(project.min_investment)} ${projectText.minimum || "Minimo"}</span>
        <span>${project.expected_yield}% ${projectText.expectedYield || "Yield esperado"}</span>
      </div>
      <a class="button small" href="/projects/${project.slug}">${projectText.open || t.viewProjects}</a>
    </div>
  </article>`;
}

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

module.exports = { layout, projectCard, fact, featureCard, whatsappUrl, money, number, statusLabel };
