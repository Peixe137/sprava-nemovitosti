"use client";
import { useSearchParams } from "next/navigation";

/** Zelená informace z parametru ?zprava= (např. „Smazání čeká na schválení“). */
export function Zprava() {
  const z = useSearchParams().get("zprava");
  if (!z) return null;
  return <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{z}</p>;
}
