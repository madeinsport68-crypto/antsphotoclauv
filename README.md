# PHOTOANTS

Application web minimaliste (format portrait) pour buralistes : photo d'identité conforme ANTS, puis planche 10 × 15 cm prête à imprimer.
Next.js 15 (App Router) · Tailwind CSS 3 · JavaScript · déployable tel quel sur Vercel.

## Parcours
1. **Photo** : caméra de l'appareil ou import d'un fichier.
2. **Cadrage** : analyse IA, zoom / flèches / auto-cadrage, fond remplacé par un fond uni clair #F2F2F2.
3. **Format** (après « Valider le cadrage ») :
   - 3,5 × 4,5 cm : 8 photos (4 + 4) sur une planche 15 × 10 cm en paysage (4 × 35 mm = 14 cm).
   - 4 × 6 cm : 4 photos (2 × 2) sur une planche 10 × 15 cm en portrait.
   Sortie : impression directe, JPEG 300 dpi ou PDF. Un fin trait de coupe gris est tracé autour de chaque photo, hors de la photo.

## Qui fait quoi
| Contrôle | Où | Clé requise |
|---|---|---|
| Visage unique, tête droite, yeux ouverts, bouche fermée, taille 32–36 mm | Navigateur (MediaPipe) | non |
| Lunettes épaisses, ombres, dents, torse nu, couvre-chef | `/api/analyze` (OpenAI) | `OPENAI_API_KEY` |
| Fond uni clair #F2F2F2 | `/api/remove-bg` (Replicate), sinon détourage local de secours | `REPLICATE_API_TOKEN` (facultative) |

Sans clé OpenAI : alerte orange « Contrôle IA non configuré », sans blocage. Sans clé Replicate : détourage local (qualité moindre).

## Variables d'environnement
| Nom | Valeur |
|---|---|
| `OPENAI_API_KEY` | votre clé OpenAI (`sk-...`) |
| `REPLICATE_API_TOKEN` | votre jeton Replicate (`r8_...`) |

Facultatives : `OPENAI_MODEL` (défaut `gpt-4o`), `REPLICATE_BG_MODEL` (défaut `851-labs/background-remover`).

**Sur Vercel** : à l'import du projet (écran « Configure Project » → *Environment Variables*), ou plus tard dans Project → Settings → Environment Variables. Ajoutez les deux noms ci-dessus avec vos valeurs, cochez Production, Preview et Development, puis Save. Les changements ne s'appliquent qu'aux nouveaux déploiements : Deployments → ⋯ → Redeploy.

**En local** : `cp .env.example .env.local`, puis renseignez les valeurs (le fichier est ignoré par git).

Ne mettez jamais ces clés dans le code ni sur GitHub.

## Lancer en local
```bash
cp .env.example .env.local   # renseigner les clés
npm install
npm run dev
```

## Déployer (GitHub + Vercel)
1. Créez un dépôt GitHub et envoyez le contenu de ce dossier à la racine :
   ```bash
   git init && git add . && git commit -m "PHOTOANTS" && git branch -M main
   git remote add origin <URL_DU_DEPOT> && git push -u origin main
   ```
2. vercel.com → Add New → Project → importez le dépôt (Next.js est détecté automatiquement).
3. Renseignez les variables d'environnement (section ci-dessus) → Deploy.

La caméra exige HTTPS (fourni par Vercel).

## Points d'attention
- **Couleur du fond** : #F2F2F2 est très proche du blanc. L'ANTS refuse les fonds blancs : contrôlez le rendu à l'impression. Pour la changer, modifiez la constante `BG` dans `lib/ants.js` (par exemple `#E6E6E6`), tout le reste suit.
- Le sommet du crâne est estimé à partir des points du visage (marge d'environ 2 mm) : la vérification humaine reste obligatoire (case à cocher avant impression).
- Les routes `/api` consomment vos clés payantes : fixez un plafond de dépense chez OpenAI et Replicate, et ne diffusez pas l'URL publiquement.
- RGPD : les photos transitent par OpenAI et Replicate pour l'analyse ; l'application ne stocke rien. Informez vos clients.
- Normes visées : visage de 32 à 36 mm (menton → sommet du crâne), fond uni clair (jamais blanc pur), expression neutre, bouche fermée, pas de lunettes épaisses, pas d'ombres.
