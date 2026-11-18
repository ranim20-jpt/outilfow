export const dt = (n: number | null | undefined) =>
  n === null || n === undefined ? "Sur demande" : `${n.toFixed(3)} DT`;

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
