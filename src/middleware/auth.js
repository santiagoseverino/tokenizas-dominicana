const crypto = require("crypto");
const store = require("../db");
const { adminPassword, adminUser, sessionSecret } = require("../config");

function getAdminCredentials() {
  return {
    user: store.getSetting("admin_user", adminUser),
    password: store.getSetting("admin_password", adminPassword)
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  if (!storedPassword.startsWith("pbkdf2:")) return password === storedPassword;
  const [, salt, hash] = storedPassword.split(":");
  if (!salt || !hash) return false;
  const expected = hashPassword(password, salt).split(":")[2];
  if (expected.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hash, "hex"));
}

function signSession(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function sessionCookieValue() {
  const payload = `${getAdminCredentials().user}:${Date.now()}`;
  return `${payload}.${signSession(payload)}`;
}

function investorSessionCookieValue(user) {
  const payload = `investor:${user.id}:${Date.now()}`;
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

function currentInvestor(req) {
  const token = req.cookies.tokenizas_investor;
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator === -1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = signSession(payload);
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  const [scope, userId, issuedAt] = payload.split(":");
  const ageMs = Date.now() - Number(issuedAt);
  if (scope !== "investor" || ageMs <= 0 || ageMs > 1000 * 60 * 60 * 24 * 7) return null;
  return store.get("SELECT * FROM users WHERE id = ? AND role = 'investor'", [Number(userId)]);
}

function requireInvestor(req, res, next) {
  const investor = currentInvestor(req);
  if (!investor) return res.redirect("/investor/login");
  req.investor = investor;
  next();
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.redirect("/login");
}

module.exports = { currentInvestor, getAdminCredentials, hashPassword, investorSessionCookieValue, isAdmin, requireAdmin, requireInvestor, sessionCookieValue, verifyPassword };
