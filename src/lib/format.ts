const kc = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
export const korun = (v: number | string | null | undefined) => (v == null || v === "" ? "–" : kc.format(Number(v)));
export const datum = (v: string | null | undefined) =>
  v ? new Date(v + (v.length === 10 ? "T00:00:00" : "")).toLocaleDateString("cs-CZ") : "–";
export const mesic = (v: string | null | undefined) =>
  v ? new Date(v + "T00:00:00").toLocaleDateString("cs-CZ", { month: "long", year: "numeric" }) : "–";

export const STAVY_NEMOVITOSTI: Record<string, string> = {
  v_nakupu: "V nákupu", drzeni: "Držení", pronajem: "Pronájem", rekonstrukce: "Rekonstrukce",
  v_prodeji: "V prodeji", pravni_vady: "Řešení právních vad", prodano: "Prodáno",
  ve_sprave: "Ve správě", ukonceno: "Ukončeno",
};
export const DRUHY_VLASTNIKA: Record<string, string> = {
  vlastni_firma: "Moje firma", vlastni_osoba: "Já osobně", klient_sprava: "Klient ve správě",
};
export const DRUHY_PREDPISU: Record<string, string> = {
  najem: "Nájem", zaloha_voda: "Záloha voda", zaloha_teplo: "Záloha teplo", zaloha_tuv: "Záloha TUV",
  zaloha_elektrina: "Záloha elektřina", zaloha_plyn: "Záloha plyn", zaloha_sluzby: "Záloha služby",
  parkovani: "Parkování", fond_oprav_prefakturace: "Fond oprav", jine: "Jiné",
};
export const STAVY_POHLEDAVKY: Record<string, string> = {
  otevrena: "Nezaplaceno", castecne: "Částečně", uhrazena: "Zaplaceno", prominuta: "Prominuto", preplatek: "Přeplatek",
};
