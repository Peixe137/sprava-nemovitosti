export function Chyba({ text }: { text?: string | string[] }) {
  if (!text) return null;
  return <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{String(text)}</p>;
}

export function Nadpis({ titulek, podtitulek, akce }: { titulek: string; podtitulek?: string; akce?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{titulek}</h1>
        {podtitulek && <p className="text-sm text-slate-500">{podtitulek}</p>}
      </div>
      {akce}
    </div>
  );
}
