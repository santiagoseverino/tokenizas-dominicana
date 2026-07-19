const crypto = require("crypto");
const store = require("../db");
const { adminPassword, adminUser, sessionSecret } = require("../config");

function getAdminCredentials() {
  return {
    user: store.getSetting("admin_user", adminUser),
    password: store.getSetting("admin_password", adminPassword)
  };
}

function signSession(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function sessionCookieValue() {
  const payload = `${getAdminCredentials().user}:${Date.now()}`;
  return `${payload}.${signSession(payload)}`;
}

function isAdmin(req) {
  const token = req.cookies.tokenizas_admin;
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = signSession(payload);
  if (signature.length !== expectedSignature.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;
  const [user, issuedAt] = payload.split(":");
  const ageMs = Date.now() - Number(issuedAt);
  return user === getAdminCredentials().user && ageMs > 0 && ageMs < 1000 * 60 * 60 * 12;
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.redirect("/login");
}

module.exports = { getAdminCredentials, isAdmin, requireAdmin, sessionCookieValue };
