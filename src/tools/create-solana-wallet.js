const { Keypair } = require("@solana/web3.js");

const keypair = Keypair.generate();

console.log("Nueva wallet Solana para desarrollo");
console.log("");
console.log(`PUBLIC=${keypair.publicKey.toBase58()}`);
console.log(`SOLANA_PAYER_SECRET_KEY=${JSON.stringify(Array.from(keypair.secretKey))}`);
console.log("");
console.log("Usa PUBLIC en el faucet de devnet y pega SOLANA_PAYER_SECRET_KEY en .env.");
