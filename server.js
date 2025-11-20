const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// diretório onde os vídeos temporários serão salvos
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// arquivo de cookies (você já enviou para o GitHub!)
const COOKIES_FILE = path.join(__dirname, "youtube_cookies.txt");

// rota raiz
app.get("/", (req, res) => {
  res.send("Backend está rodando com cookies!");
});

// rota principal para download
app.post("/download", (req, res) => {
  const { url, type, quality, start, end } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL do vídeo é obrigatória." });
  }

  // nome único para arquivo
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(DOWNLOADS_DIR, fileName);

  // argumentos do yt-dlp
  const args = [
    "-m", "yt_dlp",
    "--cookies", COOKIES_FILE,
    "-o", outputPath
  ];

  // qualidade: usamos bestvideo+bestaudio (recomendado)
  if (type === "audio") {
    args.push("-f", "bestaudio");
  } else {
    args.push("-f", "bestvideo+bestaudio/best");
  }

  // trecho opcional
  if (start && end) {
    args.push("--download-sections", `*${start}-${end}`);
  }

  // URL final
  args.push(url);

  console.log("Executando yt-dlp:", args.join(" "));

  const ytdlp = spawn("python3", args);

  ytdlp.stderr.on("data", (data) => {
    console.log("[yt-dlp stderr]", data.toString());
  });

  ytdlp.stdout.on("data", (data) => {
    console.log("[yt-dlp stdout]", data.toString());
  });

  ytdlp.on("close", (code) => {
    console.log("Processo yt-dlp finalizado com código:", code);

    if (code !== 0) {
      try { fs.unlinkSync(outputPath); } catch(e){}
      return res.status(500).json({ error: "Falha ao baixar o vídeo." });
    }

    res.download(outputPath, fileName, (err) => {
      try { fs.unlinkSync(outputPath); } catch(e){}
    });
  });
});

// porta Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);
