const config = require("../config");
const store = require("../db");
const { notifyProjectOwnerApproved } = require("../lib/notifications");
const crypto = require("crypto");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findProject(application, projects) {
  if (application.project_id) {
    const byId = projects.find((project) => Number(project.id) === Number(application.project_id));
    if (byId) return byId;
  }
  const appSlug = slugify(application.project_name);
  const bySlug = projects.find((project) => project.slug === appSlug);
  if (bySlug) return bySlug;
  const appName = normalize(application.project_name);
  return projects.find((project) => {
    const projectName = normalize(project.title);
    return projectName === appName || projectName.includes(appName) || appName.includes(projectName);
  });
}

function ensureStatusToken(application) {
  if (application.status_token) return application.status_token;
  const token = crypto.randomBytes(24).toString("hex");
  store.run("UPDATE issuer_applications SET status_token = ? WHERE id = ?", [token, application.id]);
  return token;
}

(async () => {
  await store.initDb();
  const force = process.env.OWNER_NOTIFY_FORCE === "1";
  const query = force
    ? "SELECT * FROM issuer_applications WHERE status = 'approved' ORDER BY id"
    : "SELECT * FROM issuer_applications WHERE status = 'approved' AND (owner_notified_at IS NULL OR owner_notified_at = '') ORDER BY id";
  const applications = store.all(query);
  const projects = store.all("SELECT * FROM projects ORDER BY id");
  let sent = 0;
  let skipped = 0;
  for (const application of applications) {
    const project = findProject(application, projects);
    if (!project) {
      skipped += 1;
      console.log(`Saltado ${application.email}: proyecto no encontrado para "${application.project_name}"`);
      continue;
    }
    const projectUrl = `${config.siteUrl}/projects/${project.slug}`;
    const statusUrl = `${config.siteUrl}/issuer/status/${ensureStatusToken(application)}`;
    const result = await notifyProjectOwnerApproved(application, projectUrl, statusUrl);
    if (result.sent) {
      store.run("UPDATE issuer_applications SET owner_notified_at = ?, project_id = ? WHERE id = ?", [new Date().toISOString(), project.id, application.id]);
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('System', 'sent_project_owner_approval_email', ?, ?, ?)", [application.email, project.slug, new Date().toISOString()]);
      sent += 1;
      console.log(`Enviado a ${application.email}: ${project.title}`);
    } else {
      skipped += 1;
      console.log(`Saltado ${application.email}: ${result.reason || "not_sent"}`);
    }
  }
  store.saveDb();
  console.log(`Emails enviados: ${sent}`);
  console.log(`Saltados: ${skipped}`);
})();
