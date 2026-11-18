export const ROLES = ["PARTICULIER", "PROFESSIONNEL", "ADMIN", "LIVREUR"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  PARTICULIER: "Client particulier",
  PROFESSIONNEL: "Client professionnel",
  ADMIN: "Administrateur",
  LIVREUR: "Livreur",
};

export const CLIENT_ROLES: Role[] = ["PARTICULIER", "PROFESSIONNEL"];

// Frais fixes de livraison (en DT)
export const FRAIS_LIVRAISON = 7;

// Les 24 gouvernorats de Tunisie (le gouvernorat sert à répartir les livraisons)
export const GOUVERNORATS = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

export const GOUVERNORAT_NABEUL = "Nabeul";

export type Option = { value: string; label: string };

export const STATUTS_LIVRAISON: readonly Option[] = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "EN_PREPARATION", label: "En préparation" },
  { value: "EN_COURS", label: "En cours de livraison" },
  { value: "LIVREE", label: "Livrée" },
  { value: "ECHEC", label: "Échec de livraison" },
];

export const STATUTS_COMMANDE: readonly Option[] = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "EN_PREPARATION", label: "En préparation" },
  { value: "PRETE", label: "Prête" },
  { value: "TERMINEE", label: "Terminée" },
  { value: "ANNULEE", label: "Annulée" },
];

export const UNITES = ["pièce", "paire", "paquet", "boîte", "carton", "mètre", "kg"];

export const PAGE_SIZE = 24;

export const labelOf = (list: readonly Option[], value: string) =>
  list.find((o) => o.value === value)?.label ?? value;
