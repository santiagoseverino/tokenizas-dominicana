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

function confirmationEmailHtml(lead, t) {
  return `
    <div style="font-family:Arial,sans-serif;color:#082f49;line-height:1.5">
      <h2>${t.confirmIntro}</h2>
      <p>${t.confirmBody}</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #d5e2ea">
        <tr><td><strong>${t.name}</strong></td><td>${lead.name}</td></tr>
        <tr><td><strong>${t.interest}</strong></td><td>${lead.interest}</td></tr>
      </table>
      <p style="margin-top:18px">${t.confirmFooter}</p>
      <p><a href="https://tokenizas.dominicana.com">tokenizas.dominicana.com</a></p>
    </div>
  `;
}

function confirmationEmailText(lead, t) {
  return [
    t.confirmIntro,
    "",
    t.confirmBody,
    "",
    `${t.name}: ${lead.name}`,
    `${t.interest}: ${lead.interest}`,
    "",
    t.confirmFooter,
    "https://tokenizas.dominicana.com"
  ].join("\n");
}

function passwordResetEmailHtml({ name, resetUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;color:#082f49;line-height:1.5">
      <h2>Recuperar acceso a Tokenizas Dominicana</h2>
      <p>Hola ${name || "inversionista"}, recibimos una solicitud para cambiar tu clave.</p>
      <p>Este enlace vence en 30 minutos:</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#06b6d4;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Cambiar mi clave</a></p>
      <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
    </div>
  `;
}

function passwordResetEmailText({ name, resetUrl }) {
  return [
    "Recuperar acceso a Tokenizas Dominicana",
    "",
    `Hola ${name || "inversionista"}, recibimos una solicitud para cambiar tu clave.`,
    "Este enlace vence en 30 minutos:",
    resetUrl,
    "",
    "Si no solicitaste este cambio, puedes ignorar este mensaje."
  ].join("\n");
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function notifyLead(lead, t) {
  if (!smtpConfigured()) {
    return {
      admin: { sent: false, reason: "smtp_not_configured" },
      lead: { sent: false, reason: "smtp_not_configured" }
    };
  }

  const transporter = createTransporter();
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const adminInfo = await transporter.sendMail({
    from,
    to: process.env.ADMIN_NOTIFY_EMAIL,
    replyTo: lead.email,
    subject: `Nuevo interesado: ${lead.name} - ${lead.interest}`,
    text: leadEmailText(lead),
    html: leadEmailHtml(lead)
  });

  const leadInfo = await transporter.sendMail({
    from,
    to: lead.email,
    replyTo: process.env.ADMIN_NOTIFY_EMAIL,
    subject: t.confirmSubject,
    text: confirmationEmailText(lead, t),
    html: confirmationEmailHtml(lead, t)
  });

  return {
    admin: { sent: true, messageId: adminInfo.messageId },
    lead: { sent: true, messageId: leadInfo.messageId }
  };
}

async function sendPasswordReset(user, resetUrl) {
  if (!smtpConfigured()) return { sent: false, reason: "smtp_not_configured" };
  const transporter = createTransporter();
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from,
    to: user.email,
    replyTo: process.env.ADMIN_NOTIFY_EMAIL,
    subject: "Recuperar acceso a Tokenizas Dominicana",
    text: passwordResetEmailText({ name: user.name, resetUrl }),
    html: passwordResetEmailHtml({ name: user.name, resetUrl })
  });
  return { sent: true, messageId: info.messageId };
}

module.exports = { notifyLead, sendPasswordReset, smtpConfigured };
