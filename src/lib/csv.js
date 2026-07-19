function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

module.exports = { toCsv };
