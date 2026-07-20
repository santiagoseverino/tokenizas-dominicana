const { getLang, tr } = require("./i18n");
const { money, number, statusLabel } = require("./format");
const { whatsappNumber } = require("../config");

function langSwitcher(req) {
  const current = getLang(req);
  return `<div class="langSwitch">${["es", "en", "de", "fr"].map((lang) => `<a class="${current === lang ? "active" : ""}" href="?lang=${lang}">${lang.toUpperCase()}</a>`).join("")}</div>`;
}

function layout(title, body, req) {
  const t = req ? tr(req) : tr({ query: {}, cookies: {} });
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
              <a href="/projects?category=real-estate">Bienes raices</a>
              <a href="/projects?category=agriculture">Agricultura</a>
              <a href="/projects?category=art">Arte</a>
              <a href="/projects?category=music">Musica</a>
              <a href="/projects?category=tourism">Turismo</a>
              <a href="/projects?category=business">Negocios</a>
              <a href="/projects?category=energy">Energia</a>
            </div>
          </div>
          <a href="/marketplace">Marketplace</a>
          <a href="/invest">${t.invest}</a>
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
