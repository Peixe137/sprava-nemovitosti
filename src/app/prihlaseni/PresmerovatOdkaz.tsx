"use client";
import { useEffect } from "react";

/** Odkaz z pozvánky / obnovy hesla může přistát tady (adresa webu v Supabase) – pošle ho na nastavení hesla. */
export function PresmerovatOdkaz() {
  useEffect(() => {
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error_description")) {
      window.location.replace("/heslo" + window.location.hash);
    }
  }, []);
  return null;
}
