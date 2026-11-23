import Link from "next/link";
import { Nadpis } from "@/components/Chyba";

type Kapitola = { id: string; nadpis: string; odkaz?: string; body: (string | [string, string])[] };

// Krátký návod: co kde je a jak na běžné úkony. Při změně aplikace doplnit.
const KAPITOLY: Kapitola[] = [
  { id: "zaciname", nadpis: "Jak začít", body: [
    ["1. Vlastníci", "Nejdřív založte vlastníky – své firmy, sebe a klienty ve správě. U firmy stačí IČO a tlačítko ARES."],
    ["2. Nemovitosti", "Založte budovu, byt, pozemek… Adresu začněte psát do pole „Vyhledat adresu“ – katastr, LV a parcela se doplní z RÚIAN."],
    ["3. Jednotky", "U budovy rozdělené na jednotky otevřete detail budovy → „+ Přidat jednotku“. Jednotka přebírá z budovy vlastníka, adresu, katastr a datum pořízení."],
    ["4. Nájemní smlouvy", "„+ Nájemní smlouva“ – po výběru nemovitosti se předvyplní pronajímatel, VS a číslo smlouvy. Po uložení se samy vytvoří platby od začátku nájmu."],
  ] },
  { id: "hledani", nadpis: "Hledání", body: [
    "Pole „Hledat…“ vlevo nahoře (zkratka ⌘K nebo „/“) prohledá nemovitosti, katastr, nájemníky, vlastníky, smlouvy, platby, náklady i dokumenty. Na diakritice nezáleží – „posta“ najde „Pošta“.",
  ] },
  { id: "nemovitosti", nadpis: "Nemovitosti", odkaz: "/nemovitosti", body: [
    ["Fáze", "Nákup (v přípravě) → Držení → Flip (koupeno k prodeji) → V prodeji. Prodej nebo konec správy se řeší archivací."],
    ["Využití", "K pronájmu / Vlastní užívání / Rekonstrukce / Bez využití. Zda je pronajato nebo volné, aplikace pozná ze smluv – nevyplňuje se."],
    ["Upozornění", "Volný text pro to, co se řeší (právní vady, spor, exekuce). V seznamu se ukáže ⚠."],
    ["Budova a jednotky", "Jednotka pod budovou má vlastní jen název, patro, plochu a využití. Ostatní se propisuje z budovy, i když budovu později upravíte. Samostatný byt (např. v SVJ) zakládejte bez „Patří pod“."],
    ["Patro a číslo jednotky", "Patro 2 + jednotka 01 = číslo 201. Z čísla se skládá variabilní symbol."],
    ["Katastr", "V detailu sekce „Katastr – z čeho se nemovitost skládá“: pozemky, stavby a jednotky. Při přidání parcely zaškrtnuté „doplnit výměru a druh z RÚIAN“ dotáhne údaje z katastru; každý řádek jde upravit."],
    ["Google Disk", "Odkaz na složku vložte v Upravit. Tlačítko „Disk ↗“ je v seznamu i v detailu; jednotka bez vlastní podsložky otevře složku budovy."],
    ["Archiv a smazání", "Upravit → Archivovat (prodáno, konec správy…) – vše zůstane v historii. Smazat jen omyly a duplicity (dole v Upravit)."],
  ] },
  { id: "smlouvy", nadpis: "Nájemní smlouvy", odkaz: "/smlouvy", body: [
    ["Variabilní symbol", "LV + číslo jednotky + pořadí smlouvy: 19100011 = LV 1910, jednotka 001, 1. smlouva. Stejný VS nejde použít dvakrát."],
    ["Číslo smlouvy", "RRMMDD-LV-JJJ podle data začátku nájmu, např. 261201-1910-001. Vyplní se samo."],
    ["Platby", "Nájem i zálohy jsou samostatné položky s periodou měsíčně / čtvrtletně / pololetně / ročně. Změna nájmu: v detailu smlouvy starou položku ukončete a přidejte novou."],
    ["Kontakty", "U smlouvy lze přidat další osoby s funkcí (vedoucí pobočky, účetní…). Telefon a e-mail jsou klikací."],
    ["Zaplaceno", "Do napojení banky se úhrada zapíše tlačítkem „Zaplaceno“ u měsíce (lze zadat i částečnou částku)."],
  ] },
  { id: "finance", nadpis: "Finance", odkaz: "/finance", body: [
    ["Přehled", "Příjmy a náklady po měsících a struktura nákladů."],
    ["Dlužníci", "Kdo dluží a jak dlouho (0–30, 31–60, 61–90, 90+ dní)."],
    ["Platby", "Pohyby z bankovního účtu. Po napojení Fio se párují automaticky podle VS."],
    ["Náklady", "Náklad k nemovitosti; u plátců DPH se rozpočítá základ a daň."],
  ] },
];

export default function Napoveda() {
  return (
    <>
      <Nadpis titulek="Nápověda" podtitulek="Co kde najdete a jak na běžné úkony" />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {KAPITOLY.map((k) => <a key={k.id} href={`#${k.id}`} className="rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50">{k.nadpis}</a>)}
      </nav>
      <div className="max-w-3xl space-y-6">
        {KAPITOLY.map((k) => (
          <section key={k.id} id={k.id} className="karta scroll-mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">{k.nadpis}</h2>
              {k.odkaz && <Link href={k.odkaz} className="text-sm odkaz">Otevřít →</Link>}
            </div>
            <dl className="space-y-3 text-sm">
              {k.body.map((b, i) => typeof b === "string"
                ? <p key={i} className="text-slate-700">{b}</p>
                : <div key={i}><dt className="font-medium">{b[0]}</dt><dd className="text-slate-600">{b[1]}</dd></div>)}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
