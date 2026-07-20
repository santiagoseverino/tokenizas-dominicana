function parseMultipart(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const type = req.headers["content-type"] || "";
    const match = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) return resolve({ fields: req.body || {}, files: {} });
    const boundary = Buffer.from(`--${match[1] || match[2]}`);
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("El archivo no puede pasar de 8 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const fields = {};
      const files = {};
      let start = buffer.indexOf(boundary);
      while (start !== -1) {
        const next = buffer.indexOf(boundary, start + boundary.length);
        if (next === -1) break;
        const part = buffer.slice(start + boundary.length + 2, next - 2);
        const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
        if (headerEnd !== -1) {
          const rawHeaders = part.slice(0, headerEnd).toString("utf8");
          const content = part.slice(headerEnd + 4);
          const nameMatch = rawHeaders.match(/name="([^"]+)"/);
          const fileMatch = rawHeaders.match(/filename="([^"]*)"/);
          const typeMatch = rawHeaders.match(/content-type:\s*([^\r\n]+)/i);
          if (nameMatch && fileMatch && fileMatch[1]) {
            files[nameMatch[1]] = {
              filename: fileMatch[1],
              contentType: typeMatch ? typeMatch[1].trim().toLowerCase() : "",
              buffer: content
            };
          } else if (nameMatch) {
            fields[nameMatch[1]] = content.toString("utf8");
          }
        }
        start = next;
      }
      resolve({ fields, files });
    });
  });
}

async function readForm(req, maxBytes) {
  if ((req.headers["content-type"] || "").includes("multipart/form-data")) return parseMultipart(req, maxBytes);
  return { fields: req.body || {}, files: {} };
}

module.exports = { parseMultipart, readForm };
