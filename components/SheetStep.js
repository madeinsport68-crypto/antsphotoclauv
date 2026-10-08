"use client";
import { useEffect, useState } from "react";
import { FORMATS, buildSheet, sheetJpeg, makePdf } from "../lib/ants";
import Steps from "./Steps";

const save = (url, name) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
};

const SECONDARY = "h-14 rounded-xl border-2 border-slate-300 bg-white font-bold active:bg-slate-200 disabled:opacity-40";

// Étape 3 : planche 10 x 15 cm assemblée en canvas, avec double vérification avant impression.
export default function SheetStep({ src, framing, format, onBack, onRestart }) {
  const f = FORMATS[format];
  const [out, setOut] = useState(null); // { url, blob, w, h }
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let dead = false;
    let url;
    setOut(null);
    (async () => {
      const canvas = buildSheet(src, framing, f);
      const blob = await sheetJpeg(canvas);
      if (dead) return;
      url = URL.createObjectURL(blob);
      setOut({ url, blob, w: canvas.width, h: canvas.height });
    })();
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, framing, f]);

  const name = `photoants-${f.w}x${f.h}mm`;

  const downloadPdf = async () => {
    const bytes = new Uint8Array(await out.blob.arrayBuffer());
    const url = URL.createObjectURL(makePdf(bytes, out.w, out.h, f.sheet.w, f.sheet.h));
    save(url, `${name}.pdf`);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return alert("Autorisez les fenêtres pop-up pour imprimer.");
    w.document.write(
      `<!doctype html><title>PHOTOANTS</title><style>@page{size:${f.sheet.w}mm ${f.sheet.h}mm;margin:0}html,body{margin:0}img{display:block;width:${f.sheet.w}mm;height:${f.sheet.h}mm}</style><img src="${out.url}" onload="setTimeout(function(){print()},300)">`
    );
    w.document.close();
  };

  const ready = out && checked;

  return (
    <div className="space-y-4 p-4">
      <Steps n={3} />
      <div className="rounded-xl bg-ok p-4 font-semibold text-white">
        ✓ L'analyse IA est validée. Veuillez effectuer votre vérification humaine visuelle avant impression.
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {out ? (
          <img
            src={out.url}
            alt={`Planche de ${f.info} au format ${f.label}`}
            className="mx-auto w-full rounded-sm border border-slate-300"
            style={{ maxWidth: `min(100%, ${(50 * out.w) / out.h}dvh)` }}
          />
        ) : (
          <p className="py-16 text-center text-slate-500">Génération de la planche…</p>
        )}
        <p className="mt-2 text-center text-sm text-slate-600">
          Planche 10 × 15 cm · {f.info} de {f.label} · 300 dpi
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-action bg-white p-4">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="h-7 w-7 shrink-0 accent-[#2338C9]" />
        <span className="font-semibold">J'ai vérifié visuellement la photo : visage, fond, expression.</span>
      </label>

      <button
        type="button"
        disabled={!ready}
        onClick={print}
        className="h-16 w-full rounded-xl bg-action text-lg font-extrabold text-white active:brightness-90 disabled:bg-slate-300 disabled:text-slate-500"
      >
        Imprimer la planche
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={!ready} onClick={() => save(out.url, `${name}.jpg`)} className={SECONDARY}>
          JPEG haute déf.
        </button>
        <button type="button" disabled={!ready} onClick={downloadPdf} className={SECONDARY}>
          PDF haute déf.
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onBack} className={SECONDARY}>
          Modifier le cadrage
        </button>
        <button type="button" onClick={onRestart} className={SECONDARY}>
          Nouveau client
        </button>
      </div>
    </div>
  );
}
