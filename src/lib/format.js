const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6
});

function statusLabel(status, req) {
  if (req) {
    try {
      const { tr } = require("./i18n");
      const labels = tr(req).statusLabels || {};
      if (labels[status]) return labels[status];
    } catch (_) {}
  }
  const labels = {
    open: "Abierto",
    due_diligence: "Due diligence",
    funded: "Financiado",
    tokens_issued: "Tokens emitidos",
    compliance_review: "Revision compliance",
    pending_payment: "Pago pendiente",
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    submitted: "Enviado",
    review: "En revision",
    needs_more_info: "Falta informacion",
    not_started: "No iniciado"
  };
  return labels[status] || status;
}

module.exports = { money, number, statusLabel };
