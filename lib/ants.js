// Constantes ANTS et dessin des photos / de la planche (canvas, 300 dpi).
export const BG = "#F2F2F2"; // fond uni très clair (jamais blanc pur #FFFFFF) : seule constante à modifier pour changer la couleur
export const HEAD_MM = 34; // menton -> sommet du crâne visé (norme : 32 à 36 mm)
export const HEAD_Y = 0.47; // position verticale du centre de la tête dans la photo
export const DPI = 300;
const GAP_MM = 2; // espace de découpe entre deux photos

export const FORMATS = {
  A: { id: "A", label: "3,5 × 4,5 cm", info: "8 photos (4 + 4)", w: 35, h: 45, cols: 4, rows: 2, sheet: { w: 150, h: 100 } },
  B: { id: "B", label: "4 × 6 cm", info: "4 photos (2 + 2)", w: 40, h: 60, cols: 2, rows: 2, sheet: { w: 100, h: 150 } },
};

const px = (mm) => Math.round((mm * DPI) / 25.4);

// Dessine une photo : fond gris, puis l'image placée selon le cadrage { cx, cy, s }
// cx, cy = point de l'image placé au centre de la tête ; s = pixels de l'image par mm de photo.
export function renderPhoto(ctx, src, fr, W, H, ppm) {
  const k = ppm / fr.s;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, W / 2 - fr.cx * k, H * HEAD_Y - fr.cy * k, src.width * k, src.height * k);
}

// Assemble la planche 10 x 15 cm : photos au bon format, centrées, 300 dpi.
export function buildSheet(src, fr, f) {
  const sw = px(f.sheet.w);
  const sh = px(f.sheet.h);
  const pw = px(f.w);
  const ph = px(f.h);
  const gap = px(GAP_MM);
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sw, sh);
  const x0 = Math.round((sw - (f.cols * pw + (f.cols - 1) * gap)) / 2);
  const y0 = Math.round((sh - (f.rows * ph + (f.rows - 1) * gap)) / 2);
  ctx.strokeStyle = "#A6A6A6"; // traits de coupe : ce fond très clair se distingue à peine du papier blanc
  ctx.lineWidth = 2;
  for (let i = 0; i < f.cols * f.rows; i++) {
    const x = x0 + (i % f.cols) * (pw + gap);
    const y = y0 + Math.floor(i / f.cols) * (ph + gap);
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, pw, ph);
    ctx.clip();
    renderPhoto(ctx, src, fr, pw, ph, pw / f.w);
    ctx.restore();
    ctx.strokeRect(x - 1, y - 1, pw + 2, ph + 2); // 2 px (0,17 mm) juste à l'extérieur de la photo
  }
  return c;
}

// JPEG haute qualité avec la densité 300 dpi écrite dans l'en-tête JFIF (taille réelle à l'impression).
export async function sheetJpeg(canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.96));
  const b = new Uint8Array(await blob.arrayBuffer());
  if (b[2] === 0xff && b[3] === 0xe0 && b[6] === 0x4a) {
    b[13] = 1; // unité : dpi
    b[14] = b[16] = DPI >> 8;
    b[15] = b[17] = DPI & 255;
  }
  return new Blob([b], { type: "image/jpeg" });
}

// PDF d'une page à la taille exacte de la planche, contenant le JPEG tel quel (sans dépendance).
export function makePdf(jpeg, imgW, imgH, pageWmm, pageHmm) {
  const pt = (mm) => ((mm * 72) / 25.4).toFixed(2);
  const enc = new TextEncoder();
  const parts = [];
  const offs = [];
  let len = 0;
  const put = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    parts.push(b);
    len += b.length;
  };
  const obj = (n, body) => {
    offs[n] = len;
    put(`${n} 0 obj\n${body}\nendobj\n`);
  };
  const W = pt(pageWmm);
  const H = pt(pageHmm);
  const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  put("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len;
  put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  put(jpeg);
  put("\nendstream\nendobj\n");
  obj(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  const xref = len;
  const rows = [1, 2, 3, 4, 5].map((n) => `${String(offs[n]).padStart(10, "0")} 00000 n \n`).join("");
  put(`xref\n0 6\n0000000000 65535 f \n${rows}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}
