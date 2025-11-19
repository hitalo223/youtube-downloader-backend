const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// garante que a pasta downloads exista
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// rota raiz para checar se está online
app.get("/", (req, res) => {
  res.send("Backend está rodando!");
});

// rota para baixar vídeo/áudio
app.post("/download", (req, res) => {
  const { url, quality, start, end, type } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL do vídeo é obrigatória." });
  }

  // nome temporário único
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`;
  const outputPath = path.join(DOWNLOADS_DIR, fileName);

  // montando argumentos para spawn usando python3 -m yt_dlp
  const args = ["-m", "yt_dlp", "-o", outputPath];

  // tipo mídia / formato
  if (type === "video") {
    if (quality) args.push("-f", quality);
    else args.push("-f", "best");
  } else if (type === "audio") {
    args.push("-f", "bestaudio");
  } else {
    // padrão
    args.push("-f", "best");
  }

  // trecho opcional
  if (start && end) {
    args.push("--download-sections", `*${start}-${end}`);
  }

  // por fim, a URL
  args.push(url);

  console.log("Spawnando yt-dlp com args:", args.join(" "));

  // spawn: python3 -m yt_dlp <args...>
  const ytdlp = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });

  // opcional: log do progresso vindo do stderr (yt-dlp escreve progresso em stderr)
  ytdlp.stderr.on("data", (chunk) => {
    const txt = chunk.toString();
    // escreve nos logs do Render
    console.log("[yt-dlp stderr]", txt);
  });

  ytdlp.stdout.on("data", (chunk) => {
    // raramente usado para dados binários quando escrevemos em arquivo, mas deixamos log
    console.log("[yt-dlp stdout chunk length]", chunk.length);
  });

  ytdlp.on("error", (err) => {
    console.error("Erro ao spawnar yt-dlp:", err);
    safeCleanupAndRespond(outputPath, res, 500, { error: "Falha ao iniciar o download." });
  });

  ytdlp.on("close", (code, signal) => {
    console.log(`yt-dlp finalizou com code=${code} signal=${signal}`);
    if (code === 0) {
      // arquivo pronto — envia para o usuário
      res.download(outputPath, fileName, (err) => {
        if (err) {
          console.error("Erro ao enviar arquivo:", err);
          // tenta limpar
          try { fs.unlinkSync(outputPath); } catch(e){/*ignore*/ }
        } else {
          // apagando o arquivo após envio
          try { fs.unlinkSync(outputPath); } catch(e){ console.error("Erro ao remover arquivo:", e); }
        }
      });
    } else {
      console.error("yt-dlp retornou erro. Ver logs acima.");
      safeCleanupAndRespond(outputPath, res, 500, { error: "Falha ao baixar o vídeo." });
    }
  });

  // timeout de segurança: se o processo demorar demais, mata e responde
  const TIMEOUT_MS = 1000 * 60 * 5; // 5 minutos (ajuste se quiser)
  const killTimer = setTimeout(() => {
    console.error("Tempo limite excedido, matando processo yt-dlp.");
    ytdlp.kill("SIGKILL");
    safeCleanupAndRespond(outputPath, res, 504, { error: "Tempo limite de download excedido." });
  }, TIMEOUT_MS);

  // quando o processo terminar, limpar o timer
  ytdlp.on("exit", () => clearTimeout(killTimer));
});

// função utilitária para limpar arquivo e responder JSON de erro
function safeCleanupAndRespond(filePath, res, statusCode, jsonBody) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error("Erro ao remover arquivo temporário:", e);
  }
  if (!res.headersSent) {
    res.status(statusCode).json(jsonBody);
  } else {
    console.warn("Headers já enviados — não é possível responder JSON.");
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
