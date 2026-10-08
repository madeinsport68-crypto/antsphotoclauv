"use client";
import { useState } from "react";
import CaptureStep from "../components/CaptureStep";
import AdjustStep from "../components/AdjustStep";
import SheetStep from "../components/SheetStep";

// Application mono-page : Photo -> Cadrage -> Planche (aucune navigation, tout se passe en état local)
export default function Home() {
  const [photo, setPhoto] = useState(null); // canvas de la photo du client
  const [out, setOut] = useState(null); // { src, framing, format }

  return (
    <>
      {!photo && <CaptureStep onPhoto={setPhoto} />}
      {photo && (
        // Le cadrage reste monté (masqué) quand on voit la planche : "Modifier le cadrage" ne relance pas l'IA
        <div hidden={!!out}>
          <AdjustStep photo={photo} onRetake={() => setPhoto(null)} onDone={setOut} />
        </div>
      )}
      {out && (
        <SheetStep
          {...out}
          onBack={() => setOut(null)}
          onRestart={() => {
            setOut(null);
            setPhoto(null);
          }}
        />
      )}
    </>
  );
}
