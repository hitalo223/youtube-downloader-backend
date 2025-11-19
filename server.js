const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

// Rota raiz para testar se o backend está online
app.get("/", (req, res) => {
  res.send("Backend está rodando!");
});

// Rota para baixar vídeos usando yt-dlp já instalado via pip
app.post("/download", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL não fornecida." });
  }

  // Executa o yt-dlp instalado via pip
  exec(`yt-dlp -o - "${url}"`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error("Erro:", error);
      return res.status(500).json({ error: "Falha ao baixar o vídeo." });
    }
    res.set("Content-Type", "video/mp4");
    res.send(stdout);
  });
});

// Porta obrigatória para o Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
