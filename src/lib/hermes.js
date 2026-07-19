const store = require("../db");
const config = require("../config");

const SUPER_AGENT_ROLE = "Asesora senior de tokenizacion inmobiliaria";

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function detectIntent(text) {
  const value = text.toLowerCase();
  if (/(tokenizar|tokenize|inmueble|proyecto|desarrollador|dueno|dueño|constructor)/.test(value)) return "tokenize_property";
  if (/(invertir|invest|comprar|tokens|rendimiento|roi|retorno)/.test(value)) return "invest";
  if (/(legal|ley|regulacion|regulación|simv|contrato)/.test(value)) return "legal";
  if (/(precio|costo|fee|comision|comisión)/.test(value)) return "pricing";
  return "";
}

function detectProject(text) {
  const value = text.toLowerCase();
  if (/punta cana|villa|villas|pcv/.test(value)) return "Punta Cana Villas Revenue Share";
  if (/piantini|santo domingo|torre|sdt/.test(value)) return "Torre Piantini Preventa";
  if (/samana|samaná|terrenas|hotel|seh/.test(value)) return "Samana Eco Hotel Notes";
  return "";
}

function detectBudget(text) {
  const match = text.match(/(?:us\$|\$|usd)?\s?(\d{1,3}(?:[,.]\d{3})+|\d{4,9})(?:\s?(?:usd|dolares|dólares))?/i);
  return match ? match[0].trim() : "";
}

function detectCountry(text) {
  const value = text.toLowerCase();
  if (/dominicana|republica dominicana|república dominicana|santo domingo|punta cana/.test(value)) return "Republica Dominicana";
  if (/usa|estados unidos|united states|miami|new york/.test(value)) return "Estados Unidos";
  if (/alemania|germany|deutschland/.test(value)) return "Alemania";
  if (/francia|france/.test(value)) return "Francia";
  return "";
}

function detectTimeframe(text) {
  const value = text.toLowerCase();
  if (/hoy|ahora|esta semana|urgente|ya/.test(value)) return "Inmediato";
  if (/mes|30 dias|30 días|pronto/.test(value)) return "30 dias";
  if (/trimestre|90 dias|90 días/.test(value)) return "90 dias";
  return "";
}

function buildSummary(conversation) {
  return [
    `Intento: ${conversation.intent || "pendiente"}`,
    `Proyecto: ${conversation.project_interest || "pendiente"}`,
    `Presupuesto: ${conversation.budget || "pendiente"}`,
    `Pais: ${conversation.country || "pendiente"}`,
    `Tiempo: ${conversation.timeframe || "pendiente"}`
  ].join(" | ");
}

function missingFields(conversation) {
  const missing = [];
  if (!conversation.intent) missing.push("intent");
  if (!conversation.project_interest) missing.push("project");
  if (!conversation.budget) missing.push("budget");
  if (!conversation.country) missing.push("country");
  return missing;
}

function answerFor(conversation, inboundText) {
  const missing = missingFields(conversation);
  if (!inboundText.trim()) return "Hola, soy Hermes de Tokenizas Dominicana. Puedo ayudarte a invertir o tokenizar un proyecto inmobiliario. ¿Que deseas hacer?";

  if (missing.length === 0) {
    return `Perfecto. Ya tengo la informacion principal. Te voy a pasar con ${config.hermesSuperAgentName}, ${SUPER_AGENT_ROLE}, para revisar tu caso y los proximos pasos.`;
  }

  const intro = "Soy Hermes, asistente de Tokenizas Dominicana.";
  if (missing.includes("intent")) return `${intro} ¿Quieres invertir en un proyecto tokenizado o tokenizar un inmueble/proyecto propio?`;
  if (missing.includes("project")) return "¿Te interesa Punta Cana Villas, Torre Piantini, Samana Eco Hotel, o quieres tokenizar otro proyecto?";
  if (missing.includes("budget")) return "¿Con que monto aproximado quieres iniciar o que monto busca levantar el proyecto?";
  if (missing.includes("country")) return "¿Desde que pais nos escribes? Esto ayuda con KYC, cumplimiento y documentacion.";
  return "Gracias. ¿En que plazo quieres avanzar: ahora, este mes o en los proximos 90 dias?";
}

function upsertConversation({ phone, name, text }) {
  const now = new Date().toISOString();
  const cleanPhone = normalizePhone(phone);
  let conversation = store.get("SELECT * FROM whatsapp_conversations WHERE phone = ?", [cleanPhone]);
  if (!conversation) {
    store.run(`
      INSERT INTO whatsapp_conversations (phone, contact_name, stage, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [cleanPhone, name || null, "collecting", now, now]);
    conversation = store.get("SELECT * FROM whatsapp_conversations WHERE phone = ?", [cleanPhone]);
  }

  const updates = {
    intent: conversation.intent || detectIntent(text),
    project_interest: conversation.project_interest || detectProject(text),
    budget: conversation.budget || detectBudget(text),
    country: conversation.country || detectCountry(text),
    timeframe: conversation.timeframe || detectTimeframe(text)
  };
  const next = { ...conversation, ...updates };
  const ready = missingFields(next).length === 0;
  const summary = buildSummary(next);
  store.run(`
    UPDATE whatsapp_conversations
    SET contact_name = COALESCE(?, contact_name), intent = COALESCE(?, intent), project_interest = COALESCE(?, project_interest),
        budget = COALESCE(?, budget), country = COALESCE(?, country), timeframe = COALESCE(?, timeframe),
        summary = ?, stage = ?, assigned_agent = ?, handoff_ready = ?, updated_at = ?
    WHERE id = ?
  `, [
    name || null,
    updates.intent || null,
    updates.project_interest || null,
    updates.budget || null,
    updates.country || null,
    updates.timeframe || null,
    summary,
    ready ? "handoff_ready" : "collecting",
    ready ? config.hermesSuperAgentName : null,
    ready ? 1 : 0,
    now,
    conversation.id
  ]);
  return store.get("SELECT * FROM whatsapp_conversations WHERE id = ?", [conversation.id]);
}

function recordMessage(conversationId, direction, sender, message, providerMessageId = "") {
  store.run("INSERT INTO whatsapp_messages (conversation_id, direction, sender, message, provider_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    conversationId,
    direction,
    sender,
    message,
    providerMessageId,
    new Date().toISOString()
  ]);
}

async function sendWhatsAppMessage(to, body) {
  if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) {
    return { sent: false, reason: "WhatsApp Cloud API no configurado" };
  }
  const response = await fetch(`https://graph.facebook.com/v20.0/${config.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "text",
      text: { body }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ? payload.error.message : "WhatsApp API error");
  return { sent: true, id: payload.messages && payload.messages[0] ? payload.messages[0].id : "" };
}

async function handleInboundMessage({ phone, name, text, providerMessageId = "" }) {
  const conversation = upsertConversation({ phone, name, text });
  recordMessage(conversation.id, "inbound", phone, text, providerMessageId);
  const reply = answerFor(conversation, text);
  recordMessage(conversation.id, "outbound", "Hermes", reply);
  const delivery = await sendWhatsAppMessage(phone, reply);

  if (conversation.handoff_ready) {
    store.run("INSERT INTO audit_logs (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", [
      "Hermes",
      "handoff_ready",
      phone,
      `${config.hermesSuperAgentName}: ${conversation.summary}`,
      new Date().toISOString()
    ]);
  }
  return { conversation, reply, delivery };
}

module.exports = { handleInboundMessage, normalizePhone, sendWhatsAppMessage, SUPER_AGENT_ROLE };
