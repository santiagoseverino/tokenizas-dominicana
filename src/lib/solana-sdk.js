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

async function loadSplToken() {
  const imported = await import("@solana/spl-token");
  const spl = imported.default && (imported.default.createMint || imported.default.Token) ? imported.default : imported;
  const modernApi = spl.createMint && spl.getOrCreateAssociatedTokenAccount && spl.mintTo;
  const legacyApi = spl.Token && spl.TOKEN_PROGRAM_ID;
  if (!modernApi && !legacyApi) {
    let version = "unknown";
    try {
      version = require("@solana/spl-token/package.json").version;
    } catch (_) {}
    throw new Error(
      `@solana/spl-token instalado no es compatible (${version}). Instala @solana/spl-token@0.4.9 o usa una version legacy con Token.createMint.`
    );
  }
  return spl;
}

module.exports = { loadSplToken, loadWeb3 };
