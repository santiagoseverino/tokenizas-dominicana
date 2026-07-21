const store = require("../db");

const defaultChecklist = [
  ["legal", "owner_kyb", "KYB del dueno o empresa emisora"],
  ["legal", "legal_owner", "Titularidad legal o derecho economico documentado"],
  ["legal", "legal_opinion", "Opinion legal sobre la estructura de tokenizacion"],
  ["financial", "budget", "Presupuesto detallado y uso de fondos"],
  ["financial", "financial_model", "Modelo financiero y retorno proyectado"],
  ["permits", "permits", "Permisos, licencias o no objeciones aplicables"],
  ["tokenization", "tokenomics", "Tokenomics: supply, precio, simbolo y reglas"],
  ["tokenization", "solana_mint", "Mint Solana devnet/mainnet y metadata del token"],
  ["publication", "public_content", "Contenido publico, imagenes y documentos visibles"],
  ["publication", "final_review", "Revision final antes de publicar o abrir inversion"]
];

const statusLabels = {
  pending: "Pendiente",
  review: "En revision",
  done: "Completado",
  blocked: "Bloqueado"
};

function ensureProjectChecklist(projectId) {
  const now = new Date().toISOString();
  defaultChecklist.forEach(([category, itemKey, label]) => {
    store.run(`
      INSERT OR IGNORE INTO project_checklist
      (project_id, category, item_key, label, status, notes, visible_to_owner, updated_at)
      VALUES (?, ?, ?, ?, 'pending', '', 1, ?)
    `, [projectId, category, itemKey, label, now]);
  });
  syncProjectChecklist(projectId);
}

function markDone(projectId, itemKey, note) {
  const item = store.get("SELECT * FROM project_checklist WHERE project_id = ? AND item_key = ?", [projectId, itemKey]);
  if (!item || item.status === "done" || item.status === "blocked") return;
  store.run(`
    UPDATE project_checklist
    SET status = 'done', notes = ?, updated_at = ?
    WHERE id = ?
  `, [note, new Date().toISOString(), item.id]);
}

function syncProjectChecklist(projectId) {
  const project = store.get("SELECT * FROM projects WHERE id = ?", [projectId]);
  if (!project) return;
  const offering = store.get("SELECT * FROM offerings WHERE project_id = ?", [projectId]);
  const mint = store.get("SELECT * FROM token_mints WHERE project_id = ?", [projectId]);
  const docs = store.all("SELECT * FROM documents WHERE project_id = ?", [projectId]);
  const docText = docs.map((doc) => `${doc.title} ${doc.category} ${doc.status}`).join(" ").toLowerCase();

  if (project.legal_structure) markDone(projectId, "legal_owner", "Estructura legal registrada en el proyecto.");
  if (project.target_raise && offering) markDone(projectId, "budget", "Meta y ronda de oferta configuradas.");
  if (project.expected_yield && offering) markDone(projectId, "financial_model", "Rendimiento esperado y oferta configurados.");
  if (project.token_symbol && project.token_supply && project.token_price) markDone(projectId, "tokenomics", "Simbolo, supply y precio del token configurados.");
  if (mint && mint.mint_address && !String(mint.mint_address).startsWith("Mint")) markDone(projectId, "solana_mint", `Mint configurado: ${mint.mint_address}`);
  if (project.title && project.description && project.image_url) markDone(projectId, "public_content", "Contenido publico e imagen del proyecto configurados.");
  if (["open", "funded"].includes(project.status)) markDone(projectId, "final_review", "Proyecto marcado como abierto o financiado.");
  if (/kyb|kyc|emisor|dueno|owner/.test(docText)) markDone(projectId, "owner_kyb", "Documento KYB/KYC registrado.");
  if (/opinion legal|legal/.test(docText)) markDone(projectId, "legal_opinion", "Documento legal registrado.");
  if (/permiso|licencia|autorizacion|no objecion|authority|permit/.test(docText)) markDone(projectId, "permits", "Documento de permisos o autorizaciones registrado.");
}

function getProjectChecklist(projectId, ownerOnly = false) {
  ensureProjectChecklist(projectId);
  const where = ownerOnly ? " AND visible_to_owner = 1" : "";
  return store.all(`SELECT * FROM project_checklist WHERE project_id = ?${where} ORDER BY id`, [projectId]);
}

function checklistProgress(items) {
  const total = items.length || 0;
  const done = items.filter((item) => item.status === "done").length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

function incompleteChecklistItems(projectId) {
  return getProjectChecklist(projectId).filter((item) => item.status !== "done");
}

function updateProjectChecklistItem(id, values) {
  const allowed = new Set(["pending", "review", "done", "blocked"]);
  const status = allowed.has(values.status) ? values.status : "pending";
  store.run(`
    UPDATE project_checklist
    SET status = ?, notes = ?, visible_to_owner = ?, updated_at = ?
    WHERE id = ?
  `, [
    status,
    String(values.notes || "").trim(),
    values.visibleToOwner ? 1 : 0,
    new Date().toISOString(),
    id
  ]);
}

module.exports = {
  checklistProgress,
  ensureProjectChecklist,
  getProjectChecklist,
  incompleteChecklistItems,
  statusLabels,
  updateProjectChecklistItem
};
