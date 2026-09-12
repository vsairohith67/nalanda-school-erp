/** Bounded read before JSON parsing, including requests without Content-Length. */
export async function readImportBytes(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error("Import request exceeds the byte limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function readImportJson(request: Request, fields: readonly string[], limit = 2_100_000) {
  const bytes = await readImportBytes(request, limit);
  let body;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Invalid import JSON. Submit a valid approved payload."); }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some(k => !fields.includes(k))) throw new Error("Unexpected import request property.");
  return body as Record<string, any>;
}
