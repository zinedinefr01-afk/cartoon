# Générateur de vidéos TikTok — dessin animé

## Ce que fait cet outil
Tu écris un thème (ex: "une histoire d'amour entre le jeune homme et la jeune fille voilée").
L'outil :
1. écrit le scénario avec l'IA (Groq),
2. génère la voix de chaque personnage (Groq TTS),
3. assemble une vidéo verticale (1080x1920, format TikTok) avec sous-titres.

## Étape 1 — Il te faut des images de personnages
Avant de déployer, ajoute une image PNG pour chacun des 8 personnages dans
`public/characters/` avec **exactement** ces noms de fichier :

- `jeune_homme.png`
- `jeune_fille.png`
- `jeune_fille_voilee.png`
- `pere.png`
- `mere.png`
- `enfant.png`
- `pote_comique.png`
- `grand_pere.png`

Conseil : format portrait ou carré, fond simple (uni ou transparent), même style visuel pour tous
(pour que ça ressemble à un vrai univers cohérent).

## Étape 2 — Récupérer une clé API Groq (gratuit pour commencer)
1. Va sur https://console.groq.com
2. Crée un compte
3. Dans "API Keys", crée une clé et copie-la (tu en auras besoin à l'étape 4)

## Étape 3 — Mettre le projet sur GitHub
1. Crée un compte sur https://github.com si tu n'en as pas
2. Crée un nouveau repository (ex: `tiktok-cartoon-generator`)
3. Mets tous les fichiers de ce dossier dedans (bouton "Add file" > "Upload files" sur GitHub, tu peux glisser-déposer tout le dossier)

## Étape 4 — Déployer sur Render (aucun code à écrire)
1. Va sur https://render.com et crée un compte
2. Clique "New" > "Web Service"
3. Connecte ton compte GitHub et choisis le repository que tu viens de créer
4. Render va détecter le `Dockerfile` automatiquement — laisse les réglages par défaut
5. Dans "Environment Variables", ajoute :
   - Key: `GROQ_API_KEY`
   - Value: (colle ta clé de l'étape 2)
6. Clique "Create Web Service"
7. Attends quelques minutes que le déploiement se termine (statut "Live")
8. Ton site est accessible à l'URL fournie par Render (ex: `https://ton-projet.onrender.com`)

## Limites à connaître pour la suite
- Le plan gratuit de Render peut être lent/s'endormir après inactivité — pour un usage régulier,
  un plan payant Render est recommandé.
- Les noms de voix (`austin`, `hannah`, `troy`) dans `characters.json` viennent de la documentation
  Groq Orpheus — vérifie la liste des voix disponibles sur https://console.groq.com/docs/text-to-speech
  au cas où elle aurait changé, et ajuste si besoin.
- Pour poster automatiquement sur TikTok, il faudra ajouter une étape supplémentaire (API TikTok ou
  publication manuelle) — non incluse dans cette première version.
