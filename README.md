<div align="center">

<img src="client/public/logo512.png" alt="Snappy Chat" width="72" height="72"/>

# Snappy (Best-Chat-App)

**An Advanced, Secure, and Real-Time Chat Platform**

Real-time Messaging • End-to-End Encryption • AI Integrations • Distributed WebSockets

[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker)](#)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react)](#)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs)](#)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socketdotio)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)](#)
[![Redis](https://img.shields.io/badge/Redis-PubSub-DC382D?logo=redis)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Live Demo](https://best-chat-app-frontend.onrender.com) •
[Report Bug](../../issues/new) •
[Request Feature](../../issues/new)

</div>

---

# Overview

Snappy is a feature-rich, scalable messaging platform built for privacy and speed.

Features:

- Distributed Socket.io with Redis Pub/Sub
- End-to-End Encryption (E2E)
- AI-powered chat assistance
- Real-time message sync
- Group channels & moderation
- Modern animated UI themes
- Dockerized full-stack deployment

---

# Features

## Core Messaging & Security

| Feature | Description |
|--------|-------------|
| Real-Time Messaging | Sent / Delivered / Read states |
| E2E Encryption | Client-side encryption |
| Message Reactions | Replies, reactions, threads |
| 2FA | TOTP Authentication |
| App Lock | 4-digit PIN lock |
| View Once Media | Expiring media messages |

---

## Groups & Channels

- Role-based groups
- Broadcast channels
- QR invite links
- Group moderation
- Channel permissions

---

## AI Features

- AI Quick Replies
- Translation
- Grammar Assistant
- Chat Summarization

---

## Themes

- Glassmorphism
- Midnight OLED
- Cyberpunk
- Light Mode

---

# Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React + Vite |
| State | Zustand |
| Styling | Styled Components + Framer Motion |
| Backend | Node + Express |
| WebSockets | Socket.io |
| Database | MongoDB |
| Cache/Scaling | Redis |
| Search | Meilisearch |
| Testing | Jest |
| Deployment | Docker + Render |

---

# Architecture

```text
chat-app/
├── docker-compose.yml
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
│
├── client/
│   ├── public/
│   └── src/
│      ├── components/
│      ├── pages/
│      ├── store/
│      ├── utils/
│      └── App.jsx
│
└── server/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── socket/
    └── workers/
```

---

# Getting Started

## Prerequisites

- Node 18+
- Docker & Docker Compose
- MongoDB
- Redis
- OpenAI API key (optional)

---

## Run with Docker

```bash
git clone https://github.com/yourusername/best-chat-app.git
cd best-chat-app

docker-compose up --build
```

Open:

```bash
http://localhost:5173
```

---

## Manual Setup

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

---

# Environment Variables

## server/.env

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGO_URI=
REDIS_URI=

JWT_SECRET=
REFRESH_SECRET=

OPENAI_API_KEY=
METRICS_SECRET=
```

---

## client/.env

```env
VITE_API_URL=http://localhost:5000
```

---

# Database Models

| Model | Purpose |
|------|---------|
| User | Auth, keys, settings |
| Message | Encrypted messages |
| Group | Roles and membership |
| Story | 24-hour statuses |

---

# API Examples

## Login

```http
POST /api/auth/login
```

## Send Message

```http
POST /api/messages/addmsg
```

## Create Group

```http
POST /api/groups/create
```

Swagger:

```bash
/api-docs
```

---

# Deployment

## Render Backend

- Build:

```bash
npm install
```

- Start:

```bash
npm start
```

---

## Render Frontend

Build:

```bash
npm install && npm run build
```

Publish directory:

```bash
dist
```

---

# Security

Please do NOT open public issues for vulnerabilities.

Report privately.

See:

```bash
SECURITY.md
```

---

# Roadmap

- [ ] Voice & Video Calls
- [ ] Desktop App
- [ ] Push Notifications
- [ ] Media Compression

---

# License

MIT License

Built with ❤️ using React, Socket.io and MongoDB