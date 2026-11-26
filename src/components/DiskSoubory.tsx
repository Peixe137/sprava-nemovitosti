import Link from "next/link";
import { cestaOdKorene, jeSlozka, obsahSlozky, type Soubor } from "@/lib/googleDisk";
import { datum } from "@/lib/format";

const velikost = (b?: string) => {
  const n = Number(b ?? 0);
  if (!n) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
};
const ikona = (s: Soubor) => jeSlozka(s) ? "📁" : s.mimeType.includes("pdf") ? "📕" : s.mimeType.startsWith("image/") ? "🖼️"
  : s.mimeType.includes("spreadsheet") || s.mimeType.includes("excel") ? "📊" : s.mimeType.includes("document") || s.mimeType.includes("word") ? "📄" : "📎";

/** Seznam souborů ze složky nemovitosti na Google Disku (přes servisní účet), s procházením podsložek. */
export async function DiskSoubory({ nemovitostId, korenId, slozkaId }: { nemovitostId: string; korenId: string; slozkaId?: string }) {
  let cesta: Soubor[] | null, soubory: Soubor[];
  try {
    cesta = await cestaOdKorene(korenId, slozkaId || korenId);
    if (!cesta) cesta = await cestaOdKorene(korenId, korenId);
    soubory = await obsahSlozky(cesta![cesta!.length - 1].id);
  } catch (e) {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{e instanceof Error ? e.message : "Složku se nepodařilo načíst."}</p>;
  }
  const odkaz = (id: string) => `/nemovitosti/${nemovitostId}${id === korenId ? "" : `?disk=${id}`}#disk`;
  return (
    <div className="text-sm">
      {cesta!.length > 1 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {cesta!.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">{i > 0 && "›"}
              {i < cesta!.length - 1 ? <Link href={odkaz(c.id)} className="odkaz">{i === 0 ? "Složka nemovitosti" : c.name}</Link> : <b className="text-slate-700">{c.name}</b>}
            </span>))}
        </nav>
      )}
      {soubory.length === 0 ? <p className="text-slate-500">Složka je prázdná.</p> : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
          <table className="tabulka">
            <tbody>{soubory.map((s) => (
              <tr key={s.id}>
                <td className="w-full">
                  {jeSlozka(s)
                    ? <Link href={odkaz(s.id)} className="font-medium hover:underline">{ikona(s)} {s.name}</Link>
                    : <a href={`/disk/${s.id}?nemovitost=${nemovitostId}`} target="_blank" rel="noopener" className="hover:underline">{ikona(s)} {s.name}</a>}
                </td>
                <td className="whitespace-nowrap text-xs text-slate-500">{velikost(s.size)}</td>
                <td className="whitespace-nowrap text-xs text-slate-500">{s.modifiedTime ? datum(s.modifiedTime.slice(0, 10)) : ""}</td>
                <td className="whitespace-nowrap text-xs">{s.webViewLink && <a href={s.webViewLink} target="_blank" rel="noopener" className="odkaz" title="Otevřít v Google Disku">Disk ↗</a>}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
