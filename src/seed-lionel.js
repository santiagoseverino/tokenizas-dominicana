const { initDb, get, run } = require("./db");
const { ensureProjectMint } = require("./lib/tokenization");

(async () => {
  await initDb();
  const now = new Date().toISOString();
  const project = {
    slug: "lionel-the-star-entertainment",
    title: "Lionel The Star Entertainment",
    location: "Republica Dominicana / Puerto Rico / Florida / Nueva York",
    type: "Musica / bachata / merengue / eventos en vivo",
    legal_structure: "Acuerdo privado de participacion economica sobre utilidades netas del proyecto artistico, sujeto a contrato final, reportes periodicos y control de ingresos.",
    target_raise: 10000,
    min_investment: 250,
    token_symbol: "LIONEL",
    token_supply: 10000,
    token_price: 1,
    expected_yield: 20,
    status: "open",
    image_url: "/lionel-the-star.jpg",
    description: "Lionel The Star busca levantar US$10,000 para acelerar la comercializacion de un catalogo inicial de 14 canciones originales de bachata y merengue, varios videos musicales ya producidos, presencia digital y una estrategia enfocada en eventos, turismo, streaming, YouTube, patrocinios, merchandising y licencias.",
    risk_level: "Alto"
  };

  const existing = get("SELECT * FROM projects WHERE slug = ?", [project.slug]);
  if (existing) {
    run(`
      UPDATE projects
      SET title = ?, location = ?, type = ?, legal_structure = ?, target_raise = ?, min_investment = ?,
          token_symbol = ?, token_supply = ?, token_price = ?, expected_yield = ?, status = ?, image_url = ?,
          description = ?, risk_level = ?
      WHERE slug = ?
    `, [
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
      (slug, title, location, type, legal_structure, target_raise, min_investment, token_symbol, token_supply, token_price, expected_yield, status, image_url, description, risk_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project.slug,
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
      "2026-12-31",
      36,
      savedProject.id
    ]);
  } else {
    run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      savedProject.id,
      "Ronda Lionel Genesis",
      5000,
      10000,
      0,
      "2026-08-01",
      "2026-12-31",
      36
    ]);
  }

  run("DELETE FROM documents WHERE project_id = ?", [savedProject.id]);
  [
    ["Pitch deck inversionistas 2026-2031", "commercial", "approved"],
    ["Catalogo inicial: 14 canciones originales", "catalog", "review"],
    ["Videos musicales producidos y material audiovisual disponible", "media", "review"],
    ["Sitio web del artista: https://lionel.piergiorgiopalacehotel.lat/", "media", "review"],
    ["Uso de fondos: marketing US$5,000; branding US$2,000; web/CRM US$1,000; PR US$1,000; operativo US$1,000", "financial", "approved"],
    ["Modelo de ingresos: eventos, streaming, YouTube, patrocinios, merchandising y licencias", "financial", "review"],
    ["Economia sugerida: 20% inversionistas por 36 meses; 5% causa social animales", "legal", "review"],
    ["Riesgos y mitigacion: contratacion, streaming, costos operativos, salud/logistica", "risk", "review"]
  ].forEach((doc) => {
    run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, ?, ?)", [savedProject.id, doc[0], doc[1], doc[2]]);
  });

  await ensureProjectMint(savedProject);
  run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [
    "Seeder",
    existing ? "updated_lionel_project" : "created_lionel_project",
    savedProject.title,
    "Meta USD 10,000 / Token LIONEL / Musica bachata-merengue",
    now
  ]);

  console.log(`Proyecto listo: ${savedProject.title}`);
  console.log(`URL: /projects/${savedProject.slug}`);
  console.log("Meta: USD 10,000");
})();
