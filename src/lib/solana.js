const config = require("../config");
const { loadSplToken, loadWeb3 } = require("./solana-sdk");

function parseSecretKey(value) {
  if (!value) return null;
  const trimmed = value.trim();
  let bytes;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) bytes = parsed;
  } catch (_) {
    if (/^\d+(,\d+){63}$/.test(trimmed)) {
      bytes = trimmed.split(",").map((item) => Number(item.trim()));
    } else {
      bytes = Array.from(Buffer.from(trimmed, "base64"));
    }
  }
  if (!bytes) return null;
  if (bytes.length !== 64) {
    throw new Error(`SOLANA_PAYER_SECRET_KEY debe tener 64 numeros. Ahora tiene ${bytes.length}. Genera una nueva con: npm run solana:wallet`);
  }
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error("SOLANA_PAYER_SECRET_KEY contiene valores invalidos. Deben ser numeros entre 0 y 255.");
  }
  return Uint8Array.from(bytes);
}

function isRealSolanaEnabled() {
  return Boolean(config.solanaPayerSecretKey);
}

async function loadSolana() {
  const web3 = loadWeb3();
  const spl = await loadSplToken();
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
  const { Keypair } = loadWeb3();
  return Keypair.generate().publicKey.toBase58();
}

function isValidSolanaAddress(address) {
  try {
    const { PublicKey } = loadWeb3();
    new PublicKey(address);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  createDemoWalletAddress,
  createMintOnTestnet,
  isValidSolanaAddress,
  isRealSolanaEnabled,
  mintTokensOnTestnet
};
