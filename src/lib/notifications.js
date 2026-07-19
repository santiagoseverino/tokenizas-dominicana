function notifyLead(lead) {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!adminEmail && !webhookUrl) return;

  console.log("New lead notification queued", {
    adminEmail: adminEmail || null,
    webhookUrl: webhookUrl ? "configured" : null,
    lead: {
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      interest: lead.interest
    }
  });
}

module.exports = { notifyLead };
