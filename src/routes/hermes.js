const config = require("../config");
const store = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { handleInboundMessage } = require("../lib/hermes");
const { layout } = require("../lib/ui");

function extractCloudMessages(body) {
  const messages = [];
  const entries = body.entry || [];
  entries.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const value = change.value || {};
      const contacts = value.contacts || [];
      const contactByWaId = new Map(contacts.map((contact) => [contact.wa_id, contact.profile && contact.profile.name]));
      (value.messages || []).forEach((message) => {
        if (message.type !== "text") return;
        messages.push({
          phone: message.from,
          name: contactByWaId.get(message.from) || "",
          text: message.text && message.text.body ? message.text.body : "",
          providerMessageId: message.id || ""
        });
      });
    });
  });
  return messages;
}

function registerHermesRoutes(app) {
  app.get("/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === config.whatsappVerifyToken) return res.status(200).send(challenge);
    return res.sendStatus(403);
  });

  app.post("/webhooks/whatsapp", async (req, res) => {
    try {
      const messages = extractCloudMessages(req.body);
      for (const message of messages) {
        await handleInboundMessage(message);
      }
      res.json({ ok: true, processed: messages.length });
    } catch (error) {
      console.error("Hermes webhook failed:", error.message);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/admin/hermes", requireAdmin, (req, res) => {
    const conversations = store.all("SELECT * FROM whatsapp_conversations ORDER BY updated_at DESC LIMIT 50");
    const selected = req.query.id ? store.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [req.query.id]) : conversations[0];
    const messages = selected ? store.all("SELECT * FROM whatsapp_messages WHERE conversation_id = ? ORDER BY id", [selected.id]) : [];
    res.send(layout("Hermes WhatsApp", `
      <main class="page">
        <div class="sectionHead">
          <p class="eyebrow">WhatsApp AI</p>
          <h1>Hermes</h1>
          <p class="muted">Agente inicial para responder preguntas, calificar interesados y escalar a ${config.hermesSuperAgentName}.</p>
          <p><a class="button small" href="/admin">Volver</a></p>
        </div>
        <section class="split">
          <div class="panel">
            <h3>Prueba manual</h3>
            <form class="contactForm" method="post" action="/admin/hermes/test">
              <label>WhatsApp<input name="phone" value="+18090000000" required /></label>
              <label>Nombre<input name="name" value="Cliente Demo" /></label>
              <label>Mensaje<textarea name="text" rows="5" required>Hola, quiero invertir 10000 dolares en Punta Cana desde Republica Dominicana</textarea></label>
              <button class="button primary" type="submit">Enviar a Hermes</button>
            </form>
          </div>
          <div class="panel">
            <h3>Conversaciones</h3>
            ${conversations.map((item) => `<div class="event"><b>${item.contact_name || item.phone}</b><span>${item.phone} - ${item.stage}</span><p>${item.summary || "Sin resumen todavia."}</p><a href="/admin/hermes?id=${item.id}">Abrir</a></div>`).join("") || "<p class=\"muted\">Sin conversaciones todavia.</p>"}
          </div>
        </section>
        <section class="panel">
          <h3>${selected ? `Chat con ${selected.contact_name || selected.phone}` : "Chat"}</h3>
          ${messages.map((message) => `<div class="event"><b>${message.sender}</b><span>${message.direction} - ${message.created_at}</span><p>${message.message}</p></div>`).join("") || "<p class=\"muted\">Selecciona o crea una conversacion.</p>"}
        </section>
      </main>
    `, req));
  });

  app.post("/admin/hermes/test", requireAdmin, async (req, res) => {
    await handleInboundMessage({
      phone: req.body.phone,
      name: req.body.name,
      text: req.body.text,
      providerMessageId: "manual-test"
    });
    res.redirect("/admin/hermes");
  });
}

module.exports = registerHermesRoutes;
