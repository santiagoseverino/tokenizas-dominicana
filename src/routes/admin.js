const store = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { toCsv } = require("../lib/csv");
const { tr } = require("../lib/i18n");
const { layout, money, statusLabel } = require("../lib/ui");

function registerAdminRoutes(app) {
  app.get("/admin", requireAdmin, (req, res) => {
    const t = tr(req);
    const projects = store.all("SELECT p.*, o.raised FROM projects p LEFT JOIN offerings o ON o.project_id = p.id ORDER BY p.id");
    const users = store.all("SELECT * FROM users ORDER BY id");
    const logs = store.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8");
    const leads = store.all("SELECT * FROM leads ORDER BY id DESC LIMIT 8");
    res.send(layout("Admin", `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">Back office</p><h1>Control operativo</h1><p><a class="button small" href="/admin/settings">Configuracion</a> <a class="button small" href="/logout">${t.logout}</a></p></div>
        <section class="split">
          <div class="panel"><h3>Proyectos</h3>${projects.map((project) => `<div class="row"><span>${project.title}</span><b>${money.format(project.raised || 0)}</b></div>`).join("")}</div>
          <div class="panel"><h3>KYC / KYB</h3>${users.map((user) => `<div class="row"><span>${user.name}</span><b>${statusLabel(user.kyc_status)}</b></div>`).join("")}</div>
        </section>
        <section class="split">
          <div class="panel"><h3>Interesados</h3>${leads.map((lead) => `<div class="event"><b>${lead.name}</b><span>${lead.email} - ${lead.whatsapp || "sin WhatsApp"}</span><p>${lead.interest}</p><a href="/admin/leads/${lead.id}">Ver detalle</a></div>`).join("") || "<p class=\"muted\">Sin solicitudes todavia.</p>"}<p><a class="button small" href="/admin/leads">Ver todos</a></p></div>
          <div class="panel"><h3>Auditoria</h3>${logs.map((log) => `<div class="event"><b>${log.action}</b><span>${log.actor} - ${log.entity}</span><p>${log.details}</p></div>`).join("")}</div>
        </section>
      </main>
    `, req));
  });

  app.get("/admin/settings", requireAdmin, (req, res) => {
    const adminUser = store.getSetting("admin_user", process.env.ADMIN_USER || "admin");
    const saved = req.query.saved === "1";
    res.send(layout("Configuracion", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">Admin</p>
          <h1>Configuracion</h1>
          <p><a class="button small" href="/admin">Volver</a></p>
        </div>
        <form class="panel contactForm" method="post" action="/admin/settings">
          ${saved ? `<div class="success">Configuracion guardada. Vuelve a iniciar sesion con las nuevas credenciales.</div>` : ""}
          <label>Usuario admin
            <input name="admin_user" value="${adminUser}" required />
          </label>
          <label>Nueva clave
            <input name="admin_password" type="password" minlength="8" required />
          </label>
          <label>Confirmar nueva clave
            <input name="admin_password_confirm" type="password" minlength="8" required />
          </label>
          <button class="button primary" type="submit">Guardar credenciales</button>
        </form>
      </main>
    `, req));
  });

  app.post("/admin/settings", requireAdmin, (req, res) => {
    const adminUser = String(req.body.admin_user || "").trim();
    const password = String(req.body.admin_password || "");
    const confirm = String(req.body.admin_password_confirm || "");
    if (!adminUser || password.length < 8 || password !== confirm) {
      return res.status(400).send(layout("Configuracion", `
        <main class="page">
          <div class="sectionHead"><p class="eyebrow">Admin</p><h1>Configuracion</h1><p><a class="button small" href="/admin/settings">Volver</a></p></div>
          <div class="panel"><div class="alert">La clave debe tener 8 caracteres o mas y coincidir con la confirmacion.</div></div>
        </main>
      `, req));
    }
    store.setSetting("admin_user", adminUser);
    store.setSetting("admin_password", password);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Admin", "updated_admin_credentials", "settings", adminUser, new Date().toISOString()]);
    res.setHeader("Set-Cookie", "tokenizas_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    res.redirect("/login");
  });

  app.get("/admin/leads", requireAdmin, (req, res) => {
    const leads = store.all("SELECT * FROM leads ORDER BY id DESC");
    res.send(layout("Interesados", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">CRM</p>
          <h1>Interesados</h1>
          <p><a class="button small" href="/admin">Volver</a> <a class="button small" href="/admin/leads.csv">Exportar CSV</a></p>
        </div>
        <section class="panel tablePanel">
          <table class="dataTable">
            <thead><tr><th>Nombre</th><th>Email</th><th>WhatsApp</th><th>Interes</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              ${leads.map((lead) => `<tr><td>${lead.name}</td><td>${lead.email}</td><td>${lead.whatsapp || ""}</td><td>${lead.interest}</td><td><span class="statusBadge">${lead.status}</span></td><td>${lead.created_at}</td><td><a href="/admin/leads/${lead.id}">Abrir</a></td></tr>`).join("")}
            </tbody>
          </table>
        </section>
      </main>
    `, req));
  });

  app.get("/admin/leads.csv", requireAdmin, (req, res) => {
    const leads = store.all("SELECT * FROM leads ORDER BY id DESC");
    const csv = toCsv(leads, [
      { key: "id", label: "ID" },
      { key: "name", label: "Nombre" },
      { key: "company", label: "Empresa" },
      { key: "email", label: "Email" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "interest", label: "Interes" },
      { key: "status", label: "Estado" },
      { key: "message", label: "Mensaje" },
      { key: "internal_notes", label: "Notas internas" },
      { key: "created_at", label: "Fecha" }
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tokenizas-leads.csv");
    res.send(csv);
  });

  app.get("/admin/leads/:id", requireAdmin, (req, res) => {
    const lead = store.get("SELECT * FROM leads WHERE id = ?", [req.params.id]);
    if (!lead) return res.status(404).send("Interesado no encontrado");
    res.send(layout(lead.name, `
      <main class="page">
        <div class="sectionHead"><p class="eyebrow">CRM</p><h1>${lead.name}</h1><p><a class="button small" href="/admin/leads">Volver</a></p></div>
        <section class="split">
          <div class="panel">
            <h3>Informacion</h3>
            <div class="fact"><span>Empresa</span><strong>${lead.company || "N/A"}</strong></div>
            <div class="fact"><span>Email</span><strong>${lead.email}</strong></div>
            <div class="fact"><span>WhatsApp</span><strong>${lead.whatsapp || "N/A"}</strong></div>
            <div class="fact"><span>Interes</span><strong>${lead.interest}</strong></div>
            <div class="fact"><span>Fecha</span><strong>${lead.created_at}</strong></div>
            <p class="muted">${lead.message || "Sin mensaje adicional."}</p>
          </div>
          <form class="panel contactForm" method="post" action="/admin/leads/${lead.id}">
            <h3>Seguimiento interno</h3>
            <label>Estado
              <select name="status">
                ${["new", "contacted", "qualified", "proposal", "closed", "archived"].map((status) => `<option value="${status}" ${lead.status === status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </label>
            <label>Notas internas
              <textarea name="internal_notes" rows="7">${lead.internal_notes || ""}</textarea>
            </label>
            <button class="button primary" type="submit">Guardar</button>
          </form>
        </section>
      </main>
    `, req));
  });

  app.post("/admin/leads/:id", requireAdmin, (req, res) => {
    const status = String(req.body.status || "new");
    const notes = String(req.body.internal_notes || "");
    store.run("UPDATE leads SET status = ?, internal_notes = ? WHERE id = ?", [status, notes, req.params.id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Admin", "updated_lead", `lead:${req.params.id}`, status, new Date().toISOString()]);
    res.redirect(`/admin/leads/${req.params.id}`);
  });
}

module.exports = registerAdminRoutes;
