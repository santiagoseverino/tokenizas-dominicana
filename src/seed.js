const { initDb, all, run, exec } = require("./db");
const { ensureProjectMint, ensureWalletForUser, issueTokensForInvestment } = require("./lib/tokenization");

(async () => {
  await initDb();
  const now = new Date().toISOString();

  exec(`
    DELETE FROM audit_logs;
    DELETE FROM distributions;
    DELETE FROM token_balances;
    DELETE FROM wallets;
    DELETE FROM token_mints;
    DELETE FROM token_events;
    DELETE FROM investments;
    DELETE FROM offerings;
    DELETE FROM documents;
    DELETE FROM projects;
    DELETE FROM users;
  `);

  [
    ["Maria Rodriguez", "maria@demo.do", "investor", "Dominican Republic", "approved", null, now],
    ["James Carter", "james@demo.com", "investor", "United States", "restricted_review", null, now],
    ["Inversiones Caribe SRL", "issuer@demo.do", "issuer", "Dominican Republic", "business_approved", null, now],
    ["Ana Compliance", "compliance@tokenizas.do", "admin", "Dominican Republic", "approved", null, now]
  ].forEach((user) => {
    run("INSERT INTO users (name, email, role, country, kyc_status, wallet, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", user);
  });

  const projects = [
    ["punta-cana-villas", "Punta Cana Villas Revenue Share", "Punta Cana, La Altagracia", "Renta corta turistica", "Fideicomiso inmobiliario con derechos economicos", 1250000, 1000, "PCV1", 125000, 10, 9.8, "open", "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1400&q=80", "Portafolio de villas turisticas operadas profesionalmente, con distribuciones trimestrales basadas en flujo neto de renta corta.", "Medio", now],
    ["santo-domingo-torre", "Torre Piantini Preventa", "Piantini, Santo Domingo", "Desarrollo residencial urbano", "SPV por proyecto con participacion economica contractual", 2400000, 2500, "SDT1", 240000, 10, 12.4, "due_diligence", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80", "Capital de desarrollo para torre residencial premium con salida proyectada por venta de unidades y refinanciamiento.", "Alto", now],
    ["samana-eco-hotel", "Samana Eco Hotel Notes", "Las Terrenas, Samana", "Deuda inmobiliaria", "Nota privada respaldada por contrato y garantias del proyecto", 850000, 500, "SEH1", 85000, 10, 8.2, "funded", "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80", "Financiamiento puente para hotel sostenible con pagos semestrales de intereses y vencimiento a 30 meses.", "Medio", now]
  ];

  projects.forEach((project) => {
    run(`
      INSERT INTO projects
      (slug, title, location, type, legal_structure, target_raise, min_investment, token_symbol, token_supply, token_price, expected_yield, status, image_url, description, risk_level, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, project);
  });

  const seededProjects = all("SELECT id, slug, target_raise FROM projects");
  const docs = ["Titulo y certificacion registral", "Tasacion independiente", "Modelo financiero", "Contrato de oferta", "Informe KYC/KYB del emisor"];

  seededProjects.forEach((project, index) => {
    docs.forEach((doc, docIndex) => {
      run("INSERT INTO documents (project_id, title, category, status) VALUES (?, ?, ?, ?)", [project.id, doc, docIndex < 2 ? "legal" : "financial", index === 1 && docIndex === 0 ? "review" : "approved"]);
    });
    run("INSERT INTO offerings (project_id, round_name, soft_cap, hard_cap, raised, opens_at, closes_at, lockup_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      project.id,
      "Ronda Genesis",
      Math.round(project.target_raise * 0.45),
      project.target_raise,
      index === 0 ? 775000 : index === 1 ? 420000 : 850000,
      "2026-08-01",
      "2026-10-30",
      index === 1 ? 18 : 12
    ]);
    run("INSERT INTO distributions (project_id, period, amount, status, paid_at) VALUES (?, ?, ?, ?, ?)", [
      project.id,
      "2026-Q2",
      index === 2 ? 17650 : 0,
      index === 2 ? "paid" : "scheduled",
      index === 2 ? "2026-07-10" : null
    ]);
  });

  const maria = all("SELECT id FROM users WHERE email = ?", ["maria@demo.do"])[0];
  const james = all("SELECT id FROM users WHERE email = ?", ["james@demo.com"])[0];
  const puntaCana = all("SELECT id FROM projects WHERE slug = ?", ["punta-cana-villas"])[0];
  const samana = all("SELECT id FROM projects WHERE slug = ?", ["samana-eco-hotel"])[0];

  run("INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [maria.id, puntaCana.id, 25000, 2500, "USDC Solana", "pending_payment", now]);
  run("INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [maria.id, samana.id, 12000, 1200, "Transferencia bancaria", "pending_payment", now]);
  run("INSERT INTO investments (user_id, project_id, amount, tokens, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [james.id, puntaCana.id, 15000, 1500, "USDC Solana", "compliance_review", now]);

  for (const project of all("SELECT * FROM projects")) {
    await ensureProjectMint(project);
  }
  for (const user of all("SELECT * FROM users WHERE role = 'investor'")) {
    await ensureWalletForUser(user);
  }
  for (const investment of all("SELECT id FROM investments WHERE user_id = ?", [maria.id])) {
    await issueTokensForInvestment(investment.id);
  }

  [
    ["Ana Compliance", "approved_kyc", "Maria Rodriguez", "KYC aprobado para inversion local.", now],
    ["System", "created_whitelist_rule", "PCV1", "Transfer Hook simulado exige KYC aprobado antes de transferir.", now],
    ["Issuer", "uploaded_documents", "Punta Cana Villas", "Carga inicial de documentos legales y financieros.", now],
    ["System", "issued_tokens", "Maria Rodriguez", "2,500 PCV1 enviados a wallet aprobada.", now]
  ].forEach((row) => {
    run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", row);
  });

  console.log("Seeder completado. Base de datos lista en data/tokenizas.sqlite");
})();
