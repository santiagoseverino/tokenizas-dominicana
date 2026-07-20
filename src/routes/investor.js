const fs = require("fs");
const path = require("path");
const store = require("../db");
const { currentInvestor, hashPassword, investorSessionCookieValue, requireInvestor, verifyPassword } = require("../middleware/auth");
const { readForm } = require("../lib/multipart");
const { tr } = require("../lib/i18n");
const { localizeProjects } = require("../lib/project-content");
const { layout, money, number, statusLabel } = require("../lib/ui");

const kycUploadDir = path.join(__dirname, "..", "..", "private", "kyc");

const documentTypeKeys = ["identity", "selfie", "address", "funds", "investor_profile"];

function documentTypes(req) {
  const labels = tr(req).investor.documentTypes;
  return documentTypeKeys.map((key) => [key, labels[key]]);
}

function authForm(req, mode, error = "") {
  const isRegister = mode === "register";
  const t = tr(req).investor;
  return layout(isRegister ? t.register : t.login, `
    <main class="authPage">
      <form class="panel loginPanel" method="post" action="${isRegister ? "/investor/register" : "/investor/login"}">
        <div class="loginMark">INV</div>
        <p class="eyebrow">${t.portal}</p>
        <h1>${isRegister ? t.register : t.login}</h1>
        <p class="muted">${isRegister ? t.registerLead : t.loginLead}</p>
        ${error ? `<div class="alert">${error}</div>` : ""}
        ${isRegister ? `
          <label>${t.fullName}<input name="name" autocomplete="name" required /></label>
          <label>${t.residenceCountry}<input name="country" value="Republica Dominicana" required /></label>
          <label>${t.solanaWallet}<input name="wallet" placeholder="${t.optionalNow}" /></label>
        ` : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>${tr(req).password}<input name="password" type="password" minlength="10" autocomplete="${isRegister ? "new-password" : "current-password"}" required /></label>
        <button class="button primary" type="submit">${isRegister ? t.register : t.login}</button>
        <p class="muted">${isRegister ? t.alreadyAccount : t.noAccount} <a href="${isRegister ? "/investor/login" : "/investor/register"}">${isRegister ? t.login : t.register}</a></p>
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
  const t = tr(req).investor;
  const investments = localizeProjects(store.all(`
    SELECT i.*, p.slug, p.title, p.token_symbol, p.image_url, p.location
    FROM investments i
    JOIN projects p ON p.id = i.project_id
    WHERE i.user_id = ?
    ORDER BY i.id DESC
  `, [user.id]), req);
  const docs = store.all("SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY uploaded_at DESC", [user.id]);
  const docTypes = documentTypes(req);
  const requiredTypes = new Set(docTypes.map((item) => item[0]));
  docs.forEach((doc) => requiredTypes.delete(doc.document_type));
  return layout(t.portal, `
    <main class="page investorPage">
      <div class="adminHero">
        <div>
          <p class="eyebrow">${t.portal}</p>
          <h1>${user.name}</h1>
          <p class="muted">KYC: ${statusLabel(user.kyc_status, req)} - ${tr(req).wallet}: ${user.wallet || tr(req).dashboardText.pending}</p>
        </div>
        <div class="adminActions">
          <a class="button primary small" href="/invest">${t.createOrder}</a>
          <a class="button small" href="/investor/kyc">${t.completeKyc}</a>
          <a class="button danger small" href="/investor/logout">${t.exit}</a>
        </div>
      </div>
      ${message ? `<div class="success">${message}</div>` : ""}
      <section class="metrics compact">
        <article><strong>${money.format(investments.reduce((sum, item) => sum + item.amount, 0))}</strong><span>${t.reserved}</span></article>
        <article><strong>${number.format(investments.reduce((sum, item) => sum + item.tokens, 0))}</strong><span>Tokens</span></article>
        <article><strong>${docs.length}/5</strong><span>${t.kycDocuments}</span></article>
      </section>
      <section class="split">
        <div class="panel adminPanel">
          <h3>${t.myOrders}</h3>
          <div class="portfolio">${investments.map((item) => `<article class="holding"><img src="${item.image_url}" alt="${item.title}" /><div><h3>${item.title}</h3><p>${item.location}</p></div><b>${number.format(item.tokens)} ${item.token_symbol}</b><span>${money.format(item.amount)}</span><em>${statusLabel(item.status, req)}</em></article>`).join("") || `<p class="muted">${t.noOrders}</p>`}</div>
        </div>
        <div class="panel adminPanel">
          <h3>KYC</h3>
          ${requiredTypes.size ? `<div class="alert">${t.missingDocs}</div>` : `<div class="success">${t.kycSubmitted}</div>`}
          ${docs.map((doc) => `<div class="event"><b>${docTypes.find((item) => item[0] === doc.document_type)?.[1] || doc.document_type}</b><span>${doc.original_name}</span><p>${statusLabel(doc.status, req)}</p></div>`).join("") || `<p class="muted">${t.noUploadedDocs}</p>`}
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
    if (!name || !email || !country || password.length < 10) return res.status(400).send(authForm(req, "register", tr(req).investor.completeFields));
    if (store.get("SELECT id FROM users WHERE email = ?", [email])) return res.status(400).send(authForm(req, "register", tr(req).investor.emailExists));
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
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) return res.status(401).send(authForm(req, "login", tr(req).investor.badLogin));
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
    const t = tr(req).investor;
    const docTypes = documentTypes(req);
    res.send(layout("KYC", `
      <main class="page investorPage">
        <div class="adminHero">
          <div><p class="eyebrow">KYC / AML</p><h1>${t.kycTitle}</h1><p class="muted">${t.kycLead}</p></div>
          <div class="adminActions"><a class="button small" href="/investor">${t.portal}</a><a class="button danger small" href="/investor/logout">${t.exit}</a></div>
        </div>
        <section class="split">
          <form class="panel contactForm adminPanel" method="post" enctype="multipart/form-data" action="/investor/kyc">
            <h3>${t.uploadDocument}</h3>
            <label>${t.documentType}<select name="document_type">${docTypes.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label>${tr(req).file}<input name="kyc_document" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required /></label>
            <button class="button primary" type="submit">${t.uploadDocument}</button>
          </form>
          <div class="panel adminPanel">
            <h3>${t.sentDocuments}</h3>
            ${docs.map((doc) => `<div class="event"><b>${docTypes.find((item) => item[0] === doc.document_type)?.[1] || doc.document_type}</b><span>${doc.original_name}</span><p>${statusLabel(doc.status, req)}</p></div>`).join("") || `<p class="muted">${t.noDocumentsYet}</p>`}
          </div>
        </section>
      </main>
    `, req));
  });

  app.post("/investor/kyc", requireInvestor, async (req, res) => {
    try {
      const form = await readForm(req, 8 * 1024 * 1024);
      const documentType = String(form.fields.document_type || "");
      if (!documentTypeKeys.includes(documentType)) throw new Error(tr(req).investor.invalidDocType);
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
      res.status(400).send(layout("KYC", `<main class="page investorPage"><div class="panel adminPanel"><div class="alert">${error.message}</div><p><a class="button small" href="/investor/kyc">${tr(req).back}</a></p></div></main>`, req));
    }
  });
}

module.exports = registerInvestorRoutes;
