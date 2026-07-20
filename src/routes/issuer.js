const fs = require("fs");
const path = require("path");
const store = require("../db");
const { readForm } = require("../lib/multipart");
const { tr } = require("../lib/i18n");
const { layout, money, statusLabel } = require("../lib/ui");

const issuerUploadDir = path.join(__dirname, "..", "..", "private", "issuer");

const projectCategoryKeys = ["real-estate", "agriculture", "art", "music", "tourism", "business", "energy"];

const issuerDocumentTypeKeys = ["owner_id", "company_registry", "property_title", "tax_clearance", "permit_authority", "budget", "financial_model", "legal_opinion"];

function projectCategories(req) {
  const labels = tr(req).categoryLabels;
  return projectCategoryKeys.map((key) => [key, labels[key]]);
}

function issuerDocumentTypes(req) {
  const labels = tr(req).issuer.documentTypes;
  return issuerDocumentTypeKeys.map((key) => [key, labels[key]]);
}

function saveIssuerDocument(file, applicationId, documentType) {
  if (!file || !file.buffer || file.buffer.length === 0) return null;
  const allowed = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf"
  };
  const extension = allowed[file.contentType];
  if (!extension) throw new Error("Solo se permiten PDF, JPG, PNG o WebP.");
  const safeType = String(documentType || "document").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const targetDir = path.join(issuerUploadDir, String(applicationId));
  fs.mkdirSync(targetDir, { recursive: true });
  const filename = `${safeType}-${Date.now()}${extension}`;
  fs.writeFileSync(path.join(targetDir, filename), file.buffer);
  return {
    filePath: `/issuer/${applicationId}/${filename}`,
    originalName: file.filename,
    mimeType: file.contentType
  };
}

function issuerForm(req, error = "") {
  const t = tr(req).issuer;
  return layout(t.applyTitle, `
    <main class="page investorPage">
      <div class="adminHero">
        <div>
          <p class="eyebrow">${t.eyebrow}</p>
          <h1>${t.applyTitle}</h1>
          <p class="muted">${t.applyLead}</p>
        </div>
        <div class="adminActions"><a class="button small" href="/contact">${tr(req).contact}</a></div>
      </div>
      ${error ? `<div class="alert">${error}</div>` : ""}
      <section class="split">
        <form class="panel contactForm adminPanel" method="post" enctype="multipart/form-data" action="/issuer/apply">
          <h3>${t.ownerData}</h3>
          <div class="formGrid">
            <label>${t.ownerName}<input name="owner_name" required /></label>
            <label>${t.companyName}<input name="company_name" required /></label>
            <label>${tr(req).email}<input name="email" type="email" required /></label>
            <label>WhatsApp<input name="whatsapp" /></label>
            <label>${tr(req).country}<input name="country" value="Republica Dominicana" required /></label>
            <label>${t.legalOwner}<input name="legal_owner" required /></label>
          </div>
          <h3>${t.projectBudget}</h3>
          <div class="formGrid">
            <label>${t.projectName}<input name="project_name" required /></label>
            <label>${tr(req).interest}<select name="category">${projectCategories(req).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label>${tr(req).location}<input name="location" required /></label>
            <label>${t.targetRaise}<input name="target_raise" type="number" min="1000" step="1000" required /></label>
            <label>${t.totalBudget}<input name="total_budget" type="number" min="1000" step="1000" required /></label>
          </div>
          <label>${t.budgetBreakdown}<textarea name="budget_breakdown" rows="5" placeholder="${t.budgetPlaceholder}" required></textarea></label>
          <label>${t.legalStructure}<textarea name="legal_structure" rows="4" placeholder="${t.legalPlaceholder}" required></textarea></label>
          <label>${t.permitsSummary}<textarea name="permits_summary" rows="5" required></textarea></label>
          <label>${t.description}<textarea name="project_description" rows="6" required></textarea></label>
          <h3>${t.initialDocuments}</h3>
          <div class="formGrid">
            ${issuerDocumentTypes(req).slice(0, 6).map(([value, label]) => `<label>${label}<input name="doc_${value}" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /></label>`).join("")}
          </div>
          <button class="button primary" type="submit">${t.submit}</button>
        </form>
        <aside class="panel adminPanel">
          <h3>${t.permitsGuideTitle}</h3>
          ${t.permitsGuide.map((item) => `<div class="event"><p>${item}</p></div>`).join("")}
          <div class="alert">${t.legalNotice}</div>
        </aside>
      </section>
    </main>
  `, req);
}

function registerIssuerRoutes(app) {
  app.get("/issuer/apply", (req, res) => res.send(issuerForm(req)));

  app.post("/issuer/apply", async (req, res) => {
    try {
      const form = await readForm(req, 12 * 1024 * 1024);
      const body = form.fields;
      const required = ["owner_name", "company_name", "email", "country", "project_name", "category", "location", "legal_owner", "target_raise", "total_budget", "budget_breakdown", "legal_structure", "permits_summary", "project_description"];
      if (required.some((key) => !String(body[key] || "").trim())) throw new Error(tr(req).issuer.completeRequired);
      const now = new Date().toISOString();
      store.run(`
        INSERT INTO issuer_applications
        (owner_name, company_name, email, whatsapp, country, project_name, category, location, legal_owner, target_raise, total_budget, budget_breakdown, legal_structure, permits_summary, project_description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
      `, [
        body.owner_name,
        body.company_name,
        String(body.email || "").trim().toLowerCase(),
        body.whatsapp || "",
        body.country,
        body.project_name,
        body.category,
        body.location,
        body.legal_owner,
        Number(body.target_raise || 0),
        Number(body.total_budget || 0),
        body.budget_breakdown,
        body.legal_structure,
        body.permits_summary,
        body.project_description,
        now
      ]);
      const application = store.get("SELECT * FROM issuer_applications WHERE email = ? ORDER BY id DESC LIMIT 1", [String(body.email || "").trim().toLowerCase()]);
      issuerDocumentTypeKeys.forEach((type) => {
        const saved = saveIssuerDocument(form.files[`doc_${type}`], application.id, type);
        if (!saved) return;
        store.run("INSERT INTO issuer_documents (application_id, document_type, original_name, file_path, mime_type, status, uploaded_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?)", [
          application.id,
          type,
          saved.originalName,
          saved.filePath,
          saved.mimeType,
          now
        ]);
      });
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'submitted_issuer_application', 'issuer', ?, ?)", [body.owner_name, body.project_name, now]);
      res.redirect(`/issuer/apply/success?id=${application.id}`);
    } catch (error) {
      res.status(400).send(issuerForm(req, error.message));
    }
  });

  app.get("/issuer/apply/success", (req, res) => {
    const t = tr(req).issuer;
    res.send(layout(t.successEyebrow, `
      <main class="page investorPage">
        <div class="panel adminPanel">
          <p class="eyebrow">${t.successEyebrow}</p>
          <h1>${t.successTitle}</h1>
          <p class="muted">${t.requestNumber}: ${req.query.id || "pendiente"}. ${t.successLead}</p>
          <p><a class="button primary" href="/projects">${tr(req).viewProjects}</a> <a class="button small" href="/contact">${t.contactTeam}</a></p>
        </div>
      </main>
    `, req));
  });
}

module.exports = registerIssuerRoutes;
