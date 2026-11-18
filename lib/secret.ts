// Clé de signature des sessions JWT (compatible runtime Edge pour le middleware)
export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant");
    return new TextEncoder().encode("dev-secret-outilflow-change-me-0123456789");
  }
  return new TextEncoder().encode(s);
}
