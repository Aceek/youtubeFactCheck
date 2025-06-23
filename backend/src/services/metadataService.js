const { spawn } = require("child_process");

/**
 * Récupère les métadonnées d'une vidéo YouTube via yt-dlp
 * @param {string} youtubeUrl - L'URL de la vidéo YouTube
 * @returns {Promise<Object>} Les métadonnées de la vidéo
 */
async function getVideoMetadata(youtubeUrl) {
    return new Promise((resolve, reject) => {
        console.log("Récupération des métadonnées de la vidéo...");
        const ytDlpProcess = spawn('yt-dlp', ['--dump-json', '-o', '-', youtubeUrl]);

        let outputData = "";
        let errorMessages = "";

        ytDlpProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        ytDlpProcess.stderr.on('data', (data) => {
            outputData += data.toString();
            errorMessages += data.toString();
        });

        ytDlpProcess.on('close', (code) => {
            if (!outputData.trim()) {
                return reject(new Error("Aucune donnée (stdout/stderr) reçue de yt-dlp pour les métadonnées."));
            }

            try {
                const jsonLines = outputData.trim().split('\n');
                let metadata = null;

                for (const line of jsonLines) {
                    try {
                        const parsedLine = JSON.parse(line);
                        if (typeof parsedLine === 'object' && parsedLine.title) {
                            metadata = parsedLine;
                            break;
                        }
                    } catch (lineError) {
                        continue;
                    }
                }

                if (!metadata) {
                    throw new Error("Impossible de trouver un objet JSON de métadonnées valide dans la sortie de yt-dlp.");
                }

                resolve({
                    title: metadata.title,
                    author: metadata.uploader || metadata.channel,
                    description: metadata.description,
                    publishedAt: metadata.upload_date ? new Date(metadata.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
                    thumbnailUrl: metadata.thumbnail
                });
            } catch (error) {
                if (code !== 0) {
                     return reject(new Error(`yt-dlp a quitté avec le code ${code}. Erreur: ${errorMessages}`));
                }
                reject(new Error(`Erreur de parsing des métadonnées JSON : ${error.message}`));
            }
        });
    });
}

module.exports = { getVideoMetadata };