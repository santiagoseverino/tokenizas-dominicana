const { tr } = require("../lib/i18n");
const { layout } = require("../lib/ui");

function registerLegalRoutes(app) {
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
          <article class="panel lawCard"><strong>01</strong><h3>Token != titulo</h3><p>${t.legal1}</p></article>
          <article class="panel lawCard"><strong>02</strong><h3>Valores / securities</h3><p>${t.legal2}</p></article>
          <article class="panel lawCard"><strong>03</strong><h3>Registro separado</h3><p>${t.legal3}</p></article>
        </section>
        <section class="panel legalNote">
          <h2>Fuentes regulatorias de referencia</h2>
          <p>Para produccion real se debe validar con abogados dominicanos, la Superintendencia del Mercado de Valores, la Direccion General de Impuestos Internos, la Unidad de Analisis Financiero y politicas del Banco Central sobre activos virtuales.</p>
        </section>
      </main>
    `, req));
  });
}

module.exports = registerLegalRoutes;
