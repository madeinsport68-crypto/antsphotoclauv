// Détourage de la personne (Replicate). Renvoie un PNG transparent ; le fond gris est appliqué côté navigateur.
export const runtime = "nodejs";
export const maxDuration = 60;

const API = "https://api.replicate.com/v1";

export async function POST(req) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return Response.json({ error: "REPLICATE_API_TOKEN manquant" }, { status: 501 });
  try {
    const { image } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return Response.json({ error: "Image invalide" }, { status: 400 });
    }
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const model = process.env.REPLICATE_BG_MODEL || "851-labs/background-remover";

    const info = await (await fetch(`${API}/models/${model}`, { headers })).json();
    const version = info?.latest_version?.id;
    if (!version) throw new Error(info?.detail || "Modèle Replicate introuvable");

    let pred = await (
      await fetch(`${API}/predictions`, {
        method: "POST",
        headers: { ...headers, Prefer: "wait=30" },
        body: JSON.stringify({ version, input: { image } }),
      })
    ).json();
    if (!pred.id) throw new Error(pred.detail || "Erreur Replicate");

    const t0 = Date.now();
    while (!["succeeded", "failed", "canceled"].includes(pred.status) && Date.now() - t0 < 20000) {
      await new Promise((r) => setTimeout(r, 1200));
      pred = await (await fetch(pred.urls.get, { headers })).json();
    }
    if (pred.status !== "succeeded") throw new Error(pred.error || "Détourage impossible");

    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    const png = await fetch(url);
    if (!png.ok) throw new Error("Résultat Replicate inaccessible");
    return new Response(await png.arrayBuffer(), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
