import express from "express";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CHARACTERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "characters.json"), "utf-8")
);

const app = express();
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/output", express.static(path.join(__dirname, "output")));

const VIDEO_W = 1080;
const VIDEO_H = 1920;

// ---------- 1. Génération du script structuré via Groq ----------
async function generateScript(theme) {
  const characterList = Object.entries(CHARACTERS)
    .map(([id, c]) => `- id: "${id}" | ${c.nom} | ${c.description}`)
    .join("\n");

  const systemPrompt = `Tu es un scénariste pour de courtes vidéos TikTok façon dessin animé.
Tu dois choisir uniquement parmi ces personnages fixes (ne jamais en inventer d'autres) :
${characterList}

Réponds UNIQUEMENT avec un JSON valide, sans texte autour, au format exact :
{
  "titre": "string",
  "decor": "string (description courte du décor)",
  "dialogue": [
    { "personnage_id": "id_du_personnage", "texte": "réplique courte, punchy, style TikTok" }
  ]
}
Règles :
- 6 à 10 répliques maximum (vidéo courte, environ 30-45 secondes)
- Utilise 1 à 3 personnages différents selon le thème
- Ton naturel, accrocheur, adapté à TikTok (phrases courtes)
- personnage_id doit être un id exact de la liste ci-dessus`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Thème de l'histoire : ${theme}` },
    ],
    temperature: 0.9,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  const script = JSON.parse(raw);

  // Sécurité : on filtre toute réplique qui référence un personnage inconnu
  script.dialogue = script.dialogue.filter((d) => CHARACTERS[d.personnage_id]);
  return script;
}

// ---------- 2. Génération de la voix (Groq TTS - Orpheus) pour chaque réplique ----------
async function generateVoiceLine(text, voice, outPath) {
  const response = await groq.audio.speech.create({
    model: "canopylabs/orpheus-v1-english",
    voice,
    input: text,
    response_format: "wav",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
}

// ---------- 3. Assemblage d'un clip par réplique (image + audio + sous-titre) ----------
async function buildLineClip(line, index, jobDir) {
  const character = CHARACTERS[line.personnage_id];
  const audioPath = path.join(jobDir, `line_${index}.wav`);
  await generateVoiceLine(line.texte, character.voice, audioPath);

  // Durée de l'audio
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);
  const duration = parseFloat(stdout.trim()) + 0.3; // petite marge

  const characterImage = path.join(__dirname, character.image);
  const clipPath = path.join(jobDir, `clip_${index}.mp4`);

  // Texte du sous-titre échappé pour ffmpeg drawtext
  const safeText = line.texte
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019");

  await execFileAsync("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", characterImage,
    "-i", audioPath,
    "-filter_complex",
    `[0:v]scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase,crop=${VIDEO_W}:${VIDEO_H},` +
      `drawtext=text='${safeText}':fontcolor=white:fontsize=64:borderw=4:bordercolor=black:` +
      `x=(w-text_w)/2:y=h-400:line_spacing=10[v]`,
    "-map", "[v]",
    "-map", "1:a",
    "-t", duration.toString(),
    "-c:v", "libx264",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    clipPath,
  ]);

  return clipPath;
}

// ---------- 4. Concaténation des clips ----------
async function concatClips(clipPaths, jobDir, outPath) {
  const listPath = path.join(jobDir, "list.txt");
  fs.writeFileSync(
    listPath,
    clipPaths.map((p) => `file '${p}'`).join("\n")
  );
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c", "copy",
    outPath,
  ]);
}

// ---------- Endpoint principal ----------
app.post("/api/generate", async (req, res) => {
  const { theme } = req.body;
  if (!theme) return res.status(400).json({ error: "Le champ 'theme' est requis." });

  const jobId = Date.now().toString();
  const jobDir = path.join(__dirname, "tmp", jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const script = await generateScript(theme);

    const clipPaths = [];
    for (let i = 0; i < script.dialogue.length; i++) {
      const clip = await buildLineClip(script.dialogue[i], i, jobDir);
      clipPaths.push(clip);
    }

    const finalName = `${jobId}.mp4`;
    const finalPath = path.join(__dirname, "output", finalName);
    await concatClips(clipPaths, jobDir, finalPath);

    res.json({
      titre: script.titre,
      decor: script.decor,
      dialogue: script.dialogue,
      video_url: `/output/${finalName}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
