"use client";
import { useEffect, useRef, useState } from "react";
import { toCanvas, fileToCanvas } from "../lib/image";
import Steps from "./Steps";

// Étape 1 : caméra de l'appareil ou import d'un fichier envoyé par le client.
export default function CaptureStep({ onPhoto }) {
  const video = useRef(null);
  const [facing, setFacing] = useState("user");
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream;
    let dead = false;
    setReady(false);
    setErr("");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (dead) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);
      } catch {
        if (!dead) setErr("Caméra inaccessible : autorisez-la dans le navigateur ou importez un fichier.");
      }
    })();
    return () => {
      dead = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const snap = () => onPhoto(toCanvas(video.current, video.current.videoWidth, video.current.videoHeight));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onPhoto(await fileToCanvas(file));
    } catch {
      setErr("Image illisible : essayez un fichier JPEG ou PNG.");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Steps n={1} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Photo du client</h1>
        <p className="text-slate-600">Visage de face, bouche fermée, éclairage de face, fond clair.</p>
      </div>

      <div className="relative mx-auto aspect-[7/9] w-full max-w-[calc(52dvh*7/9)] overflow-hidden rounded-xl bg-ink shadow-lg">
        <video ref={video} playsInline muted autoPlay className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        <svg viewBox="0 0 70 90" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <ellipse cx="35" cy="40" rx="17" ry="24" fill="none" stroke="#fff" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.85" />
        </svg>
        {!ready && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center font-medium text-white">
            {err ? "Caméra non disponible" : "Démarrage de la caméra…"}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!ready}
        onClick={snap}
        className="flex h-20 w-full items-center justify-center gap-3 rounded-xl bg-action text-xl font-extrabold text-white active:brightness-90 disabled:bg-slate-300 disabled:text-slate-500"
      >
        <span className="h-8 w-8 rounded-full border-4 border-current" />
        Prendre la photo
      </button>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-action text-center font-bold text-action focus-within:ring-4 focus-within:ring-action/40">
          Importer un fichier
          <input type="file" accept="image/*" onChange={upload} className="sr-only" />
        </label>
        <button
          type="button"
          onClick={() => setFacing(facing === "user" ? "environment" : "user")}
          className="h-16 rounded-xl border-2 border-slate-300 bg-white font-bold active:bg-slate-200"
        >
          Changer de caméra
        </button>
      </div>

      {err && <p className="text-center text-sm font-medium text-stop">{err}</p>}
    </div>
  );
}
