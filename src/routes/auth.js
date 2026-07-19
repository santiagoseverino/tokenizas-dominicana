const { adminPassword, adminUser, isAdmin, sessionCookieValue } = require("../middleware/auth");
const { tr } = require("../lib/i18n");
const { layout } = require("../lib/ui");

function loginPage(req, error = "") {
  const t = tr(req);
  return layout("Login", `
    <main class="authPage">
      <form class="panel loginPanel" method="post" action="/login">
        <p class="eyebrow">${t.privateAccess}</p>
        <h1>${t.loginTitle}</h1>
        <p class="muted">${t.loginLead}</p>
        ${error ? `<div class="alert">${error}</div>` : ""}
        <label>${t.username}<input name="username" autocomplete="username" required /></label>
        <label>${t.password}<input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="button primary" type="submit">${t.enter}</button>
      </form>
    </main>
  `, req);
}

function registerAuthRoutes(app) {
  app.get("/login", (req, res) => {
    if (isAdmin(req)) return res.redirect("/admin");
    res.send(loginPage(req));
  });

  app.post("/login", (req, res) => {
    if (req.body.username !== adminUser || req.body.password !== adminPassword) {
      return res.status(401).send(loginPage(req, "Usuario o clave incorrectos."));
    }
    res.setHeader("Set-Cookie", `tokenizas_admin=${encodeURIComponent(sessionCookieValue())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
    res.redirect("/admin");
  });

  app.get("/logout", (req, res) => {
    res.setHeader("Set-Cookie", "tokenizas_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    res.redirect("/login");
  });
}

module.exports = registerAuthRoutes;
