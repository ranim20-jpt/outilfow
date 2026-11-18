export type PointGeo = { latitude: number; longitude: number };

/**
 * Convertit une adresse postale tunisienne en coordonnées GPS via Nominatim
 * (OpenStreetMap). Utilisé uniquement si le client n'a pas placé son repère
 * sur la carte. En cas d'échec (réseau, quota, adresse introuvable) on renvoie
 * `null` : la livraison reste valide, seule la carte n'est pas affichée.
 */
export async function geocoderAdresse(
  adresse: string,
  ville: string,
  gouvernorat: string,
): Promise<PointGeo | null> {
  const q = [adresse, ville, gouvernorat, "Tunisie"].filter(Boolean).join(", ");
  if (!q.trim()) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "tn");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "OutilFlow/1.0 (quincaillerie Bochtiba, Nabeul)",
        "Accept-Language": "fr",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const premier = data[0];
    if (!premier?.lat || !premier.lon) return null;
    const latitude = Number(premier.lat);
    const longitude = Number(premier.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
