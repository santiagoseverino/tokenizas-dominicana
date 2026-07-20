const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const number = new Intl.NumberFormat("en-US");

function statusLabel(status) {
  const labels = {
    open: "Abierto",
    due_diligence: "Due diligence",
    funded: "Financiado",
    tokens_issued: "Tokens emitidos",
    compliance_review: "Revision compliance",
    pending_payment: "Pago pendiente",
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
