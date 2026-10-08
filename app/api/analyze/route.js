// Contrôles visuels que la géométrie du visage ne peut pas faire (OpenAI Vision).
export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPT = `Tu es un contrôleur de photos d'identité françaises (norme ANTS). Examine la photo et remplis le JSON demandé.
- sourire_dents : sourire avec des dents visibles
- lunettes : "aucune", "fines" ou "epaisses" (monture épaisse ou colorée)
- reflets_lunettes : reflets sur les verres
- ombres : ombres visibles sur le visage ou sur le fond derrière la personne
- couvre_chef : chapeau, casquette, bandeau, voile...
- visage_masque : cheveux sur les yeux ou le front, main, masque, écharpe devant le visage
- torse_nu : épaules et torse visibles sans aucun vêtement
- qualite : "bonne", "floue", "sombre" ou "surexposee"
Sois factuel et strict. N'identifie jamais la personne.`;

const SCHEMA = {
  name: "controle_photo",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["sourire_dents", "lunettes", "reflets_lunettes", "ombres", "couvre_chef", "visage_masque", "torse_nu", "qualite"],
    properties: {
      sourire_dents: { type: "boolean" },
      lunettes: { type: "string", enum: ["aucune", "fines", "epaisses"] },
      reflets_lunettes: { type: "boolean" },
      ombres: { type: "boolean" },
      couvre_chef: { type: "boolean" },
      visage_masque: { type: "boolean" },
      torse_nu: { type: "boolean" },
      qualite: { type: "string", enum: ["bonne", "floue", "sombre", "surexposee"] },
    },
  },
};

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "OPENAI_API_KEY manquante" }, { status: 501 });
  try {
    const { image } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image/")) {
      return Response.json({ error: "Image invalide" }, { status: 400 });
    }
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Contrôle cette photo d'identité." },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || "Erreur OpenAI");
    const txt = j.choices?.[0]?.message?.content;
    if (!txt) throw new Error("Réponse IA vide");
    return Response.json({ result: JSON.parse(txt) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
