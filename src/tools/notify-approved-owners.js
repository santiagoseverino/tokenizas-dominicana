const config = require("../config");
const store = require("../db");
const { notifyProjectOwnerApproved } = require("../lib/notifications");

(async () => {
  await store.initDb();
  const applications = store.all(`
    SELECT a.*, p.slug
    FROM issuer_applications a
    JOIN projects p ON p.id = a.project_id OR p.slug = lower(replace(a.project_name, ' ', '-'))
    WHERE a.status = 'approved'
      AND (a.owner_notified_at IS NULL OR a.owner_notified_at = '')
    GROUP BY a.id
    ORDER BY a.id
  `);
  let sent = 0;
  let skipped = 0;
  for (const application of applications) {
    const projectUrl = `${config.siteUrl}/projects/${application.slug}`;
    const result = await notifyProjectOwnerApproved(application, projectUrl);
    if (result.sent) {
      store.run("UPDATE issuer_applications SET owner_notified_at = ?, project_id = COALESCE(project_id, (SELECT id FROM projects WHERE slug = ? LIMIT 1)) WHERE id = ?", [new Date().toISOString(), application.slug, application.id]);
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('System', 'sent_project_owner_approval_email', ?, ?, ?)", [application.email, application.slug, new Date().toISOString()]);
      sent += 1;
    } else {
      skipped += 1;
      console.log(`Saltado ${application.email}: ${result.reason || "not_sent"}`);
    }
  }
  store.saveDb();
  console.log(`Emails enviados: ${sent}`);
  console.log(`Saltados: ${skipped}`);
})();
