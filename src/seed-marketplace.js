const store = require("./db");
const { seedCacaoMarketplaceDemo } = require("./lib/marketplace-demo");

(async () => {
  await store.initDb();
  const { project, activeListing, pendingTrade } = seedCacaoMarketplaceDemo();
  console.log("Marketplace demo listo:");
  console.log(`- Proyecto: ${project.title}`);
  console.log(`- Listado activo #${activeListing.id}: 0.1 ${project.token_symbol} a $25/token`);
  console.log(`- Trade pendiente #${pendingTrade.id}: 0.05 ${project.token_symbol} a $28/token`);
})();
