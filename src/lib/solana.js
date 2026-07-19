const config = require("../config");

function parseSecretKey(value) {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return Uint8Array.from(parsed);
  } catch (_) {
    return Uint8Array.from(Buffer.from(trimmed, "base64"));
  }
  return null;
}

function isRealSolanaEnabled() {
  return Boolean(config.solanaPayerSecretKey);
}

async function loadSolana() {
  const web3 = require("@solana/web3.js");
  const spl = require("@solana/spl-token");
  const secretKey = parseSecretKey(config.solanaPayerSecretKey);
  if (!secretKey) throw new Error("SOLANA_PAYER_SECRET_KEY no esta configurada correctamente");
  const payer = web3.Keypair.fromSecretKey(secretKey);
  const connection = new web3.Connection(config.solanaRpcUrl, "confirmed");
  return { web3, spl, payer, connection };
}

async function createMintOnTestnet() {
  const { spl, payer, connection } = await loadSolana();
  const mint = await spl.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    config.solanaTokenDecimals
  );
  return {
    mintAddress: mint.toBase58(),
    authorityWallet: payer.publicKey.toBase58(),
    treasuryWallet: payer.publicKey.toBase58()
  };
}

async function mintTokensOnTestnet({ mintAddress, recipientAddress, amount }) {
  const { web3, spl, payer, connection } = await loadSolana();
  const mint = new web3.PublicKey(mintAddress);
  const owner = new web3.PublicKey(recipientAddress);
  const tokenAccount = await spl.getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
  const signature = await spl.mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer,
    BigInt(amount)
  );
  return {
    signature,
    tokenAccount: tokenAccount.address.toBase58()
  };
}

function createDemoWalletAddress() {
  if (!isRealSolanaEnabled()) return null;
  const { Keypair } = require("@solana/web3.js");
  return Keypair.generate().publicKey.toBase58();
}

module.exports = {
  createDemoWalletAddress,
  createMintOnTestnet,
  isRealSolanaEnabled,
  mintTokensOnTestnet
};
