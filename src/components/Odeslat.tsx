"use client";
import { useFormStatus } from "react-dom";

// Tlačítko formuláře, které se během ukládání zablokuje (zabraňuje vícenásobnému uložení).
export function Odeslat({ children, svetle, className = "" }: { children: React.ReactNode; svetle?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={`${svetle ? "tlacitko-svetle" : "tlacitko"} ${className}`}>
      {pending ? "Ukládám…" : children}
    </button>
  );
}
