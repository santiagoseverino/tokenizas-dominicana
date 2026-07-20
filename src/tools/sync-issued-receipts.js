const store = require("../db");

(async () => {
  await store.initDb();
  const issuedOrders = store.all(`
    SELECT i.*, p.token_symbol, tm.mint_address
    FROM investments i
    JOIN projects p ON p.id = i.project_id
    LEFT JOIN token_mints tm ON tm.project_id = p.id
    WHERE i.status = 'tokens_issued'
      AND (i.issue_signature IS NULL OR i.issue_signature = '')
    ORDER BY i.id
  `);
  let updated = 0;
  for (const order of issuedOrders) {
    const event = store.get(`
      SELECT *
      FROM token_events
      WHERE project_id = ?
        AND event_type = 'tokens_issued'
        AND note LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `, [order.project_id, `%${order.tokens} ${order.token_symbol}%`]);
    if (!event) continue;
    const tokenAccountMatch = String(event.note || "").match(/token account ([1-9A-HJ-NP-Za-km-z]{32,44})/);
    store.run(`
      UPDATE investments
      SET issue_signature = ?,
          issue_token_account = ?,
          issue_mint_address = ?,
          issued_at = COALESCE(issued_at, ?)
      WHERE id = ?
    `, [
      event.signature,
      tokenAccountMatch ? tokenAccountMatch[1] : null,
      order.mint_address || null,
      event.created_at,
      order.id
    ]);
    updated += 1;
  }
  store.saveDb();
  console.log(`Recibos sincronizados: ${updated}`);
})();
