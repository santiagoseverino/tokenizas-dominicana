const config = require("../config");
const { Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");

function parseSecretKey(value) {
  if (!value) throw new Error("SOLANA_PAYER_SECRET_KEY no existe en .env");
  const trimmed = value.trim();
  let bytes;
  try {
    bytes = JSON.parse(trimmed);
  } catch (_) {
    if (/^\d+(,\d+){63}$/.test(trimmed)) {
      bytes = trimmed.split(",").map((item) => Number(item.trim()));
    } else {
      bytes = Array.from(Buffer.from(trimmed, "base64"));
    }
  }
  if (!Array.isArray(bytes)) throw new Error("SOLANA_PAYER_SECRET_KEY debe ser un arreglo JSON");
  if (bytes.length !== 64) throw new Error(`SOLANA_PAYER_SECRET_KEY debe tener 64 numeros. Ahora tiene ${bytes.length}.`);
  return Uint8Array.from(bytes);
}

(async () => {
  const secretKey = parseSecretKey(config.solanaPayerSecretKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const balance = await connection.getBalance(keypair.publicKey);

  console.log(`cluster=${config.solanaCluster}`);
  console.log(`rpc=${config.solanaRpcUrl}`);
  console.log(`public=${keypair.publicKey.toBase58()}`);
  console.log(`secret_length=${secretKey.length}`);
  console.log(`balance_SOL=${balance / LAMPORTS_PER_SOL}`);
})();
