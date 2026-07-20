const express = require("express");
const path = require("path");
const { port } = require("./config");
const store = require("./db");
const { cookieMiddleware } = require("./lib/http");

const registerAdminRoutes = require("./routes/admin");
const registerAuthRoutes = require("./routes/auth");
const registerContactRoutes = require("./routes/contact");
const registerDashboardRoutes = require("./routes/dashboard");
const registerHomeRoutes = require("./routes/home");
const registerInvestRoutes = require("./routes/invest");
const registerInvestorRoutes = require("./routes/investor");
const registerLegalRoutes = require("./routes/legal");
const registerProjectRoutes = require("./routes/projects");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(cookieMiddleware);

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tokenizas-dominicana" });
});

registerHomeRoutes(app);
registerAuthRoutes(app);
registerLegalRoutes(app);
registerContactRoutes(app);
registerProjectRoutes(app);
registerInvestorRoutes(app);
registerInvestRoutes(app);
registerDashboardRoutes(app);
registerAdminRoutes(app);

store.initDb().then(() => {
  app.listen(port, () => {
    console.log(`Tokenizas Dominicana listo en http://localhost:${port}`);
  });
});
