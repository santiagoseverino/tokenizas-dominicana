const nodemailer = require("nodemailer");

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.ADMIN_NOTIFY_EMAIL
  );
}

function leadEmailHtml(lead) {
  return `
    <div style="font-family:Arial,sans-serif;color:#082f49;line-height:1.5">
      <h2>Nuevo interesado en Tokenizas Dominicana</h2>
      <p>Una persona lleno el formulario de contacto.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #d5e2ea">
        <tr><td><strong>Nombre</strong></td><td>${lead.name}</td></tr>
        <tr><td><strong>Empresa</strong></td><td>${lead.company || "N/A"}</td></tr>
        <tr><td><strong>Email</strong></td><td>${lead.email}</td></tr>
        <tr><td><strong>WhatsApp</strong></td><td>${lead.whatsapp || "N/A"}</td></tr>
        <tr><td><strong>Interes</strong></td><td>${lead.interest}</td></tr>
        <tr><td><strong>Mensaje</strong></td><td>${lead.message || "Sin mensaje adicional."}</td></tr>
      </table>
      <p style="margin-top:18px">Revisalo en el CRM: <a href="https://tokenizas.dominicana.com/admin/leads">Admin Leads</a></p>
    </div>
  `;
}

function leadEmailText(lead) {
  return [
    "Nuevo interesado en Tokenizas Dominicana",
    "",
    `Nombre: ${lead.name}`,
    `Empresa: ${lead.company || "N/A"}`,
    `Email: ${lead.email}`,
    `WhatsApp: ${lead.whatsapp || "N/A"}`,
    `Interes: ${lead.interest}`,
    `Mensaje: ${lead.message || "Sin mensaje adicional."}`,
    "",
    "CRM: https://tokenizas.dominicana.com/admin/leads"
  ].join("\n");
}

async function notifyLead(lead) {
  if (!smtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from,
    to: process.env.ADMIN_NOTIFY_EMAIL,
    replyTo: lead.email,
    subject: `Nuevo interesado: ${lead.name} - ${lead.interest}`,
    text: leadEmailText(lead),
    html: leadEmailHtml(lead)
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { notifyLead };
