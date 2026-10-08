"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectFace, segmentLocal, applyMask } from "../lib/vision";
import { buildChecks } from "../lib/checks";
import { HEAD_MM, HEAD_Y, renderPhoto } from "../lib/ants";
import FormatModal from "./FormatModal";
import Steps from "./Steps";

const PW = 350;
const PH = 450;
const PPM = 10; // aperçu 3,5 × 4,5 cm à 10 px par mm

const post = (url, image) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });

// Auto-cadrage : visage centré, taille ramenée à HEAD_MM (34 mm, milieu de la plage 32-36 mm)
const frameOf = (f) => ({ cx: f.cx, cy: f.cy, s: f.headH / HEAD_MM });

// Contrôles visuels via /api/analyze (OpenAI) ; "off" si la clé n'est pas configurée.
async function runAi(jpeg) {
  try {
    const r = await post("/api/analyze", jpeg);
    if (r.status === 501) return { state: "off" };
    if (!r.ok) return { state: "error" };
    return { state: "ok", data: (await r.json()).result };
  } catch {
    return { state: "error" };
  }
}

// Fond gris : détourage via /api/remove-bg (Replicate), sinon détourage local (MediaPipe).
async function runCutout(photo, jpeg, faceP) {
  try {
    const r = await post("/api/remove-bg", jpeg);
    if (!r.ok) throw new Error("api");
    const img = await createImageBitmap(await r.blob());
    if (Math.abs(img.width / img.height - photo.width / photo.height) > 0.02) throw new Error("dimensions");
    return { state: "ok", mode: "ia", canvas: applyMask(photo, img) };
  } catch {
    try {
      const f = await faceP;
      const mask = await segmentLocal(photo, f?.nose || { x: photo.width / 2, y: photo.height / 2 });
      return { state: "ok", mode: "local", canvas: applyMask(photo, mask) };
    } catch {
      return { state: "error" };
    }
  }
}

// Repères d'aide au cadrage (aperçu uniquement, jamais imprimés) : sommet du crâne, menton, ovale du visage.
function guides(ctx) {
  const cy = PH * HEAD_Y;
  const half = (HEAD_MM / 2) * PPM;
  const p = new Path2D();
  p.moveTo(0, cy - half);
  p.lineTo(PW, cy - half);
  p.moveTo(0, cy + half);
  p.lineTo(PW, cy + half);
  p.moveTo(PW / 2 + 115, cy);
  p.ellipse(PW / 2, cy, 115, half, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.setLineDash([10, 7]);
  [["rgba(255,255,255,.9)", 4], ["#047857", 2]].forEach(([color, w]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke(p);
  });
  ctx.setLineDash([]);
  ctx.font = "bold 13px sans-serif";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#047857";
  [["sommet du crâne", cy - half - 6], ["menton", cy + half + 16]].forEach(([t, y]) => {
    ctx.strokeText(t, 6, y);
    ctx.fillText(t, 6, y);
  });
  ctx.restore();
}

const DOT = { ok: "bg-ok text-white", warn: "bg-caution text-white", error: "bg-stop text-white", wait: "bg-slate-200" };

function Dot({ state }) {
  return (
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${DOT[state]}`}>
      {state === "ok" ? "✓" : state === "warn" ? "!" : state === "error" ? "✕" : <i className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />}
    </span>
  );
}

function Banner({ chk }) {
  if (chk.errors.length)
    return (
      <div className="rounded-xl bg-stop p-4 text-white">
        <p className="font-extrabold">Photo non conforme : à corriger</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {chk.errors.map((e, i) => (
            <li key={i}>{e.msg}</li>
          ))}
        </ul>
      </div>
    );
  if (chk.waiting)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-slate-200 p-4 font-semibold">
        <i className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        Analyse IA en cours…
      </div>
    );
  if (chk.warns.length)
    return (
      <div className="rounded-xl bg-amber-100 p-4 text-amber-950">
        <p className="font-extrabold">Analyse terminée avec des alertes</p>
        <p>Contrôlez les points orange ci-dessous avant d'imprimer.</p>
      </div>
    );
  return (
    <div className="rounded-xl bg-ok p-4 font-semibold text-white">
      ✓ L'analyse IA est validée. Veuillez effectuer votre vérification humaine visuelle avant impression.
    </div>
  );
}

function Btn({ children, label, onClick, wide, primary }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-14 items-center justify-center rounded-xl border text-base font-bold ${
        primary ? "border-action bg-action text-white active:brightness-90" : "border-slate-300 bg-white active:bg-slate-200"
      } ${wide ? "w-full px-2" : "w-14 text-2xl"}`}
    >
      {children}
    </button>
  );
}

// Étape 2 : analyse IA + cadrage manuel (zoom, flèches, auto-cadrage), puis validation et choix du format.
export default function AdjustStep({ photo, onRetake, onDone }) {
  const [face, setFace] = useState(null); // géométrie du visage
  const [ai, setAi] = useState({ state: "loading" }); // contrôles visuels OpenAI
  const [cut, setCut] = useState({ state: "loading" }); // photo détourée
  const [fr, setFr] = useState(null); // cadrage { cx, cy, s }
  const [pick, setPick] = useState(false); // fenêtre de choix du format
  const cv = useRef(null);

  useEffect(() => {
    let dead = false;
    const jpeg = photo.toDataURL("image/jpeg", 0.88);
    const faceP = detectFace(photo).catch(() => ({ error: true }));
    faceP.then((f) => {
      if (dead) return;
      setFace(f);
      if (f.count === 1) setFr(frameOf(f)); // auto-cadrage initial
    });
    runAi(jpeg).then((v) => !dead && setAi(v));
    runCutout(photo, jpeg, faceP).then((v) => !dead && setCut(v));
    return () => {
      dead = true;
    };
  }, [photo]);

  useEffect(() => {
    const frame = fr || { cx: photo.width / 2, cy: photo.height * HEAD_Y, s: photo.height / 45 };
    const ctx = cv.current.getContext("2d");
    renderPhoto(ctx, cut.canvas || photo, frame, PW, PH, PPM);
    guides(ctx);
  }, [fr, cut, photo]);

  const move = (dx, dy) => setFr((f) => f && { ...f, cx: f.cx + dx * f.s, cy: f.cy + dy * f.s }); // 1 mm par appui
  const zoom = (z) => setFr((f) => f && { ...f, s: f.s * z }); // ~1 mm de hauteur de visage par appui
  const recenter = () => face?.count === 1 && setFr(frameOf(face));

  const headMm = face?.count === 1 && fr ? face.headH / fr.s : null;
  const chk = useMemo(() => buildChecks({ face, ai, cut, headMm }), [face, ai, cut, headMm]);
  const blocked = chk.errors.length > 0 || chk.waiting;

  return (
    <div className="space-y-4 p-4">
      <Steps n={2} />
      <Banner chk={chk} />

      <div className="space-y-2">
        <canvas ref={cv} width={PW} height={PH} className="mx-auto h-auto w-full max-w-[calc(50dvh*7/9)] rounded-md shadow-lg ring-1 ring-slate-300" />
        <p className="text-center text-sm text-slate-600">
          Aperçu 3,5 × 4,5 cm · {headMm != null ? `visage ${headMm.toFixed(1).replace(".", ",")} mm` : "mesure du visage…"}
        </p>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-3 gap-2">
          <span />
          <Btn label="Déplacer vers le haut" onClick={() => move(0, 1)}>↑</Btn>
          <span />
          <Btn label="Déplacer vers la gauche" onClick={() => move(1, 0)}>←</Btn>
          <span />
          <Btn label="Déplacer vers la droite" onClick={() => move(-1, 0)}>→</Btn>
          <span />
          <Btn label="Déplacer vers le bas" onClick={() => move(0, -1)}>↓</Btn>
          <span />
        </div>
        <div className="space-y-2">
          <Btn wide label="Zoom avant" onClick={() => zoom(1 / 1.03)}>+ Zoom</Btn>
          <Btn wide label="Zoom arrière" onClick={() => zoom(1.03)}>− Dézoom</Btn>
          <Btn wide primary label="Recentrer le visage automatiquement" onClick={recenter}>Auto-cadrage</Btn>
        </div>
      </div>

      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {chk.list.map((c, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <Dot state={c.state} />
            <div className="text-sm">
              <p className="font-semibold">{c.label}</p>
              {c.msg && <p className={c.state === "error" ? "text-stop" : c.state === "warn" ? "text-caution" : "text-slate-500"}>{c.msg}</p>}
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 -mx-4 -mb-4 grid grid-cols-[1fr_2fr] gap-2 border-t border-slate-300 bg-white/95 p-3 backdrop-blur">
        <button type="button" onClick={onRetake} className="h-16 rounded-xl border-2 border-slate-300 bg-white font-bold active:bg-slate-200">
          Nouvelle photo
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => setPick(true)}
          className="h-16 rounded-xl bg-action text-lg font-extrabold text-white active:brightness-90 disabled:bg-slate-300 disabled:text-slate-500"
        >
          Valider le cadrage
        </button>
      </div>

      {pick && (
        <FormatModal
          onClose={() => setPick(false)}
          onPick={(format) => {
            setPick(false);
            onDone({ src: cut.canvas || photo, framing: fr, format });
          }}
        />
      )}
    </div>
  );
}
