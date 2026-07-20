function loadWeb3() {
  const web3 = require("@solana/web3.js");
  if (!web3.Keypair || !web3.Connection || !web3.PublicKey) {
    let version = "unknown";
    try {
      version = require("@solana/web3.js/package.json").version;
    } catch (_) {}
    throw new Error(
      `@solana/web3.js instalado no es compatible (${version}). Ejecuta: npm install @solana/web3.js@1.95.3 @solana/spl-token@0.4.9`
    );
  }
  return web3;
}

module.exports = { loadWeb3 };
