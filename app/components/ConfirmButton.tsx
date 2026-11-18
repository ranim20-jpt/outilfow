"use client";

import type { ButtonHTMLAttributes } from "react";

/** Bouton de soumission qui demande une confirmation avant d'envoyer le formulaire. */
export default function ConfirmButton({
  confirm,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirm: string }) {
  return (
    <button
      {...props}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
