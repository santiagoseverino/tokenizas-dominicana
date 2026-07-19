function parseCookies(req) {
  return (req.headers.cookie || "").split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index === -1) return cookies;
    cookies[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return cookies;
  }, {});
}

function cookieMiddleware(req, res, next) {
  req.cookies = parseCookies(req);
  if (req.query.lang && ["es", "en", "de", "fr"].includes(req.query.lang)) {
    res.setHeader("Set-Cookie", `tokenizas_lang=${req.query.lang}; Path=/; SameSite=Lax; Max-Age=31536000`);
    req.cookies.tokenizas_lang = req.query.lang;
  }
  next();
}

module.exports = { parseCookies, cookieMiddleware };
