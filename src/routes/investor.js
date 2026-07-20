const fs = require("fs");
const path = require("path");
const store = require("../db");
const { currentInvestor, hashPassword, investorSessionCookieValue, requireInvestor, verifyPassword } = require("../middleware/auth");
const { readForm } = require("../lib/multipart");
const { layout, money, number, statusLabel } = require("../lib/ui");

const kycUploadDir = path.join(__dirname, "..", "..", "private", "kyc");

const documentTypes = [
  ["identity", "Cedula o pasaporte"],
  ["selfie", "Selfie / prueba de vida"],
  ["address", "Comprobante de direccion"],
  ["funds", "Origen de fondos"],
  ["investor_profile", "Perfil de inversionista"]
];

function authForm(req, mode, error = "") {
  const isRegister = mode === "register";
  return layout(isRegister ? "Registro inversionista" : "Login inversionista", `
    <main class="authPage">
      <form class="panel loginPanel" method="post" action="${isRegister ? "/investor/register" : "/investor/login"}">
        <div class="loginMark">INV</div>
        <p class="eyebrow">Portal inversionista</p>
        <h1>${isRegister ? "Crear cuenta" : "Entrar"}</h1>
        <p class="muted">${isRegister ? "Crea tu acceso para invertir, completar KYC y ver tus ordenes." : "Accede a tus ordenes, KYC, wallet y documentos."}</p>
        ${error ? `<div class="alert">${error}</div>` : ""}
        ${isRegister ? `
          <label>Nombre completo<input name="name" autocomplete="name" required /></label>
          <label>Pais de residencia<input name="country" value="Republica Dominicana" required /></label>
          <label>Wallet Solana<input name="wallet" placeholder="Opcional por ahora" /></label>
        ` : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Clave<input name="password" type="password" minlength="10" autocomplete="${isRegister ? "new-password" : "current-password"}" required /></label>
        <button class="button primary" type="submit">${isRegister ? "Crear cuenta" : "Entrar"}</button>
        <p class="muted">${isRegister ? "Ya tienes cuenta?" : "No tienes cuenta?"} <a href="${isRegister ? "/investor/login" : "/investor/register"}">${isRegister ? "Entrar" : "Crear cuenta"}</a></p>
      </form>
    </main>
  `, req);
}

function saveKycDocument(file, userId, documentType) {
  if (!file || !file.buffer || file.buffer.length === 0) throw new Error("Selecciona un documento.");
  const allowed = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf"
  };
  const extension = allowed[file.contentType];
  if (!extension) throw new Error("Solo se permiten PDF, JPG, PNG o WebP.");
  const safeType = String(documentType || "document").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const targetDir = path.join(kycUploadDir, String(userId));
  fs.mkdirSync(targetDir, { recursive: true });
  const filename = `${safeType}-${Date.now()}${extension}`;
  const diskPath = path.join(targetDir, filename);
  fs.writeFileSync(diskPath, file.buffer);
  return {
    filePath: `/kyc/${userId}/${filename}`,
    originalName: file.filename,
    mimeType: file.contentType
  };
}

function renderPortal(req, message = "") {
  const user = req.investor;
  const investments = store.all(`
    SELECT i.*, p.title, p.token_symbol, p.image_url, p.location
    FROM investments i
    JOIN projects p ON p.id = i.project_id
    WHERE i.user_id = ?
    ORDER BY i.id DESC
  `, [user.id]);
  const docs = store.all("SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC", [user.id]);
  const requiredTypes = new Set(documentTypes.map((item) => item[0]));
  docs.forEach((doc) => requiredTypes.delete(doc.document_type));
  return layout("Portal inversionista", `
    <main class="page investorPage">
      <div class="adminHero">
        <div>
          <p class="eyebrow">Portal inversionista</p>
          <h1>${user.name}</h1>
          <p class="muted">KYC: ${statusLabel(user.kyc_status)} - Wallet: ${user.wallet || "pendiente"}</p>
        </div>
        <div class="adminActions">
          <a class="button primary small" href="/invest">Crear orden</a>
          <a class="button small" href="/investor/kyc">Completar KYC</a>
          <a class="button danger small" href="/investor/logout">Salir</a>
        </div>
      </div>
      ${message ? `<div class="success">${message}</div>` : ""}
      <section class="metrics compact">
        <article><strong>${money.format(investments.reduce((sum, item) => sum + item.amount, 0))}</strong><span>Reservado</span></article>
        <article><strong>${number.format(investments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
        <article><strong>${docs.length}/5</strong><span>Documentos KYC</span></article>
      </section>
      <section class="split">
        <div class="panel adminPanel">
          <h3>Mis ordenes</h3>
          <div class="portfolio">${investments.map((item) => `<article class="holding"><img src="${item.image_url}" alt="${item.title}" /><div><h3>${item.title}</h3><p>${item.location}</p></div><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${money.format(item.amount)}</span><em>${statusLabel(item.status)}</em></article>`).join("") || "<p class=\"muted\">Todavia no tienes ordenes.</p>"}</div>
        </div>
        <div class="panel adminPanel">
          <h3>KYC</h3>
          ${requiredTypes.size ? `<div class="alert">Faltan documentos para completar tu expediente.</div>` : `<div class="success">Expediente KYC enviado para revision.</div>`}
          ${docs.map((doc) => `<div class="event"><b>${documentTypes.find((item) => item[0] === doc.document_type)?.[1] || doc.document_type}</b><span>${doc.original_name}</span><p>${statusLabel(doc.status)}</p></div>`).join("") || "<p class=\"muted\">Sin documentos subidos.</p>"}
        </div>
      </section>
    </main>
  `, req);
}

function registerInvestorRoutes(app) {
  app.get("/investor/register", (req, res) => {
    if (currentInvestor(req)) return res.redirect("/investor");
    res.send(authForm(req, "register"));
  });

  app.post("/investor/register", (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const country = String(req.body.country || "").trim();
    const wallet = String(req.body.wallet || "").trim();
    const password = String(req.body.password || "");
    if (!name || !email || !country || password.length < 10) return res.status(400).send(authForm(req, "register", "Completa los campos y usa una clave de 10 caracteres o mas."));
    if (store.get("SELECT id FROM users WHERE email = ?", [email])) return res.status(400).send(authForm(req, "register", "Ese email ya esta registrado."));
    store.run("INSERT INTO users (name, email, role, country, kyc_status, wallet, password_hash, created_at) VALUES (?, ?, 'investor', ?, 'not_started', ?, ?, ?)", [
      name,
      email,
      country,
      wallet || null,
      hashPassword(password),
      new Date().toISOString()
    ]);
    const user = store.get("SELECT * FROM users WHERE email = ?", [email]);
    res.setHeader("Set-Cookie", `tokenizas_investor=${encodeURIComponent(investorSessionCookieValue(user))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.redirect("/investor/kyc");
  });

  app.get("/investor/login", (req, res) => {
    if (currentInvestor(req)) return res.redirect("/investor");
    res.send(authForm(req, "login"));
  });

  app.post("/investor/login", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = store.get("SELECT * FROM users WHERE email = ? AND role = 'investor'", [email]);
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) return res.status(401).send(authForm(req, "login", "Email o clave incorrectos."));
    res.setHeader("Set-Cookie", `tokenizas_investor=${encodeURIComponent(investorSessionCookieValue(user))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.redirect("/investor");
  });

  app.get("/investor/logout", (req, res) => {
    res.setHeader("Set-Cookie", "tokenizas_investor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    res.redirect("/investor/login");
  });

  app.get("/investor", requireInvestor, (req, res) => res.send(renderPortal(req)));

  app.get("/investor/kyc", requireInvestor, (req, res) => {
    const docs = store.all("SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC", [req.investor.id]);
    res.send(layout("KYC", `
      <main class="page investorPage">
        <div class="adminHero">
          <div><p class="eyebrow">KYC / AML</p><h1>Completar expediente</h1><p class="muted">Sube documentos claros en PDF, JPG, PNG o WebP. Maximo 8 MB por archivo.</p></div>
          <div class="adminActions"><a class="button small" href="/investor">Portal</a><a class="button danger small" href="/investor/logout">Salir</a></div>
        </div>
        <section class="split">
          <form class="panel contactForm adminPanel" method="post" enctype="multipart/form-data" action="/investor/kyc">
            <h3>Subir documento</h3>
            <label>Tipo de documento<select name="document_type">${documentTypes.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label>Archivo<input name="kyc_document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required /></label>
            <button class="button primary" type="submit">Subir documento</button>
          </form>
          <div class="panel adminPanel">
            <h3>Documentos enviados</h3>
            ${docs.map((doc) => `<div class="event"><b>${documentTypes.find((item) => item[0] === doc.document_type)?.[1] || doc.document_type}</b><span>${doc.original_name}</span><p>${statusLabel(doc.status)}</p></div>`).join("") || "<p class=\"muted\">Sin documentos todavia.</p>"}
          </div>
        </section>
      </main>
    `, req));
  });

  app.post("/investor/kyc", requireInvestor, async (req, res) => {
    try {
      const form = await readForm(req, 8 * 1024 * 1024);
      const documentType = String(form.fields.document_type || "");
      if (!documentTypes.some(([value]) => value === documentType)) throw new Error("Tipo de documento invalido.");
      const saved = saveKycDocument(form.files.kyc_document, req.investor.id, documentType);
      store.run("INSERT INTO kyc_documents (user_id, document_type, original_name, file_path, mime_type, status, uploaded_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?)", [
        req.investor.id,
        documentType,
        saved.originalName,
        saved.filePath,
        saved.mimeType,
        new Date().toISOString()
      ]);
      store.run("UPDATE users SET kyc_status = 'submitted' WHERE id = ? AND kyc_status IN ('not_started', 'needs_more_info')", [req.investor.id]);
      store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, 'uploaded_kyc_document', 'kyc', ?, ?)", [
        req.investor.name,
        documentType,
        new Date().toISOString()
      ]);
      res.redirect("/investor?kyc=uploaded");
    } catch (error) {
      res.status(400).send(layout("KYC", `<main class="page investorPage"><div class="panel adminPanel"><div class="alert">${error.message}</div><p><a class="button small" href="/investor/kyc">Volver</a></p></div></main>`, req));
    }
  });
}

module.exports = registerInvestorRoutes;
