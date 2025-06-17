Vous avez absolument raison. C'est une excellente remarque. Un bon `README` ne doit pas seulement décrire ce qui est fait, mais aussi la **vision finale** du projet. Omettre le fact-checking, qui est l'objectif principal, serait une erreur majeure.

Je vais réintégrer cette dimension pour que le document soit complet, reflétant à la fois l'état actuel et l'ambition du projet.

Voici une version mise à jour qui, je pense, répond parfaitement à votre besoin.

---

# Plateforme de Fact-Checking pour Vidéos YouTube
_(YouTube Video Fact-Checking Web Platform)_

Ce projet est une application web full-stack (React/Node.js) dont l'objectif final est d'analyser une vidéo YouTube, en extraire les affirmations factuelles ("claims"), **et vérifier leur véracité pour fournir un indice de confiance global.** L'architecture est entièrement conteneurisée avec Docker pour un déploiement et un développement simplifiés.

## Principales Fonctionnalités

- **Analyse Asynchrone :** Soumettez une URL YouTube et suivez la progression de l'analyse en temps réel.
- **Transcription Audio Fiable :** Utilise `yt-dlp` et l'API d'**AssemblyAI** pour une transcription précise, incluant les timestamps de chaque mot et paragraphe.
- **Extraction Intelligente des Faits :** Un Grand Modèle de Langage (LLM), configurable via **OpenRouter**, analyse la transcription pour identifier les affirmations factuelles.
- **Interface Utilisateur Interactive :** Visualisez les résultats avec un lecteur vidéo embarqué. Cliquez sur une affirmation pour que la vidéo se déplace instantanément au moment où elle est prononcée.
- **Outils de Développement :** Inclut un fournisseur `MOCK` pour tester le pipeline sans coût d'API et une fonction pour relancer l'extraction des faits avec un nouveau modèle.
- **Vérification des Faits (Prochaine Étape) :** Le cœur du projet. Chaque affirmation sera vérifiée à l'aide de sources fiables pour déterminer sa véracité et attribuer un score de confiance.

## Le Pipeline d'Analyse : De l'URL au Verdict

La fiabilité du projet repose sur un pipeline de traitement en plusieurs étapes, certaines fonctionnelles et d'autres en cours de développement.

#### Étape 1 : Transcription & Extraction des "Claims" (Fonctionnel)

Pour garantir la précision, nous utilisons une approche en "double vérification" pour l'horodatage :

- **Estimation par le LLM :** La transcription est pré-traitée pour y insérer des marqueurs temporels (ex: `[t=15]`). Le LLM est ensuite chargé d'extraire l'affirmation **et** de renvoyer le `timestamp` estimé.
- **Raffinage par le Backend :** Armé de cette estimation, notre backend effectue une recherche de similarité ("fuzzy search") dans une fenêtre très restreinte de la transcription originale pour trouver la correspondance exacte et son horodatage précis.

#### Étape 2 : Vérification des Faits & Scoring (Prochaine Étape)

Une fois les affirmations et leurs timestamps précisément identifiés, la phase suivante consistera à développer un **"agent de vérification"**. Pour chaque `claim`, cet agent :
1.  Interrogera des API de recherche (ex: Serper, Tavily).
2.  Analysera les résultats de sources réputées (agences de presse, encyclopédies, publications scientifiques).
3.  Assignera un verdict (`Vrai`, `Faux`, `Partiellement Vrai`, etc.) et un indice de confiance.
4.  L'ensemble de ces scores permettra de calculer un **indice de confiance global** pour la vidéo.

#### L'Importance du Modèle de Langage (LLM)

Le choix du LLM est **critique**. Les modèles plus petits (ex: 7B) ont tendance à avoir des difficultés à suivre des instructions JSON strictes. Des modèles plus larges et récents, comme **`moonshotai/kimi-dev-72b:free`** (testé avec succès), offrent une fiabilité bien supérieure et améliorent considérablement la pertinence des affirmations extraites. Le modèle est configurable via la variable d'environnement `OPENROUTER_MODEL`.

## Stack Technique

- **Frontend :** React (avec Vite), TailwindCSS
- **Backend :** Node.js, Express.js
- **Base de Données :** PostgreSQL avec l'ORM Prisma
- **Déploiement :** Docker & Docker Compose
- **Services Externes :** AssemblyAI (Transcription), OpenRouter (LLM)

## Installation et Lancement

**Prérequis :** Docker et Docker Compose doivent être installés.

1.  **Clonez le projet :**
    ```bash
    git clone <votre-url-de-repo>
    cd youtubeFactCheck
    ```

2.  **Configurez les variables d'environnement :** Créez les trois fichiers de configuration suivants et remplissez-les avec vos informations.

    - `postgres_password.txt` (à la racine) :
      ```text
      votre_mot_de_passe_secret_pour_postgres
      ```
    - `backend/.env` :
      ```env
      DATABASE_URL="postgresql://postgres:votre_mot_de_passe_secret_pour_postgres@postgresdb:5432/factcheckdb"
      ASSEMBLYAI_API_KEY="votre_cle_assemblyai"
      OPENROUTER_API_KEY="votre_cle_openrouter"
      OPENROUTER_MODEL="moonshotai/kimi-dev-72b:free" # Ou un autre modèle
      ```
    - `frontend/.env` :
      ```env
      VITE_API_URL=http://localhost:3001/api
      ```

3.  **Lancez les conteneurs Docker :**
    ```bash
    docker-compose up --build
    ```
    *(Laissez ce terminal ouvert pour voir les logs.)*

4.  **Appliquez les migrations de la base de données :**
    Dans un **nouveau terminal**, exécutez :
    ```bash
    docker-compose exec backend npx prisma migrate dev --name init
    ```

5.  **Accédez à l'application :**
    Ouvrez votre navigateur et allez sur [http://localhost:5173](http://localhost:5173).