const fs = require("fs");
const path = require("path");
const store = require("../db");
const config = require("../config");
const { getAdminCredentials, hashPassword, requireAdmin, verifyPassword } = require("../middleware/auth");
const { toCsv } = require("../lib/csv");
const { tr } = require("../lib/i18n");
const { parseMultipart } = require("../lib/multipart");
const { layout, money, number, statusLabel } = require("../lib/ui");
const { ensureProjectMint, issueTokensForInvestment } = require("../lib/tokenization");
const { isRealSolanaEnabled, isValidSolanaAddress } = require("../lib/solana");
const { seedCacaoMarketplaceDemo } = require("../lib/marketplace-demo");
const { notifyProjectOwnerApproved, sendIssuerMessage } = require("../lib/notifications");
const { checklistProgress, ensureProjectChecklist, getProjectChecklist, incompleteChecklistItems, statusLabels: checklistStatusLabels, updateProjectChecklistItem } = require("../lib/project-checklist");

const uploadDir = path.join(__dirname, "..", "..", "public", "uploads");
const projectCategories = [
  ["real-estate", "Bienes raices"],
  ["agriculture", "Agricultura"],
  ["art", "Arte"],
  ["music", "Musica"],
  ["tourism", "Turismo"],
  ["health-wellness", "Health and wellness"],
  ["business", "Negocios"],
  ["energy", "Energia"]
];
const projectTypes = [
  "Renta corta turistica",
  "Desarrollo residencial urbano",
  "Deuda inmobiliaria",
  "Hotel / hospitality",
  "Salud / Wellness"
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readForm(req) {
  if ((req.headers["content-type"] || "").includes("multipart/form-data")) return parseMultipart(req);
  return { fields: req.body || {}, files: {} };
}

function saveProjectImage(file, slug) {
  if (!file || !file.buffer || file.buffer.length === 0) return "";
  const allowed = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };
  const extension = allowed[file.contentType];
  if (!extension) throw new Error("Solo se permiten imagenes JPG, PNG o WebP.");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${slug}-${Date.now()}${extension}`;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

function solanaExplorerAddress(address) {
  const cluster = config.solanaCluster === "mainnet-beta" ? "" : `?cluster=${config.solanaCluster}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

function solanaExplorerTx(signature) {
  const cluster = config.solanaCluster === "mainnet-beta" ? "" : `?cluster=${config.solanaCluster}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

function looksLikeSolanaSignature(signature) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(signature || ""));
}

function errorMessage(error) {
  if (!error) return "Error desconocido. Revisa journalctl para mas detalles.";
  if (error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function renderTokenEvent(event) {
  const explorerLink = looksLikeSolanaSignature(event.signature)
    ? `<a class="button small" href="${solanaExplorerTx(event.signature)}" target="_blank" rel="noopener">Ver transaccion en Solana Explorer</a>`
    : "";
  return `<div class="event"><b>${event.event_type} - ${event.token_symbol}</b><span>${event.signature}</span><p>${event.note}</p>${explorerLink}</div>`;
}

function renderIssuedInvestment(item) {
  const paymentStatus = item.payment_status === "received" || item.payment_signature || item.status === "tokens_issued" ? "recibido" : item.payment_status || "pendiente";
  const paymentLink = looksLikeSolanaSignature(item.payment_signature)
    ? `<a class="button small" href="${solanaExplorerTx(item.payment_signature)}" target="_blank" rel="noopener">Ver pago</a>`
    : "";
  const issueLink = looksLikeSolanaSignature(item.issue_signature)
    ? `<a class="button small" href="${solanaExplorerTx(item.issue_signature)}" target="_blank" rel="noopener">Ver emision</a>`
    : "";
  const mintLink = item.issue_mint_address && isValidSolanaAddress(item.issue_mint_address)
    ? `<a class="button small" href="${solanaExplorerAddress(item.issue_mint_address)}" target="_blank" rel="noopener">Ver mint</a>`
    : "";
  return `<div class="event"><b>Orden #${item.id} - ${item.investor_name} - ${item.project_title}</b><span>${item.tokens} ${item.token_symbol} - ${statusLabel(item.status)} - Pago: ${paymentStatus}</span><p>${item.payment_signature ? `Pago: ${item.payment_signature}` : "Pago confirmado"}${item.issue_signature ? ` - Emision: ${item.issue_signature}` : ""}${item.issued_at ? ` - Emitida: ${item.issued_at}` : ""}</p>${item.issue_mint_address ? `<span class="monoBreak">Mint: ${item.issue_mint_address}</span>` : ""}${item.issue_token_account ? `<span class="monoBreak">Token account: ${item.issue_token_account}</span>` : ""}<div class="inlineActions">${paymentLink}${issueLink}${mintLink}</div></div>`;
}

function renderMarketplaceListing(item) {
  return `<div class="event"><b>Listado #${item.id} - ${item.project_title}</b><span>${item.seller_name} - ${number.format(item.quantity)} ${item.token_symbol} - ${money.format(item.price_per_token)} / token - ${item.status}</span><p>Total: ${money.format(Number(item.quantity) * Number(item.price_per_token))} - Creado: ${item.created_at}</p>${item.status === "active" ? `<form method="post" action="/admin/marketplace/listings/${item.id}/cancel"><button class="button danger small" type="submit">Cancelar listado</button></form>` : ""}</div>`;
}

function renderMarketplaceTrade(item) {
  const transferLink = looksLikeSolanaSignature(item.transfer_signature)
    ? `<a class="button small" href="${solanaExplorerTx(item.transfer_signature)}" target="_blank" rel="noopener">Ver transferencia</a>`
    : "";
  return `<div class="event"><b>Trade #${item.id} - ${item.project_title}</b><span>Vendedor: ${item.seller_name} - Comprador: ${item.buyer_name}</span><p>${number.format(item.quantity)} ${item.token_symbol} - ${money.format(item.price_per_token)} / token - Total ${money.format(item.total_amount)} - ${item.status}</p>${item.mint_address ? `<span class="monoBreak">Mint: ${item.mint_address}</span>` : ""}${item.seller_wallet ? `<span class="monoBreak">Seller wallet: ${item.seller_wallet}</span>` : ""}${item.buyer_wallet ? `<span class="monoBreak">Buyer wallet: ${item.buyer_wallet}</span>` : ""}${item.transfer_signature ? `<span class="monoBreak">Firma: ${item.transfer_signature}</span>` : ""}<div class="inlineActions">${transferLink}${item.status === "pending_onchain_transfer" ? `<form method="post" action="/admin/marketplace/trades/${item.id}/review"><button class="button small" type="submit">Marcar en revision</button></form>` : ""}</div></div>`;
}

function renderProjectChecklistAdmin(project, checklist, progress) {
  const options = Object.entries(checklistStatusLabels).map(([value, label]) => ({ value, label }));
  const incomplete = checklist.filter((item) => item.status !== "done");
  return `
    <section class="panel adminPanel readinessPanel">
      <div class="checklistHeader">
        <div>
          <p class="eyebrow">Readiness</p>
          <h3>Checklist profesional del proyecto</h3>
          <p class="muted">${progress.done}/${progress.total} completados. Este progreso tambien se muestra en el portal del dueno.</p>
        </div>
        <strong>${progress.percent}%</strong>
      </div>
      <div class="progress compactProgress"><span style="width:${progress.percent}%"></span></div>
      ${incomplete.length ? `<div class="alert">Para abrir este proyecto al publico, completa los ${incomplete.length} requisitos pendientes.</div>` : `<div class="success">Expediente completo. El proyecto puede marcarse como abierto.</div>`}
      <div class="checklistList">
        ${checklist.map((item) => `
          <form class="checklistRow" method="post" action="/admin/projects/checklist/${item.id}">
            <div>
              <b>${item.label}</b>
              <span>${item.category}</span>
            </div>
            <select name="status">${options.map((option) => `<option value="${option.value}" ${item.status === option.value ? "selected" : ""}>${option.label}</option>`).join("")}</select>
            <input name="notes" value="${item.notes || ""}" placeholder="Nota para seguimiento" />
            <label class="miniCheck"><input type="checkbox" name="visible_to_owner" value="1" ${Number(item.visible_to_owner) ? "checked" : ""} />Visible</label>
            <button class="button small" type="submit">Guardar</button>
          </form>
        `).join("")}
      </div>
    </section>
  `;
}

function projectForm(project = {}, offering = {}, error = "", extraContent = "") {
  const isEdit = Boolean(project.id);
  return `
    <main class="page">
      <div class="sectionHead">
        <p class="eyebrow">Origination</p>
        <h1>${isEdit ? "Editar proyecto" : "Crear proyecto tokenizable"}</h1>
        <p><a class="button small" href="/admin">Volver</a></p>
      </div>
      <form class="panel contactForm" method="post" enctype="multipart/form-data" action="${isEdit ? `/admin/projects/${project.id}` : "/admin/projects"}">
        ${error ? `<div class="alert">${error}</div>` : ""}
        ${project.image_url ? `<div class="imagePreview"><img src="${project.image_url}" alt="${project.title || "Proyecto"}" /><span>Imagen actual</span></div>` : ""}
        <section class="formGrid">
          <label>Nombre del proyecto<input name="title" value="${project.title || ""}" required /></label>
          <label>Slug publico<input name="slug" value="${project.slug || ""}" placeholder="se genera si queda vacio" /></label>
          <label>Categoria<select name="category">${projectCategories.map(([value, label]) => `<option value="${value}" ${project.category === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label>Ubicacion<input name="location" value="${project.location || ""}" required /></label>
          <label>Tipo<select name="type">${projectTypes.map((type) => `<option ${project.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
          <label>Meta USD<input name="target_raise" type="number" min="10000" step="1000" value="${project.target_raise || 1000000}" required /></label>
          <label>Minimo USD<input name="min_investment" type="number" min="100" step="100" value="${project.min_investment || 1000}" required /></label>
          <label>Simbolo token<input name="token_symbol" maxlength="10" value="${project.token_symbol || ""}" required /></label>
          <label>Supply<input name="token_supply" type="number" min="1" step="1" value="${project.token_supply || 100000}" required /></label>
          <label>Precio token USD<input name="token_price" type="number" min="0.01" step="0.01" value="${project.token_price || 10}" required /></label>
          <label>Yield esperado %<input name="expected_yield" type="number" min="0" step="0.1" value="${project.expected_yield || 8}" required /></label>
          <label>Estado<select name="status">${["due_diligence", "open", "funded"].map((status) => `<option value="${status}" ${project.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select></label>
          <label>Riesgo<select name="risk_level">${["Bajo", "Medio", "Alto"].map((risk) => `<option ${project.risk_level === risk ? "selected" : ""}>${risk}</option>`).join("")}</select></label>
          <label>Imagen URL<input name="image_url" value="${project.image_url || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80"}" required /></label>
          <label>Subir imagen nueva<input name="project_image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          <label>Capital reservado USD<input name="raised" type="number" min="0" step="1000" value="${offering.raised || 0}" /></label>
          <label>Apertura<input name="opens_at" type="date" value="${offering.opens_at || "2026-08-01"}" required /></label>
          <label>Cierre<input name="closes_at" type="date" value="${offering.closes_at || "2026-10-30"}" required /></label>
          <label>Lockup meses<input name="lockup_months" type="number" min="0" step="1" value="${offering.lockup_months || 12}" required /></label>
        </section>
        <label>Estructura legal<textarea name="legal_structure" rows="3" required>${project.legal_structure || "Fideicomiso inmobiliario con derechos economicos tokenizados"}</textarea></label>
        <label>Descripcion comercial<textarea name="description" rows="5" required>${project.description || ""}</textarea></label>
        <label>Documentos base, uno por linea<textarea name="documents" rows="5">${project.documents || "Titulo y certificacion registral\nTasacion independiente\nModelo financiero\nContrato de oferta\nInforme KYC/KYB del emisor"}</textarea></label>
        <button class="button primary" type="submit">${isEdit ? "Guardar proyecto" : "Crear proyecto"}</button>
      </form>
      ${extraContent}
    </main>
  `;
}

function readProjectPayload(body) {
  const title = String(body.title || "").trim();
  const slug = slugify(body.slug || title);
  const targetRaise = Number(body.target_raise || 0);
  const tokenSupply = Number(body.token_supply || 0);
  const tokenPrice = Number(body.token_price || 0);
  if (!title || !slug || !body.location || !body.token_symbol || targetRaise <= 0 || tokenSupply <= 0 || tokenPrice <= 0) {
    throw new Error("Completa nombre, ubicacion, token, meta, supply y precio.");
  }
  return {
    slug,
    category: String(body.category || "real-estate"),
    title,
    location: String(body.location || "").trim(),
    type: String(body.type || "").trim(),
    legal_structure: String(body.legal_structure || "").trim(),
    target_raise: targetRaise,
    min_investment: Number(body.min_investment || 0),
    token_symbol: String(body.token_symbol || "").trim().toUpperCase(),
    token_supply: tokenSupply,
    token_price: tokenPrice,
    expected_yield: Number(body.expected_yield || 0),
    status: String(body.status || "due_diligence"),
    image_url: String(body.image_url || "").trim(),
    description: String(body.description || "").trim(),
    risk_level: String(body.risk_level || "Medio"),
    raised: Number(body.raised || 0),
    opens_at: String(body.opens_at || ""),
    closes_at: String(body.closes_at || ""),
    lockup_months: Number(body.lockup_months || 0),
    documents: String(body.documents || "")
  };
}

function tokenSymbolFromName(name) {
  const words = String(name || "TOK").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().match(/[A-Z0-9]+/g) || ["TOK"];
  return words.map((word) => word[0]).join("").slice(0, 6) || "TOK";
}

function createProjectFromIssuerApplication(application) {
  const slug = slugify(application.project_name);
  const existing = store.get("SELECT * FROM projects WHERE slug = ?", [slug]);
  if (existing) return existing;
  const targetRaise = Math.max(1000, Number(application.target_raise || 0));
  const tokenSupply = Math.max(1000, Math.round(targetRaise));
  const tokenPrice = Number((targetRaise / tokenSupply).toFixed(2)) || 1;
  const now = new Date().toISOString();
  store.run(`
    INSERT INTO projects
    (slug, category, title, location, type, legal_structure, target_raise, min_investment, token_symbol, token_supply, token_price, expected_yield, status, image_url, description, risk_level, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    slug,
    application.category || "health-wellness",
    application.project_name,
    application.location,
    application.category === "health-wellness" ? "Salud / Wellness" : "Proyecto tokenizable",
    application.legal_structure,
    targetRaise,
    Math.min(100, targetRaise),
    tokenSymbolFromName(application.project_name),
    tokenSupply,
    tokenPrice,
    8,
    "due_diligence",
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1400&q=80",
    `${application.project_description}\n\nPresupuesto: ${application.budget_breakdown}\n\nPermisos: ${application.permits_summary}`,
    "Medio",
    now
  ]);
  const project = store.get("SELECT * FROM projects WHERE slug = ?", [slug]);
  store.run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, 'Ronda Genesis', ?, ?, 0, ?, ?, 12)", [
    project.id,
    Math.round(targetRaise * 0.45),
    targetRaise,
    "2026-08-01",
    "2026-10-30"
  ]);
  [
    "Solicitud de tokenizacion del dueno",
    "Presupuesto detallado",
    "Resumen de permisos y autorizaciones",
    "Estructura legal propuesta",
    "Documentos KYB del emisor"
  ].forEach((title) => {
    store.run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, 'legal', 'review')", [project.id, title]);
  });
  ensureProjectChecklist(project.id);
  store.run("UPDATE issuer_applications SET status = 'approved', project_id = ?, reviewed_at = ? WHERE id = ?", [project.id, now, application.id]);
  store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Admin', 'created_project_from_issuer', ?, ?, ?)", [application.project_name, `project:${project.id}`, now]);
  return project;
}

function ensureIssuerStatusToken(application) {
  if (application.status_token) return application.status_token;
  const crypto = require("crypto");
  const token = crypto.randomBytes(24).toString("hex");
  store.run("UPDATE issuer_applications SET status_token = ? WHERE id = ?", [token, application.id]);
  return token;
}

function issuerStatusUrl(req, application) {
  const token = ensureIssuerStatusToken(application);
  return `${req.protocol}://${req.get("host")}/issuer/status/${token}`;
}

function issuerWhatsappUrl(application, message) {
  const phone = String(application.whatsapp || "").replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";
}

function registerAdminRoutes(app) {
  app.get("/admin", requireAdmin, (req, res) => {
    const t = tr(req);
    const projects = store.all("SELECT p.*, o.raised FROM projects p LEFT JOIN offerings o ON o.project_id = p.id ORDER BY p.id");
    const users = store.all("SELECT * FROM users ORDER BY id");
    const logs = store.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8");
    const leads = store.all("SELECT * FROM leads ORDER BY id DESC LIMIT 8");
    res.send(layout("Admin", `
      <main class="page adminPage">
        <div class="adminHero">
          <div>
            <p class="eyebrow">Back office</p>
            <h1>Control operativo</h1>
            <p class="muted">Administracion de proyectos, inversionistas, leads, tokenizacion y auditoria.</p>
          </div>
          <div class="adminActions">
            <a class="button primary small" href="/admin/projects/new">Nuevo proyecto</a>
            <a class="button small" href="/admin/kyc">KYC</a>
            <a class="button small" href="/admin/issuers">Dueños</a>
            <a class="button small" href="/admin/tokenization">Tokenizacion</a>
            <a class="button small" href="/admin/marketplace">Marketplace</a>
            <a class="button small" href="/admin/settings">Seguridad</a>
            <a class="button danger small" href="/logout">${t.logout}</a>
          </div>
        </div>
        <section class="split">
          <div class="panel adminPanel"><h3>Proyectos</h3>${projects.map((project) => `<div class="row"><span><a href="/admin/projects/${project.id}">${project.title}</a></span><b>${money.format(project.raised || 0)}</b></div>`).join("")}</div>
          <div class="panel adminPanel"><h3>KYC / KYB</h3>${users.map((user) => `<div class="row"><span>${user.name}</span><b>${statusLabel(user.kyc_status)}</b></div>`).join("")}</div>
        </section>
        <section class="split">
          <div class="panel adminPanel"><h3>Interesados</h3>${leads.map((lead) => `<div class="event"><b>${lead.name}</b><span>${lead.email} - ${lead.whatsapp || "sin WhatsApp"}</span><p>${lead.interest}</p><a href="/admin/leads/${lead.id}">Ver detalle</a></div>`).join("") || "<p class=\"muted\">Sin solicitudes todavia.</p>"}<p><a class="button small" href="/admin/leads">Ver todos</a></p></div>
          <div class="panel adminPanel"><h3>Auditoria</h3>${logs.map((log) => `<div class="event"><b>${log.action}</b><span>${log.actor} - ${log.entity}</span><p>${log.details}</p></div>`).join("")}</div>
        </section>
      </main>
    `, req));
  });

  app.get("/admin/marketplace", requireAdmin, (req, res) => {
    const activeListings = store.all(`
      SELECT ml.*, p.title project_title, u.name seller_name
      FROM marketplace_listings ml
      JOIN projects p ON p.id = ml.project_id
      JOIN users u ON u.id = ml.seller_user_id
      WHERE ml.status = 'active'
      ORDER BY ml.created_at DESC
    `);
    const pendingTrades = store.all(`
      SELECT mt.*, p.title project_title, seller.name seller_name, buyer.name buyer_name
      FROM marketplace_trades mt
      JOIN projects p ON p.id = mt.project_id
      JOIN users seller ON seller.id = mt.seller_user_id
      JOIN users buyer ON buyer.id = mt.buyer_user_id
      WHERE mt.status IN ('pending_onchain_transfer', 'review')
      ORDER BY mt.created_at DESC
    `);
    const completedTrades = store.all(`
      SELECT mt.*, p.title project_title, seller.name seller_name, buyer.name buyer_name
      FROM marketplace_trades mt
      JOIN projects p ON p.id = mt.project_id
      JOIN users seller ON seller.id = mt.seller_user_id
      JOIN users buyer ON buyer.id = mt.buyer_user_id
      WHERE mt.status IN ('settled_onchain', 'settled_internal')
      ORDER BY mt.created_at DESC
      LIMIT 30
    `);
    res.send(layout("Admin Marketplace", `
      <main class="page adminPage">
        <div class="adminHero">
          <div>
            <p class="eyebrow">Mercado secundario</p>
            <h1>Control del marketplace</h1>
            <p class="muted">Supervisa listados, compras pendientes de transferencia SPL, ventas completadas y trazabilidad on-chain.</p>
          </div>
          <div class="adminActions"><form method="post" action="/admin/marketplace/seed-cacao"><button class="button primary small" type="submit">Crear demo CACAO</button></form><a class="button small" href="/admin">Volver</a><a class="button danger small" href="/logout">${tr(req).logout}</a></div>
        </div>
        ${req.query.seeded ? `<div class="success">Demo CACAO creado o actualizado. Revisa listados activos y ventas pendientes.</div>` : ""}
        <section class="metrics compact">
          <article><strong>${activeListings.length}</strong><span>Listados activos</span></article>
          <article><strong>${pendingTrades.length}</strong><span>Ventas pendientes</span></article>
          <article><strong>${completedTrades.length}</strong><span>Ventas completadas</span></article>
        </section>
        <section class="split">
          <div class="panel adminPanel"><h3>Listados activos</h3>${activeListings.map(renderMarketplaceListing).join("") || "<p class=\"muted\">No hay listados activos.</p>"}</div>
          <div class="panel adminPanel"><h3>Ventas pendientes SPL</h3>${pendingTrades.map(renderMarketplaceTrade).join("") || "<p class=\"muted\">No hay ventas pendientes.</p>"}</div>
        </section>
        <section class="panel adminPanel"><h3>Ventas completadas</h3>${completedTrades.map(renderMarketplaceTrade).join("") || "<p class=\"muted\">No hay ventas completadas.</p>"}</section>
      </main>
    `, req));
  });

  app.post("/admin/marketplace/listings/:id/cancel", requireAdmin, (req, res) => {
    store.run("UPDATE marketplace_listings SET status = 'canceled', canceled_at = ? WHERE id = ? AND status = 'active'", [new Date().toISOString(), req.params.id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Admin', 'canceled_marketplace_listing', ?, 'Listado cancelado desde admin', ?)", [`listing:${req.params.id}`, new Date().toISOString()]);
    res.redirect("/admin/marketplace");
  });

  app.post("/admin/marketplace/trades/:id/review", requireAdmin, (req, res) => {
    store.run("UPDATE marketplace_trades SET status = 'review' WHERE id = ? AND status = 'pending_onchain_transfer'", [req.params.id]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Admin', 'review_marketplace_trade', ?, 'Trade marcado en revision', ?)", [`trade:${req.params.id}`, new Date().toISOString()]);
    res.redirect("/admin/marketplace");
  });

  app.post("/admin/marketplace/seed-cacao", requireAdmin, (req, res) => {
    try {
      seedCacaoMarketplaceDemo();
      res.redirect("/admin/marketplace?seeded=1");
    } catch (error) {
      res.status(400).send(layout("Admin Marketplace", `<main class="page"><div class="panel"><div class="alert">${errorMessage(error)}</div><p><a class="button small" href="/admin/marketplace">Volver</a></p></div></main>`, req));
    }
  });

  app.get("/admin/settings", requireAdmin, (req, res) => {
    const adminUser = store.getSetting("admin_user", process.env.ADMIN_USER || "admin");
    const saved = req.query.saved === "1";
    res.send(layout("Configuracion", `
      <main class="page adminPage">
        <div class="adminHero">
          <div>
            <p class="eyebrow">Seguridad</p>
            <h1>Acceso administrativo</h1>
            <p class="muted">Cambia el usuario y la clave del panel privado.</p>
          </div>
          <div class="adminActions">
            <a class="button small" href="/admin">Volver</a>
            <a class="button danger small" href="/logout">${tr(req).logout}</a>
          </div>
        </div>
        <form class="panel contactForm adminSettings" method="post" action="/admin/settings">
          ${saved ? `<div class="success">Configuracion guardada. Vuelve a iniciar sesion con las nuevas credenciales.</div>` : ""}
          <label>Usuario admin
            <input name="admin_user" value="${adminUser}" required />
          </label>
          <label>Clave actual
            <input name="current_password" type="password" autocomplete="current-password" required />
          </label>
          <label>Nueva clave
            <input name="admin_password" type="password" minlength="10" autocomplete="new-password" required />
          </label>
          <label>Confirmar nueva clave
            <input name="admin_password_confirm" type="password" minlength="10" autocomplete="new-password" required />
          </label>
          <button class="button primary" type="submit">Guardar credenciales</button>
        </form>
      </main>
    `, req));
  });

  app.post("/admin/settings", requireAdmin, (req, res) => {
    const adminUser = String(req.body.admin_user || "").trim();
    const currentPassword = String(req.body.current_password || "");
    const password = String(req.body.admin_password || "");
    const confirm = String(req.body.admin_password_confirm || "");
    const credentials = getAdminCredentials();
    if (!verifyPassword(currentPassword, credentials.password)) {
      return res.status(400).send(layout("Configuracion", `
        <main class="page adminPage">
          <div class="adminHero"><div><p class="eyebrow">Seguridad</p><h1>Acceso administrativo</h1></div><div class="adminActions"><a class="button small" href="/admin/settings">Volver</a></div></div>
          <div class="panel adminPanel"><div class="alert">La clave actual no es correcta.</div></div>
        </main>
      `, req));
    }
    if (!adminUser || password.length < 10 || password !== confirm) {
      return res.status(400).send(layout("Configuracion", `
        <main class="page adminPage">
          <div class="adminHero"><div><p class="eyebrow">Seguridad</p><h1>Acceso administrativo</h1></div><div class="adminActions"><a class="button small" href="/admin/settings">Volver</a></div></div>
          <div class="panel adminPanel"><div class="alert">La clave debe tener 10 caracteres o mas y coincidir con la confirmacion.</div></div>
        </main>
      `, req));
    }
    store.setSetting("admin_user", adminUser);
    store.setSetting("admin_password", hashPassword(password));
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Admin", "updated_admin_credentials", "settings", adminUser, new Date().toISOString()]);
    res.setHeader("Set-Cookie", "tokenizas_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    res.redirect("/login");
  });

  app.get("/admin/projects/new", requireAdmin, (req, res) => {
    res.send(layout("Nuevo proyecto", projectForm(), req));
  });

  app.post("/admin/projects", requireAdmin, async (req, res) => {
    let payload;
    let form;
    try {
      form = await readForm(req);
      payload = readProjectPayload(form.fields);
      const uploadedImage = saveProjectImage(form.files.project_image, payload.slug);
      if (uploadedImage) payload.image_url = uploadedImage;
      if (store.get("SELECT id FROM projects WHERE slug = ?", [payload.slug])) throw new Error("Ya existe un proyecto con ese slug.");
    } catch (error) {
      const body = form ? form.fields : {};
      return res.status(400).send(layout("Nuevo proyecto", projectForm(body, body, error.message), req));
    }
    const now = new Date().toISOString();
    store.run(`
      INSERT INTO projects
      (slug, category, title, location, type, legal_structure, target_raise, min_investment, token_symbol, token_supply, token_price, expected_yield, status, image_url, description, risk_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.slug,
      payload.category,
      payload.title,
      payload.location,
      payload.type,
      payload.legal_structure,
      payload.target_raise,
      payload.min_investment,
      payload.token_symbol,
      payload.token_supply,
      payload.token_price,
      payload.expected_yield,
      payload.status,
      payload.image_url,
      payload.description,
      payload.risk_level,
      now
    ]);
    const project = store.get("SELECT * FROM projects WHERE slug = ?", [payload.slug]);
    store.run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      project.id,
      "Ronda Genesis",
      Math.round(payload.target_raise * 0.45),
      payload.target_raise,
      payload.raised,
      payload.opens_at,
      payload.closes_at,
      payload.lockup_months
    ]);
    payload.documents.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).forEach((title) => {
      store.run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, ?, ?)", [project.id, title, "legal", "review"]);
    });
    ensureProjectChecklist(project.id);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Admin", "created_project", project.title, project.slug, now]);
    res.redirect(`/admin/projects/${project.id}`);
  });

  app.get("/admin/projects/:id", requireAdmin, (req, res) => {
    const project = store.get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).send("Proyecto no encontrado");
    const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [project.id]) || {};
    const documents = store.all("SELECT title FROM documents WHERE project_id = ? ORDER BY id", [project.id]).map((doc) => doc.title).join("\n");
    const checklist = getProjectChecklist(project.id);
    const progress = checklistProgress(checklist);
    res.send(layout(project.title, projectForm({ ...project, documents }, offering, "", renderProjectChecklistAdmin(project, checklist, progress)), req));
  });

  app.post("/admin/projects/checklist/:id", requireAdmin, (req, res) => {
    const item = store.get("SELECT * FROM project_checklist WHERE id = ?", [req.params.id]);
    if (!item) return res.status(404).send("Item no encontrado");
    updateProjectChecklistItem(item.id, {
      status: req.body.status,
      notes: req.body.notes,
      visibleToOwner: req.body.visible_to_owner === "1"
    });
    res.redirect(`/admin/projects/${item.project_id}`);
  });

  app.post("/admin/projects/:id", requireAdmin, async (req, res) => {
    const project = store.get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).send("Proyecto no encontrado");
    let payload;
    let form;
    try {
      form = await readForm(req);
      payload = readProjectPayload(form.fields);
      const uploadedImage = saveProjectImage(form.files.project_image, payload.slug);
      if (uploadedImage) payload.image_url = uploadedImage;
      const duplicate = store.get("SELECT id FROM projects WHERE slug = ? AND id != ?", [payload.slug, project.id]);
      if (duplicate) throw new Error("Ya existe otro proyecto con ese slug.");
      if (payload.status === "open" && project.status !== "open") {
        const missing = incompleteChecklistItems(project.id);
        if (missing.length) throw new Error(`Antes de abrir el proyecto, completa el checklist profesional. Pendientes: ${missing.map((item) => item.label).join(", ")}.`);
      }
    } catch (error) {
      const body = form ? form.fields : {};
      return res.status(400).send(layout("Editar proyecto", projectForm({ id: project.id, ...body }, body, error.message), req));
    }
    store.run(`
      UPDATE projects
      SET slug = ?, category = ?, title = ?, location = ?, type = ?, legal_structure = ?, target_raise = ?, min_investment = ?,
          token_symbol = ?, token_supply = ?, token_price = ?, expected_yield = ?, status = ?, image_url = ?,
          description = ?, risk_level = ?
      WHERE id = ?
    `, [
      payload.slug,
      payload.category,
      payload.title,
      payload.location,
      payload.type,
      payload.legal_structure,
      payload.target_raise,
      payload.min_investment,
      payload.token_symbol,
      payload.token_supply,
      payload.token_price,
      payload.expected_yield,
      payload.status,
      payload.image_url,
      payload.description,
      payload.risk_level,
      project.id
    ]);
    const existingOffering = store.get("SELECT id FROM offerings WHERE project_id = ?", [project.id]);
    if (existingOffering) {
      store.run("UPDATE offerings SET soft_cap = ?, hard_cap = ?, raised = ?, opens_at = ?, closes_at = ?, lockup_months = ? WHERE project_id = ?", [
        Math.round(payload.target_raise * 0.45),
        payload.target_raise,
        payload.raised,
        payload.opens_at,
        payload.closes_at,
        payload.lockup_months,
        project.id
      ]);
    } else {
      store.run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        project.id,
        "Ronda Genesis",
        Math.round(payload.target_raise * 0.45),
        payload.target_raise,
        payload.raised,
        payload.opens_at,
        payload.closes_at,
        payload.lockup_months
      ]);
    }
    store.run("DELETE FROM documents WHERE project_id = ?", [project.id]);
    payload.documents.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).forEach((title) => {
      store.run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, ?, ?)", [project.id, title, "legal", "review"]);
    });
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", ["Admin", "updated_project", payload.title, payload.slug, new Date().toISOString()]);
    res.redirect(`/admin/projects/${project.id}`);
  });

  app.get("/admin/issuers", requireAdmin, (req, res) => {
    const applications = store.all(`
      SELECT a.*, COUNT(d.id) document_count
      FROM issuer_applications a
      LEFT JOIN issuer_documents d ON d.application_id = a.id
      GROUP BY a.id
      ORDER BY CASE a.status WHEN 'submitted' THEN 1 WHEN 'review' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END, a.id DESC
    `);
    res.send(layout("Dueños de proyecto", `
      <main class="page adminPage">
        <div class="adminHero">
          <div><p class="eyebrow">Origination</p><h1>Dueños de proyecto</h1><p class="muted">Solicitudes para tokenizar activos, presupuestos, permisos y documentos legales.</p></div>
          <div class="adminActions"><a class="button small" href="/admin">Volver</a><a class="button danger small" href="/logout">${tr(req).logout}</a></div>
        </div>
        <div class="panel adminPanel tablePanel">
          <table class="dataTable">
            <thead><tr><th>Proyecto</th><th>Dueño</th><th>Categoria</th><th>Meta</th><th>Presupuesto</th><th>Estado</th><th>Docs</th><th></th></tr></thead>
            <tbody>
              ${applications.map((item) => `<tr><td>${item.project_name}<br><span class="muted">${item.location}</span></td><td>${item.owner_name}<br><span class="muted">${item.email}</span></td><td>${item.category}</td><td>${money.format(item.target_raise)}</td><td>${money.format(item.total_budget)}</td><td>${statusLabel(item.status)}</td><td>${item.document_count}</td><td><a href="/admin/issuers/${item.id}">Revisar</a></td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </main>
    `, req));
  });

  app.get("/admin/issuers/:id", requireAdmin, (req, res) => {
    const application = store.get("SELECT * FROM issuer_applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).send("Solicitud no encontrada");
    const docs = store.all("SELECT * FROM issuer_documents WHERE application_id = ? ORDER BY uploaded_at DESC", [application.id]);
    const messages = store.all("SELECT * FROM issuer_messages WHERE application_id = ? ORDER BY id DESC LIMIT 20", [application.id]);
    const portalUrl = issuerStatusUrl(req, application);
    const whatsappUrl = issuerWhatsappUrl(application, `Hola ${application.owner_name}, revisa el estado de tu solicitud ${application.project_name}: ${portalUrl}`);
    res.send(layout(application.project_name, `
      <main class="page adminPage">
        <div class="adminHero">
          <div><p class="eyebrow">Due diligence proyecto</p><h1>${application.project_name}</h1><p class="muted">${application.company_name} - ${application.owner_name} - ${statusLabel(application.status)}</p></div>
          <div class="adminActions"><a class="button primary small" href="${portalUrl}" target="_blank" rel="noopener">Portal dueno</a>${whatsappUrl ? `<a class="button small" href="${whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<a class="button small" href="/admin/issuers">Volver</a><a class="button danger small" href="/logout">${tr(req).logout}</a></div>
        </div>
        <section class="split">
          <form class="panel contactForm adminPanel" method="post" action="/admin/issuers/${application.id}">
            <h3>Decision del proyecto</h3>
            <label>Estado<select name="status">
              ${["submitted", "review", "needs_more_info", "approved", "rejected"].map((status) => `<option value="${status}" ${application.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
            </select></label>
            <label>Notas internas<textarea name="internal_notes" rows="6">${application.internal_notes || ""}</textarea></label>
            <button class="button primary" type="submit">Guardar revision</button>
          </form>
          <div class="panel adminPanel">
            <h3>Resumen financiero y legal</h3>
            <div class="fact"><span>Meta a recaudar</span><strong>${money.format(application.target_raise)}</strong></div>
            <div class="fact"><span>Presupuesto total</span><strong>${money.format(application.total_budget)}</strong></div>
            <div class="fact"><span>Categoria</span><strong>${application.category}</strong></div>
            <div class="event"><b>Presupuesto</b><p>${application.budget_breakdown}</p></div>
            <div class="event"><b>Estructura legal</b><p>${application.legal_structure}</p></div>
            <div class="event"><b>Permisos</b><p>${application.permits_summary}</p></div>
            <form method="post" action="/admin/issuers/${application.id}/create-project"><button class="button primary" type="submit">Crear proyecto desde solicitud</button></form>
          </div>
        </section>
        <section class="split">
          <div class="panel adminPanel">
            <h3>Datos del dueño</h3>
            <div class="fact"><span>Email</span><strong>${application.email}</strong></div>
            <div class="fact"><span>WhatsApp</span><strong>${application.whatsapp || "pendiente"}</strong></div>
            <div class="fact"><span>Pais</span><strong>${application.country}</strong></div>
            <div class="fact"><span>Titular legal</span><strong>${application.legal_owner}</strong></div>
            <div class="event"><b>Descripcion</b><p>${application.project_description}</p></div>
          </div>
          <div class="panel adminPanel tablePanel">
            <h3>Documentos</h3>
            <table class="dataTable">
              <thead><tr><th>Tipo</th><th>Archivo</th><th>Estado</th><th></th></tr></thead>
              <tbody>${docs.map((doc) => `<tr><td>${doc.document_type}</td><td>${doc.original_name}</td><td>${statusLabel(doc.status)}</td><td><a href="/admin/issuers/documents/${doc.id}/download">Descargar</a></td></tr>`).join("")}</tbody>
            </table>
          </div>
        </section>
        <section class="split">
          <form class="panel contactForm adminPanel" method="post" action="/admin/issuers/${application.id}/message">
            <h3>Enviar mensaje al dueno</h3>
            <label>Canal<select name="channel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Email + WhatsApp</option></select></label>
            <label>Asunto<input name="subject" value="Actualizacion de tu solicitud en Tokenizas Dominicana" required /></label>
            <label>Mensaje<textarea name="message" rows="5" required>Hola ${application.owner_name}, tu solicitud ${application.project_name} fue revisada. Puedes ver el estado y subir documentos adicionales aqui: ${portalUrl}</textarea></label>
            <button class="button primary" type="submit">Guardar / enviar mensaje</button>
          </form>
          <div class="panel adminPanel">
            <h3>Historial de mensajes</h3>
            ${messages.map((item) => `<div class="event"><b>${item.subject || item.channel}</b><span>${item.sender} - ${item.channel} - ${item.status} - ${item.created_at}</span><p>${item.message}</p></div>`).join("") || `<p class="muted">Sin mensajes todavia.</p>`}
          </div>
        </section>
      </main>
    `, req));
  });

  app.post("/admin/issuers/:id", requireAdmin, (req, res) => {
    const application = store.get("SELECT * FROM issuer_applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).send("Solicitud no encontrada");
    const allowed = new Set(["submitted", "review", "needs_more_info", "approved", "rejected"]);
    const status = allowed.has(req.body.status) ? req.body.status : application.status;
    store.run("UPDATE issuer_applications SET status = ?, internal_notes = ?, reviewed_at = ? WHERE id = ?", [status, req.body.internal_notes || "", new Date().toISOString(), application.id]);
    store.run("UPDATE issuer_documents SET status = ?, notes = ?, reviewed_at = ? WHERE application_id = ?", [
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "submitted",
      req.body.internal_notes || "",
      new Date().toISOString(),
      application.id
    ]);
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'reviewed_issuer_application', ?, ?, ?)", ["Admin", application.project_name, `${status}: ${req.body.internal_notes || ""}`, new Date().toISOString()]);
    res.redirect(`/admin/issuers/${application.id}`);
  });

  app.post("/admin/issuers/:id/create-project", requireAdmin, async (req, res) => {
    const application = store.get("SELECT * FROM issuer_applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).send("Solicitud no encontrada");
    try {
      const project = createProjectFromIssuerApplication(application);
      const projectUrl = `${req.protocol}://${req.get("host")}/projects/${project.slug}`;
      const result = await notifyProjectOwnerApproved(application, projectUrl, issuerStatusUrl(req, application));
      if (result.sent) {
        store.run("UPDATE issuer_applications SET owner_notified_at = ? WHERE id = ?", [new Date().toISOString(), application.id]);
        store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Admin', 'sent_project_owner_approval_email', ?, ?, ?)", [application.email, project.slug, new Date().toISOString()]);
      } else {
        store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES ('Admin', 'skipped_project_owner_approval_email', ?, ?, ?)", [application.email, result.reason || "not_sent", new Date().toISOString()]);
      }
      res.redirect(`/admin/projects/${project.id}`);
    } catch (error) {
      res.status(400).send(layout("Crear proyecto", `<main class="page"><div class="panel"><div class="alert">${errorMessage(error)}</div><p><a class="button small" href="/admin/issuers/${application.id}">Volver</a></p></div></main>`, req));
    }
  });

  app.post("/admin/issuers/:id/message", requireAdmin, async (req, res) => {
    const application = store.get("SELECT * FROM issuer_applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).send("Solicitud no encontrada");
    const channel = ["email", "whatsapp", "both"].includes(req.body.channel) ? req.body.channel : "email";
    const subject = String(req.body.subject || "Actualizacion de solicitud").trim();
    const message = String(req.body.message || "").trim();
    if (!message) return res.redirect(`/admin/issuers/${application.id}`);
    let status = "recorded";
    if (channel === "email" || channel === "both") {
      const result = await sendIssuerMessage(application, { subject, message, statusUrl: issuerStatusUrl(req, application) });
      status = result.sent ? "sent_email" : `email_${result.reason || "not_sent"}`;
    }
    store.run("INSERT INTO issuer_messages (application_id, sender, channel, subject, message, status, created_at) VALUES (?, 'Admin', ?, ?, ?, ?, ?)", [
      application.id,
      channel,
      subject,
      message,
      status,
      new Date().toISOString()
    ]);
    if (channel === "whatsapp" || channel === "both") {
      const url = issuerWhatsappUrl(application, `${message}\n\n${issuerStatusUrl(req, application)}`);
      if (url) return res.redirect(url);
    }
    res.redirect(`/admin/issuers/${application.id}`);
  });

  app.get("/admin/issuers/documents/:id/download", requireAdmin, (req, res) => {
    const doc = store.get("SELECT * FROM issuer_documents WHERE id = ?", [req.params.id]);
    if (!doc) return res.status(404).send("Documento no encontrado");
    const absolutePath = path.join(__dirname, "..", "..", "private", doc.file_path.replace(/^\/issuer\//, "issuer/"));
    if (!fs.existsSync(absolutePath)) return res.status(404).send("Archivo no encontrado");
    res.download(absolutePath, doc.original_name);
  });

  app.get("/admin/kyc", requireAdmin, (req, res) => {
    const investors = store.all(`
      SELECT u.*, COUNT(k.id) document_count
      FROM users u
      LEFT JOIN kyc_documents k ON k.user_id = u.id
      WHERE u.role = 'investor'
      GROUP BY u.id
      ORDER BY CASE u.kyc_status WHEN 'submitted' THEN 1 WHEN 'needs_more_info' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END, u.id DESC
    `);
    res.send(layout("KYC", `
      <main class="page adminPage">
        <div class="adminHero">
          <div><p class="eyebrow">Compliance</p><h1>KYC / AML</h1><p class="muted">Revision de inversionistas, documentos y estados de cumplimiento.</p></div>
          <div class="adminActions"><a class="button small" href="/admin">Volver</a><a class="button danger small" href="/logout">${tr(req).logout}</a></div>
        </div>
        <div class="panel adminPanel tablePanel">
          <table class="dataTable">
            <thead><tr><th>Inversionista</th><th>Email</th><th>Telefono</th><th>Pais</th><th>Wallet</th><th>KYC</th><th>Docs</th><th></th></tr></thead>
            <tbody>
              ${investors.map((user) => `<tr><td>${user.name}</td><td>${user.email}</td><td>${user.phone || "pendiente"}</td><td>${user.country}</td><td>${user.wallet || "pendiente"}</td><td>${statusLabel(user.kyc_status)}</td><td>${user.document_count}</td><td><a href="/admin/kyc/${user.id}">Revisar</a></td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </main>
    `, req));
  });

  app.get("/admin/kyc/:id", requireAdmin, (req, res) => {
    const user = store.get("SELECT * FROM users WHERE id = ? AND role = 'investor'", [req.params.id]);
    if (!user) return res.status(404).send("Inversionista no encontrado");
    const docs = store.all("SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC", [user.id]);
    const investments = store.all(`
      SELECT i.*, p.title, p.token_symbol
      FROM investments i JOIN projects p ON p.id = i.project_id
      WHERE i.user_id = ?
      ORDER BY i.id DESC
    `, [user.id]);
    res.send(layout(`KYC ${user.name}`, `
      <main class="page adminPage">
        <div class="adminHero">
          <div><p class="eyebrow">Expediente KYC</p><h1>${user.name}</h1><p class="muted">${user.email} - ${user.phone || "sin telefono"} - ${user.country} - ${statusLabel(user.kyc_status)}</p></div>
          <div class="adminActions"><a class="button small" href="/admin/kyc">Volver</a><a class="button danger small" href="/logout">${tr(req).logout}</a></div>
        </div>
        <section class="split">
          <form class="panel contactForm adminPanel" method="post" action="/admin/kyc/${user.id}">
            <h3>Decision de cumplimiento</h3>
            <label>Estado KYC<select name="kyc_status">
              ${["not_started", "submitted", "needs_more_info", "approved", "rejected"].map((status) => `<option value="${status}" ${user.kyc_status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
            </select></label>
            <label>Nota interna<textarea name="notes" rows="5" placeholder="Observaciones, documentos faltantes o razon de aprobacion/rechazo."></textarea></label>
            <button class="button primary" type="submit">Guardar decision</button>
          </form>
          <div class="panel adminPanel">
            <h3>Verificaciones</h3>
            <div class="fact"><span>Email</span><strong>${statusLabel(user.email_verified ? "approved" : "submitted")}</strong></div>
            <div class="fact"><span>Telefono</span><strong>${statusLabel(user.phone_verified ? "approved" : "submitted")}</strong></div>
            <div class="fact"><span>Cedula / pasaporte</span><strong>${statusLabel(user.identity_verified ? "approved" : (user.identity_check_status || "pending"))}</strong></div>
            <p class="muted">La validacion legal de cedula/pasaporte queda registrada por compliance. Para produccion debe conectarse un proveedor KYC o una verificacion documental autorizada.</p>
            <h3>Ordenes del inversionista</h3>
            ${investments.map((item) => `<div class="event"><b>${item.title}</b><span>${money.format(item.amount)} - ${item.tokens} ${item.token_symbol}</span><p>${statusLabel(item.status)}${item.investor_note ? ` - ${item.investor_note}` : ""}</p></div>`).join("") || "<p class=\"muted\">Sin ordenes.</p>"}
          </div>
        </section>
        <div class="panel adminPanel tablePanel">
          <h3>Documentos</h3>
          <table class="dataTable">
            <thead><tr><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Subido</th><th></th></tr></thead>
            <tbody>
              ${docs.map((doc) => `<tr><td>${doc.document_type}</td><td>${doc.original_name}</td><td>${statusLabel(doc.status)}</td><td>${doc.uploaded_at}</td><td><a href="/admin/kyc/documents/${doc.id}/download">Descargar</a></td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </main>
    `, req));
  });

  app.post("/admin/kyc/:id", requireAdmin, (req, res) => {
    const user = store.get("SELECT * FROM users WHERE id = ? AND role = 'investor'", [req.params.id]);
    if (!user) return res.status(404).send("Inversionista no encontrado");
    const allowed = new Set(["not_started", "submitted", "needs_more_info", "approved", "rejected"]);
    const status = allowed.has(req.body.kyc_status) ? req.body.kyc_status : user.kyc_status;
    store.run("UPDATE users SET kyc_status = ?, email_verified = ?, phone_verified = ?, identity_verified = ?, identity_check_status = ? WHERE id = ?", [
      status,
      status === "approved" ? 1 : user.email_verified || 0,
      status === "approved" ? 1 : user.phone_verified || 0,
      status === "approved" ? 1 : 0,
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending",
      user.id
    ]);
    store.run("UPDATE kyc_documents SET status = ?, notes = ?, reviewed_at = ? WHERE user_id = ?", [
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "submitted",
      req.body.notes || "",
      new Date().toISOString(),
      user.id
    ]);
    if (status === "approved") {
      store.run("UPDATE investments SET status = 'pending_payment' WHERE user_id = ? AND status = 'compliance_review'", [user.id]);
    }
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'reviewed_kyc', ?, ?, ?)", ["Admin", user.email, `${status}: ${req.body.notes || ""}`, new Date().toISOString()]);
    res.redirect(`/admin/kyc/${user.id}`);
  });

  app.get("/admin/kyc/documents/:id/download", requireAdmin, (req, res) => {
    const doc = store.get("SELECT * FROM kyc_documents WHERE id = ?", [req.params.id]);
    if (!doc) return res.status(404).send("Documento no encontrado");
    const absolutePath = path.join(__dirname, "..", "..", "private", doc.file_path.replace(/^\/kyc\//, "kyc/"));
    if (!fs.existsSync(absolutePath)) return res.status(404).send("Archivo no encontrado");
    res.download(absolutePath, doc.original_name);
  });

  app.get("/admin/tokenization", requireAdmin, (req, res) => {
    const projects = store.all(`
      SELECT p.*, tm.mint_address, tm.network, tm.status mint_status, tm.multisig_wallet, tm.decimals mint_decimals
      FROM projects p
      LEFT JOIN token_mints tm ON tm.project_id = p.id
      ORDER BY p.id
    `);
    const pendingInvestments = store.all(`
      SELECT i.*, u.name investor_name, u.kyc_status, p.title project_title, p.token_symbol
      FROM investments i
      JOIN users u ON u.id = i.user_id
      JOIN projects p ON p.id = i.project_id
      WHERE i.status NOT IN ('tokens_issued', 'canceled')
      ORDER BY i.id DESC
    `);
    const issuedInvestments = store.all(`
      SELECT i.*, u.name investor_name, u.kyc_status, p.title project_title, p.token_symbol
      FROM investments i
      JOIN users u ON u.id = i.user_id
      JOIN projects p ON p.id = i.project_id
      WHERE i.status = 'tokens_issued'
      ORDER BY i.id DESC
      LIMIT 20
    `);
    const balances = store.all(`
      SELECT tb.*, u.name investor_name, p.title project_title
      FROM token_balances tb
      JOIN users u ON u.id = tb.user_id
      JOIN projects p ON p.id = tb.project_id
      ORDER BY tb.updated_at DESC
    `);
    const events = store.all(`
      SELECT te.*, p.token_symbol, p.title project_title
      FROM token_events te
      JOIN projects p ON p.id = te.project_id
      ORDER BY te.id DESC LIMIT 12
    `);
    res.send(layout("Tokenizacion", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">Solana</p>
          <h1>Tokenizacion de proyectos</h1>
          <p class="muted">Panel operativo para crear mints SPL en Solana devnet, preparar wallets, revisar whitelist KYC y emitir tokens de prueba.</p>
          <p><a class="button small" href="/admin">Volver</a></p>
        </div>
        <section class="panel adminPanel">
          <h3>Mints por proyecto</h3>
          <div class="mintGrid">
            ${projects.map((project) => `<article class="mintItem">
              <div>
                <span class="statusBadge">${project.mint_status || "pending"}</span>
                <h4>${project.title}</h4>
                <p>${project.token_symbol} - Supply ${project.token_supply}</p>
                <span class="monoBreak">Mint: ${project.mint_address || "No configurado"}</span>
                <span class="monoBreak">Authority: ${project.multisig_wallet || "Pendiente"}</span>
              </div>
              <div class="mintActions">
                ${project.mint_address && isValidSolanaAddress(project.mint_address) && Number(project.mint_decimals) === config.solanaTokenDecimals ? `<span class="statusBadge">Mint creado</span><a class="button primary" href="${solanaExplorerAddress(project.mint_address)}" target="_blank" rel="noopener">Ver mint en Solana Explorer</a>` : `<span class="statusBadge">Mint pendiente</span><a class="button primary" href="/admin/tokenization/projects/${project.id}/mint">${isRealSolanaEnabled() ? "Crear mint real en devnet" : "Configurar mint demo"}</a>`}
              </div>
            </article>`).join("")}
          </div>
        </section>
        <section class="split">
          <div class="panel">
            <h3>Ordenes por procesar</h3>
            ${pendingInvestments.map((item) => `<div class="event"><b>Orden #${item.id} - ${item.investor_name} - ${item.project_title}</b><span>${item.tokens} ${item.token_symbol} - KYC: ${item.kyc_status} - Orden: ${statusLabel(item.status)} - Pago: ${item.payment_status || "pendiente"}</span><p>Pago esperado: ${number.format(item.payment_expected_sol || 0)} SOL${item.payment_signature ? ` - Firma: ${item.payment_signature}` : ""}</p>${item.status === "payment_received" ? `<form method="post" action="/admin/tokenization/investments/${item.id}/issue"><button class="button small" type="submit">Emitir tokens</button></form>` : `<span class="statusBadge">Esperando pago on-chain</span>`}</div>`).join("") || "<p class=\"muted\">No hay ordenes por procesar.</p>"}
          </div>
          <div class="panel">
            <h3>Balances tokenizados</h3>
            ${balances.map((balance) => `<div class="event"><b>${balance.investor_name}</b><span>${balance.project_title}</span><p>${balance.balance} ${balance.token_symbol} / bloqueados: ${balance.locked_balance}</p><span>${balance.wallet_address}</span></div>`).join("") || "<p class=\"muted\">Sin balances todavia.</p>"}
          </div>
        </section>
        <section class="panel">
          <h3>Ordenes emitidas</h3>
          ${issuedInvestments.map((item) => renderIssuedInvestment(item)).join("") || "<p class=\"muted\">Todavia no hay ordenes emitidas.</p>"}
        </section>
        <section class="panel">
          <h3>Eventos on-chain simulados</h3>
          ${events.map((event) => renderTokenEvent(event)).join("")}
        </section>
      </main>
    `, req));
  });

  async function createProjectMint(req, res) {
    const project = store.get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) return res.status(404).send("Proyecto no encontrado");
    try {
      await ensureProjectMint(project);
      res.redirect("/admin/tokenization");
    } catch (error) {
      res.status(400).send(layout("Tokenizacion", `<main class="page"><div class="panel"><div class="alert">${errorMessage(error)}</div><p><a class="button small" href="/admin/tokenization">Volver</a></p></div></main>`, req));
    }
  }

  app.get("/admin/tokenization/projects/:id/mint", requireAdmin, createProjectMint);
  app.post("/admin/tokenization/projects/:id/mint", requireAdmin, createProjectMint);

  app.post("/admin/tokenization/investments/:id/issue", requireAdmin, async (req, res) => {
    try {
      await issueTokensForInvestment(req.params.id);
      res.redirect("/admin/tokenization");
    } catch (error) {
      res.status(400).send(layout("Tokenizacion", `<main class="page"><div class="panel"><div class="alert">${errorMessage(error)}</div><p><a class="button small" href="/admin/tokenization">Volver</a></p></div></main>`, req));
    }
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
