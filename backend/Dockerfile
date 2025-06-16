FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# --- MODIFICATION CI-DESSOUS ---
# 1. On met à jour la liste des paquets en premier. Si cette étape échoue, on sait que c'est un problème réseau.
# 2. On installe ensuite nos dépendances sur une ligne séparée.
# 3. On combine toutes les opérations système en une seule commande RUN pour optimiser la taille de l'image.
RUN apk update && \
    apk add --no-cache python3 make g++ ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# On installe les dépendances Node.js après les dépendances système
RUN npm install
# --- FIN DE LA MODIFICATION ---

COPY . .

RUN npx prisma generate

# J'aligne le port sur 3001 pour qu'il corresponde au code du serveur (index.js)
EXPOSE 3001

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["npm", "run", "dev"]