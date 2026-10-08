// Détection du visage et détourage de secours : MediaPipe (WASM), chargé depuis un CDN, exécuté dans le navigateur.
// Gratuit, et aucune photo ne quitte l'appareil pour cette partie.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODELS = "https://storage.googleapis.com/mediapipe-models";

const once = (fn) => {
  let p;
  return () =>
    (p ??= fn().catch((e) => {
      p = null; // permet de réessayer après un échec réseau
      throw e;
    }));
};

const lib = once(async () => {
  const m = await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
  return { m, files: await m.FilesetResolver.forVisionTasks(WASM) };
});

const faceModel = once(async () => {
  const { m, files } = await lib();
  return m.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "CPU" },
    runningMode: "IMAGE",
    numFaces: 2,
    outputFaceBlendshapes: true,
  });
});

const segModel = once(async () => {
  const { m, files } = await lib();
  return m.ImageSegmenter.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: `${MODELS}/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`,
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
});

// Géométrie et expression du visage, en pixels du canvas.
export async function detectFace(canvas) {
  const lm = await faceModel();
  const r = lm.detect(canvas);
  const faces = r.faceLandmarks || [];
  if (faces.length !== 1) return { count: faces.length };

  const L = faces[0].map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height }));
  const bs = {};
  (r.faceBlendshapes?.[0]?.categories || []).forEach((c) => (bs[c.categoryName] = c.score));

  const chin = L[152]; // menton
  const top = L[10]; // haut du front
  const ux = top.x - chin.x;
  const uy = top.y - chin.y;
  const faceLen = Math.hypot(ux, uy);
  // Le sommet du crâne se situe environ 28 % de la hauteur de visage au-dessus du haut du front.
  const crown = { x: top.x + ux * 0.28, y: top.y + uy * 0.28 };
  const faceW = Math.abs(L[454].x - L[234].x) || 1;

  return {
    count: 1,
    headH: faceLen * 1.28, // menton -> sommet du crâne (px)
    cx: (chin.x + crown.x) / 2,
    cy: (chin.y + crown.y) / 2,
    nose: L[1],
    roll: (Math.atan2(L[263].y - L[33].y, L[263].x - L[33].x) * 180) / Math.PI, // inclinaison de la tête (°)
    yaw: Math.abs((L[1].x - Math.min(L[234].x, L[454].x)) / faceW - 0.5), // 0 = de face
    eyesOpen: (bs.eyeBlinkLeft ?? 0) < 0.5 && (bs.eyeBlinkRight ?? 0) < 0.5,
    mouthOpen: Math.abs(L[14].y - L[13].y) / faceLen > 0.025 || (bs.jawOpen ?? 0) > 0.25,
    smile: ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2,
  };
}

// Détourage local (secours si Replicate n'est pas disponible) : renvoie un masque (canvas, alpha = personne).
export async function segmentLocal(canvas, probe) {
  const seg = await segModel();
  let mask;
  const read = (res) => {
    const mk = res.confidenceMasks[0];
    const d = mk.getAsFloat32Array();
    const w = mk.width;
    const h = mk.height;
    const px = Math.min(w - 1, Math.max(0, Math.floor((probe.x / canvas.width) * w)));
    const py = Math.min(h - 1, Math.max(0, Math.floor((probe.y / canvas.height) * h)));
    const bgFirst = d[py * w + px] < 0.5; // le point sonde (nez) ne doit pas être classé "fond"
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < d.length; i++) {
      const p = bgFirst ? 1 - d[i] : d[i];
      img.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (p - 0.3) / 0.4)));
    }
    ctx.putImageData(img, 0, 0);
    mask = c;
  };
  const res = seg.segment(canvas, read); // selon la version : callback ou valeur de retour
  if (res) {
    read(res);
    res.close?.();
  }
  if (!mask) throw new Error("segmentation impossible");
  return mask;
}

// Garde les pixels de la photo là où le masque (ou le PNG détouré) est opaque ; le reste devient transparent.
export function applyMask(src, mask) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mask, 0, 0, c.width, c.height);
  return c;
}
