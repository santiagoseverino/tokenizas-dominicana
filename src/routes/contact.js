const store = require("../db");
const { notifyLead } = require("../lib/notifications");
const { tr } = require("../lib/i18n");
const { layout, whatsappUrl } = require("../lib/ui");

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
          <label>${t.name}<input name="name" required /></label>
          <label>${t.company}<input name="company" /></label>
          <label>${t.email}<input name="email" type="email" required /></label>
          <label>${t.phone}<input name="whatsapp" /></label>
          <label>${t.interest}<select name="interest" required><option value="">Seleccionar</option><option>Invertir en proyectos inmobiliarios</option><option>Tokenizar un inmueble</option><option>Crear plataforma white-label</option><option>Alianza legal, financiera o tecnologica</option></select></label>
          <label>${t.message}<textarea name="message" rows="5"></textarea></label>
          <label class="checkLine"><input name="consent" type="checkbox" value="yes" required /><span>${t.consent}</span></label>
          <button class="button primary" type="submit">${t.send}</button>
        </form>
      </section>
    </main>
  `, req);
}

function registerContactRoutes(app) {
  app.get("/contact", (req, res) => res.send(contactPage(req)));

  app.post("/contact", (req, res) => {
    const t = tr(req);
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim();
    const interest = String(req.body.interest || "").trim();
    if (!name || !email || !interest || req.body.consent !== "yes") {
      return res.status(400).send(contactPage(req, "Completa nombre, email, interes y consentimiento."));
    }
    const lead = {
      name,
      company: String(req.body.company || "").trim(),
      email,
      whatsapp: String(req.body.whatsapp || "").trim(),
      interest,
      message: String(req.body.message || "").trim()
    };
    store.run("INSERT INTO leads (name, company, email, whatsapp, interest, message, consent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      name,
      lead.company,
      email,
      lead.whatsapp,
      interest,
      lead.message,
      "yes",
      "new",
      new Date().toISOString()
    ]);
    notifyLead(lead);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [name, "created_lead", "contact", `${interest} - ${email}`, new Date().toISOString()]);
    res.send(contactPage(req, "", t.leadSaved));
  });
}

module.exports = registerContactRoutes;
