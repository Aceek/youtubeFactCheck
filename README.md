# YouTube Fact-Check Application

A full-stack app to fact-check YouTube videos by fetching and storing transcripts. Built with React + Vite, Node.js + Express, Prisma, PostgreSQL, and Docker.

## Features

- Submit YouTube URLs to view transcripts.
- Store data in PostgreSQL.
- Tailwind CSS for styling.
- Secure environment variables with .env and Docker secrets.
- CORS-enabled backend.

## Prerequisites

- Docker and Docker Compose
- YouTube Data API key

## Setup

1. Clone the repository.
2. Add frontend/.env, backend/.env, and postgres_password.txt with your credentials.
3. Run `docker-compose up --build -d`.
4. Apply migrations: `docker exec -it youtubefactcheck-backend-1 npx prisma migrate dev --name init`.
5. Access at http://localhost:5173.
