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

async function createMintOnTestnet(project = {}) {
  const { spl, payer, connection } = await loadSolana();
  const mint = await spl.createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    config.solanaTokenDecimals
  );
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
