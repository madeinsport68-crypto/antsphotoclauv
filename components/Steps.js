const STEPS = ["Photo", "Cadrage", "Planche"];

export default function Steps({ n }) {
  return (
    <ol className="flex gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={`h-1.5 rounded-full ${i < n ? "bg-action" : "bg-slate-300"}`} />
          <span className={`mt-1 block text-sm ${i === n - 1 ? "font-bold text-ink" : "text-slate-500"}`}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
    </ol>
  );
}
