const fs = require("fs");
const path = require("path");
const store = require("../db");
const { readForm } = require("../lib/multipart");
const { layout, money, statusLabel } = require("../lib/ui");

const issuerUploadDir = path.join(__dirname, "..", "..", "private", "issuer");

const projectCategories = [
  ["real-estate", "Bienes raices"],
  ["agriculture", "Agricultura"],
  ["art", "Arte"],
  ["music", "Musica"],
  ["tourism", "Turismo"],
  ["business", "Negocios"],
  ["energy", "Energia"]
];

const issuerDocumentTypes = [
  ["owner_id", "Cedula/pasaporte del dueno o representante"],
  ["company_registry", "Registro Mercantil / RNC / estatutos"],
  ["property_title", "Titulo, contrato, derecho economico o prueba de propiedad"],
  ["tax_clearance", "Certificaciones fiscales y no objeciones aplicables"],
  ["permit_authority", "Permisos, licencias o autorizaciones sectoriales"],
  ["budget", "Presupuesto detallado y cotizaciones"],
  ["financial_model", "Modelo financiero y uso de fondos"],
  ["legal_opinion", "Opinion legal / estructura de oferta"]
];

const permitsGuide = [
  "Bienes raices: titulo o contrato, certificacion registral, deslinde si aplica, tasacion, permisos municipales, uso de suelo, licencia de construccion si hay desarrollo, autorizaciones ambientales cuando correspondan.",
  "Turismo: documentacion de propiedad o arrendamiento, permisos municipales, licencias turisticas aplicables, autorizaciones de operacion, permisos ambientales y sanitarios segun el tipo de proyecto.",
  "Agricultura: prueba de tenencia o arrendamiento, permisos de uso de agua si aplica, registros sanitarios/agricolas, permisos ambientales cuando haya impacto, presupuesto de siembra, mantenimiento y cosecha.",
  "Arte y musica: prueba de titularidad o derechos de explotacion, contratos de artista/productor, presupuesto de produccion, licencias, plan de ingresos y autorizaciones de imagen/marca.",
  "Energia: concesiones, permisos ambientales, interconexion, estudios tecnicos, contratos de compra de energia y autorizaciones regulatorias aplicables."
];

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
  return layout("Aplicar proyecto", `
    <main class="page investorPage">
      <div class="adminHero">
        <div>
          <p class="eyebrow">Dueños de proyecto</p>
          <h1>Aplicar para tokenizar un proyecto</h1>
          <p class="muted">Completa la informacion legal, presupuesto, permisos y documentos para una revision inicial.</p>
        </div>
        <div class="adminActions"><a class="button small" href="/contact">Contacto</a></div>
      </div>
      ${error ? `<div class="alert">${error}</div>` : ""}
      <section class="split">
        <form class="panel contactForm adminPanel" method="post" enctype="multipart/form-data" action="/issuer/apply">
          <h3>Datos del dueno</h3>
          <div class="formGrid">
            <label>Nombre del responsable<input name="owner_name" required /></label>
            <label>Empresa / vehiculo legal<input name="company_name" required /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>WhatsApp<input name="whatsapp" /></label>
            <label>Pais<input name="country" value="Republica Dominicana" required /></label>
            <label>Titular legal del activo<input name="legal_owner" required /></label>
          </div>
          <h3>Proyecto y presupuesto</h3>
          <div class="formGrid">
            <label>Nombre del proyecto<input name="project_name" required /></label>
            <label>Categoria<select name="category">${projectCategories.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label>Ubicacion<input name="location" required /></label>
            <label>Monto a recaudar USD<input name="target_raise" type="number" min="1000" step="1000" required /></label>
            <label>Presupuesto total USD<input name="total_budget" type="number" min="1000" step="1000" required /></label>
          </div>
          <label>Detalle del presupuesto<textarea name="budget_breakdown" rows="5" placeholder="Ej: terreno, permisos, construccion, equipos, marketing, operacion, reserva legal." required></textarea></label>
          <label>Estructura legal propuesta<textarea name="legal_structure" rows="4" placeholder="Ej: fideicomiso, SRL/SPV, contrato de participacion economica, deuda privada, revenue share." required></textarea></label>
          <label>Permisos y autorizaciones disponibles o pendientes<textarea name="permits_summary" rows="5" required></textarea></label>
          <label>Descripcion del proyecto<textarea name="project_description" rows="6" required></textarea></label>
          <h3>Documentos iniciales</h3>
          <div class="formGrid">
            ${issuerDocumentTypes.slice(0, 6).map(([value, label]) => `<label>${label}<input name="doc_${value}" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" /></label>`).join("")}
          </div>
          <button class="button primary" type="submit">Enviar solicitud</button>
        </form>
        <aside class="panel adminPanel">
          <h3>Guia de permisos RD</h3>
          ${permitsGuide.map((item) => `<div class="event"><p>${item}</p></div>`).join("")}
          <div class="alert">Esta guia no sustituye una opinion legal. Cada proyecto debe ser revisado por abogados y asesores regulados en Republica Dominicana.</div>
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
      if (required.some((key) => !String(body[key] || "").trim())) throw new Error("Completa todos los campos requeridos.");
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
      issuerDocumentTypes.forEach(([type]) => {
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
    res.send(layout("Solicitud recibida", `
      <main class="page investorPage">
        <div class="panel adminPanel">
          <p class="eyebrow">Solicitud recibida</p>
          <h1>Tu proyecto fue enviado para revision</h1>
          <p class="muted">Numero de solicitud: ${req.query.id || "pendiente"}. El equipo revisara presupuesto, permisos, estructura legal y documentos antes de publicar o tokenizar.</p>
          <p><a class="button primary" href="/projects">Ver proyectos</a> <a class="button small" href="/contact">Contactar equipo</a></p>
        </div>
      </main>
    `, req));
  });
}

module.exports = registerIssuerRoutes;
