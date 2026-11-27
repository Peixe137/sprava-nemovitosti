"use client";
/** Tlačítko Tisk / uložit jako PDF (v tiskovém dialogu „Uložit jako PDF“). */
export function Tisk({ text = "Tisk / PDF" }: { text?: string }) {
  return <button type="button" onClick={() => window.print()} className="tlacitko print:hidden">{text}</button>;
}
