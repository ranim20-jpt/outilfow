import { redirect } from "next/navigation";

/** Redirige vers `path` avec un message (affiché par le composant Flash). */
export function back(path: string, msg: string, kind: "error" | "ok" = "error"): never {
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}

export const fstr = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function fnum(f: FormData, k: string): number | null {
  const v = fstr(f, k).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
