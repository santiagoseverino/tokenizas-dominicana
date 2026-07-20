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

function errorText(error) {
  if (!error) return "Error desconocido";
  if (error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
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

function getSolPaymentExpected(tokens) {
  return Number((Number(tokens || 0) * config.solanaPaymentSolPerToken).toFixed(9));
}

function lamportsFromSol(sol) {
  return Math.round(Number(sol || 0) * 1_000_000_000);
}

function getTreasuryAddress() {
  const web3 = loadWeb3();
  const secretKey = parseSecretKey(config.solanaPayerSecretKey);
  if (!secretKey) return "";
  return web3.Keypair.fromSecretKey(secretKey).publicKey.toBase58();
}

async function verifySolPayment({ signature, expectedSol, treasuryAddress }) {
  const web3 = loadWeb3();
  const connection = new web3.Connection(config.solanaRpcUrl, "confirmed");
  const expectedLamports = lamportsFromSol(expectedSol);
  if (!signature || !looksLikeSignature(signature)) throw new Error("Firma de Solana invalida.");
  if (expectedLamports <= 0) throw new Error("Monto esperado invalido.");
  const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!tx || !tx.meta) throw new Error("No se encontro la transaccion en Solana devnet.");
  const keys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys || [];
  const treasuryIndex = keys.findIndex((key) => key.toBase58 && key.toBase58() === treasuryAddress);
  if (treasuryIndex < 0) throw new Error("La transaccion no incluye la wallet treasury.");
  const pre = Number(tx.meta.preBalances[treasuryIndex] || 0);
  const post = Number(tx.meta.postBalances[treasuryIndex] || 0);
  const receivedLamports = post - pre;
  if (receivedLamports < expectedLamports) {
    throw new Error(`Pago insuficiente. Recibido ${(receivedLamports / 1_000_000_000).toFixed(9)} SOL, esperado ${Number(expectedSol).toFixed(9)} SOL.`);
  }
  return {
    signature,
    treasuryAddress,
    expectedSol,
    receivedSol: receivedLamports / 1_000_000_000
  };
}

function looksLikeSignature(signature) {
  return /^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(signature || ""));
}

function encodeU32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function encodeU16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function encodeString(value) {
  const data = Buffer.from(String(value || ""), "utf8");
  return Buffer.concat([encodeU32(data.length), data]);
}

function encodeOptionNone() {
  return Buffer.from([0]);
}

function metadataInstructionData({ name, symbol, uri }) {
  return Buffer.concat([
    Buffer.from([33]),
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    encodeU16(0),
    encodeOptionNone(),
    encodeOptionNone(),
    encodeOptionNone(),
    Buffer.from([1]),
    encodeOptionNone()
  ]);
}

async function createMintMetadata({ web3, payer, connection, mint, name, symbol, uri }) {
  const metadataProgram = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metadata] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), metadataProgram.toBuffer(), mint.toBuffer()],
    metadataProgram
  );
  const instruction = new web3.TransactionInstruction({
    programId: metadataProgram,
    keys: [
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: false },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
    ],
    data: metadataInstructionData({ name, symbol, uri })
  });
  const signature = await web3.sendAndConfirmTransaction(connection, new web3.Transaction().add(instruction), [payer]);
  return { metadataAddress: metadata.toBase58(), metadataSignature: signature };
}

async function createSplMint({ spl, connection, payer }) {
  if (spl.createMint) {
    return spl.createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      config.solanaTokenDecimals
    );
  }
  const token = await spl.Token.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    config.solanaTokenDecimals,
    spl.TOKEN_PROGRAM_ID
  );
  return token.publicKey;
}

async function getOrCreateTokenAccount({ spl, connection, payer, mint, owner }) {
  if (spl.getOrCreateAssociatedTokenAccount) {
    return spl.getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
  }
  const token = new spl.Token(connection, mint, spl.TOKEN_PROGRAM_ID, payer);
  const account = await token.getOrCreateAssociatedAccountInfo(owner);
  return { address: account.address };
}

async function mintToAccount({ spl, connection, payer, mint, tokenAccount, amount }) {
  if (spl.mintTo) {
    return spl.mintTo(connection, payer, mint, tokenAccount, payer, amount);
  }
  const legacyAmount = Number(amount);
  if (!Number.isSafeInteger(legacyAmount) || legacyAmount <= 0) {
    throw new Error(`Cantidad legacy invalida para SPL Token: ${String(amount)}`);
  }
  const token = new spl.Token(connection, mint, spl.TOKEN_PROGRAM_ID, payer);
  return token.mintTo(tokenAccount, payer.publicKey, [], legacyAmount);
}

function addressText(address) {
  if (!address) return "";
  return address.toBase58 ? address.toBase58() : String(address);
}

async function createMintOnTestnet(project = {}) {
  const { spl, payer, connection } = await loadSolana();
  const mint = await createSplMint({ spl, connection, payer });
  const metadata = await createMintMetadata({
    web3: loadWeb3(),
    payer,
    connection,
    mint,
    name: String(project.title || "Tokenizas Project").slice(0, 32),
    symbol: String(project.token_symbol || "TOK").slice(0, 10),
    uri: `${config.siteUrl}/token-metadata/${project.slug || mint.toBase58()}.json`
  });
  return {
    mintAddress: mint.toBase58(),
    authorityWallet: payer.publicKey.toBase58(),
    treasuryWallet: payer.publicKey.toBase58(),
    ...metadata
  };
}

async function mintTokensOnTestnet({ mintAddress, recipientAddress, amount }) {
  try {
    const { web3, spl, payer, connection } = await loadSolana();
    const mint = new web3.PublicKey(mintAddress);
    const owner = new web3.PublicKey(recipientAddress);
    const tokenAccount = await getOrCreateTokenAccount({ spl, connection, payer, mint, owner });
    const baseUnits = BigInt(Math.round(Number(amount) * (10 ** config.solanaTokenDecimals)));
    if (baseUnits <= 0n) throw new Error("La cantidad de tokens debe ser mayor que cero.");
    const signature = await mintToAccount({ spl, connection, payer, mint, tokenAccount: tokenAccount.address, amount: baseUnits });
    return {
      signature: signature ? String(signature) : "",
      tokenAccount: addressText(tokenAccount.address)
    };
  } catch (error) {
    throw new Error(`No se pudieron emitir tokens en Solana ${config.solanaCluster}: ${errorText(error)}`);
  }
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
  getSolPaymentExpected,
  getTreasuryAddress,
  isValidSolanaAddress,
  isRealSolanaEnabled,
  mintTokensOnTestnet,
  verifySolPayment
};
