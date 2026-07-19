const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFile();

module.exports = {
  port: process.env.PORT || 3000,
  adminUser: process.env.ADMIN_USER || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "TokenizasAdmin2026!",
  sessionSecret: process.env.SESSION_SECRET || "change-this-tokenizas-secret",
  whatsappNumber: process.env.WHATSAPP_NUMBER || "18090000000",
  solanaCluster: process.env.SOLANA_CLUSTER || "testnet",
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.testnet.solana.com",
  solanaPayerSecretKey: process.env.SOLANA_PAYER_SECRET_KEY || "",
  solanaTokenDecimals: Number(process.env.SOLANA_TOKEN_DECIMALS || 0),
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "tokenizas-hermes-verify",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  hermesSuperAgentName: process.env.HERMES_SUPER_AGENT_NAME || "Sofia Reyes",
  hermesHandoffEmail: process.env.HERMES_HANDOFF_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || ""
};
