const MAX = 1400; // px : plus grand côté de l'image de travail (analyse, détourage, impression)

export function toCanvas(src, w, h) {
  const k = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(toCanvas(img, img.naturalWidth, img.naturalHeight)); // l'orientation EXIF est appliquée par le navigateur
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image illisible"));
    };
    img.src = url;
  });
}
