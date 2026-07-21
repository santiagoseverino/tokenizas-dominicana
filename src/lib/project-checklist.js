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
  statusLabels,
  updateProjectChecklistItem
};
