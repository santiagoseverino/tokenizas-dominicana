const { initDb, get, run } = require("./db");
const { ensureProjectMint } = require("./lib/tokenization");

(async () => {
  await initDb();
  const now = new Date().toISOString();
  const project = {
    slug: "finca-cacao-bayaguana",
    category: "agriculture",
    title: "Finca de Cacao Bayaguana",
    location: "Bayaguana, Monte Plata",
    type: "Agroinmobiliario / cacao",
    legal_structure: "Vehiculo privado de proyecto con derechos economicos sobre produccion, mejoras agricolas y flujo operativo documentado.",
    target_raise: 10000,
    min_investment: 250,
    token_symbol: "CACAO",
    token_supply: 10000,
    token_price: 1,
    expected_yield: 10,
    status: "open",
    image_url: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?auto=format&fit=crop&w=1400&q=80",
    description: "Proyecto de capital semilla para una finca de cacao en Bayaguana, orientado a mejoras productivas, mantenimiento agricola, preparacion de cosecha y formalizacion operativa. La oferta busca levantar USD 10,000 mediante tokens economicos de prueba.",
    risk_level: "Medio"
  };

  const existing = get("SELECT * FROM projects WHERE slug = ?", [project.slug]);
  if (existing) {
    run(`
      UPDATE projects
      SET category = ?, title = ?, location = ?, type = ?, legal_structure = ?, target_raise = ?, min_investment = ?,
          token_symbol = ?, token_supply = ?, token_price = ?, expected_yield = ?, status = ?, image_url = ?,
          description = ?, risk_level = ?
      WHERE slug = ?
    `, [
      project.category,
      project.title,
      project.location,
      project.type,
      project.legal_structure,
      project.target_raise,
      project.min_investment,
      project.token_symbol,
      project.token_supply,
      project.token_price,
      project.expected_yield,
      project.status,
      project.image_url,
      project.description,
      project.risk_level,
      project.slug
    ]);
  } else {
    run(`
      INSERT INTO projects
      (slug, category, title, location, type, legal_structure, target_raise, min_investment, token_symbol, token_supply, token_price, expected_yield, status, image_url, description, risk_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project.slug,
      project.category,
      project.title,
      project.location,
      project.type,
      project.legal_structure,
      project.target_raise,
      project.min_investment,
      project.token_symbol,
      project.token_supply,
      project.token_price,
      project.expected_yield,
      project.status,
      project.image_url,
      project.description,
      project.risk_level,
      now
    ]);
  }

  const savedProject = get("SELECT * FROM projects WHERE slug = ?", [project.slug]);
  const existingOffering = get("SELECT * FROM offerings WHERE project_id = ?", [savedProject.id]);
  if (existingOffering) {
    run("UPDATE offerings SET soft_cap = ?, hard_cap = ?, raised = ?, opens_at = ?, closes_at = ?, lockup_months = ? WHERE project_id = ?", [
      5000,
      10000,
      existingOffering.raised || 0,
      "2026-08-01",
      "2026-12-15",
      12,
      savedProject.id
    ]);
  } else {
    run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      savedProject.id,
      "Ronda Cacao Genesis",
      5000,
      10000,
      0,
      "2026-08-01",
      "2026-12-15",
      12
    ]);
  }

  run("DELETE FROM documents WHERE project_id = ?", [savedProject.id]);
  [
    ["Certificacion de propiedad o contrato de uso de la finca", "legal", "review"],
    ["Plan agricola y presupuesto de mejoras", "operational", "review"],
    ["Estimacion de produccion de cacao", "financial", "review"],
    ["Modelo de distribucion economica para inversionistas", "financial", "review"],
    ["KYC/KYB del promotor del proyecto", "compliance", "review"]
  ].forEach((doc) => {
    run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, ?, ?)", [savedProject.id, doc[0], doc[1], doc[2]]);
  });

  await ensureProjectMint(savedProject);
  run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [
    "Seeder",
    existing ? "updated_cacao_project" : "created_cacao_project",
    savedProject.title,
    "Meta USD 10,000 / Token CACAO / Bayaguana",
    now
  ]);

  console.log(`Proyecto listo: ${savedProject.title}`);
  console.log(`URL: /projects/${savedProject.slug}`);
  console.log("Meta: USD 10,000");
})();
