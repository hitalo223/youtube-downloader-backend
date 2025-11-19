const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ROTA PRINCIPAL PARA BAIXAR VÍDEO OU ÁUDIO
app.post("/download", (req, res) => {
    const { url, quality, start, end, type } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL do vídeo é obrigatória." });
    }

    const output = path.join(__dirname, "download.mp4");

    // Comando base chamando yt-dlp pelo Python
    let cmd = `python3 -m yt_dlp "${url}" -o "${output}"`;

    // Tipo de mídia
    if (type === "video") {
        cmd += ` -f "${quality || "best"}"`;
    } else if (type === "audio") {
        cmd += ` -f "bestaudio"`;
    }

    // Trecho do vídeo (se enviado)
    if (start && end) {
        cmd += ` --download-sections "*${start}-${end}"`;
    }

    console.log("Executando:", cmd);

    exec(cmd, (error) => {
        if (error) {
            console.error("Erro ao executar:", error);
            return res.status(500).send("Erro ao baixar o vídeo.");
        }

        res.download(output, "arquivo.mp4", (err) => {
            if (err) console.error("Erro ao enviar:", err);
        });
    });
});

// Porta usada no Render
app.listen(10000, () => console.log("Backend rodando na porta 10000"));
