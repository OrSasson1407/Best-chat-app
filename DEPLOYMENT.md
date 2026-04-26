# Deployment Guide

This guide provides step-by-step instructions for deploying Snappy (Best-Chat-App) into production.

Current reference stack:

- Render
- MongoDB Atlas
- Upstash Redis

---

# Prerequisites

Create accounts for:

1. Render  
https://render.com

2. MongoDB Atlas  
https://www.mongodb.com/cloud/atlas

3. Upstash Redis  
https://upstash.com

(Optional: Render Redis can be used instead.)

---

# Architecture Overview

Production stack:

```text
Users
↓
Render Static Frontend
↓
Render Node Backend
↓
MongoDB Atlas
↓
Upstash Redis Pub/Sub
```

---

# 1 Database Setup

## MongoDB Atlas

Create cluster.

Recommended:

- Dedicated or M10+
- Replica Set enabled

---

## Network Access

Add:

```text
0.0.0.0/0
```

for development/testing.

(Restrict later for production hardening.)

---

## Database User

Create user.

Save credentials securely.

---

## Connection String

Example:

```env
MONGO_URI=mongodb+srv://user:password@cluster0.mongodb.net/snappy
```

---

## Redis Setup

Create Upstash or Render Redis instance.

Choose region near backend.

Example:

```env
REDIS_URI=rediss://default:password@endpoint:port
```

---

# 2 Backend Deployment (Render Web Service)

Render Dashboard:

New +

Create:

Web Service

---

## Configure

Name:

```text
snappy-backend
```

Root Directory:

```text
server
```

Environment:

```text
Node
```

Build:

```bash
npm install
```

Start:

```bash
npm start
```

(package.json should map to node index.js)

---

## Environment Variables

Set:

```env
NODE_ENV=production
PORT=5000

CLIENT_URL=https://your-frontend-url.onrender.com

MONGO_URI=...

REDIS_URI=...

JWT_SECRET=<64-char-random-secret>

REFRESH_SECRET=<another-secret>
```

Generate secrets:

```bash
openssl rand -hex 32
```

---

# 3 Frontend Deployment (Render Static Site)

Create:

Static Site

---

## Configure

Name:

```text
snappy-frontend
```

Root:

```text
client
```

Build:

```bash
npm install && npm run build
```

Publish Directory:

```text
dist
```

---

## Frontend Environment Variables

```env
VITE_API_URL=https://your-backend-url.onrender.com
```

Important:

NO trailing slash.

Correct:

```text
https://your-backend-url.onrender.com
```

Incorrect:

```text
https://your-backend-url.onrender.com/
```

---

# 4 React Router Rewrite Rule

Add:

Source:

```text
/*
```

Destination:

```text
/index.html
```

Status:

```text
200
```

Required for client routing.

---

# 5 Final Connections

After frontend deploy:

Copy frontend URL.

Update backend:

```env
CLIENT_URL=
```

Restart backend.

---

# 6 Socket Scaling

Ensure backend uses:

```bash
@socket.io/redis-adapter
```

Required for:

- Multi-instance scaling
- Cross-node messaging
- Presence sync

---

# 7 Production Checklist

Verify:

- Mongo connected
- Redis connected
- Socket events broadcasting
- JWT secrets set
- HTTPS enabled
- React routing rewrites working
- CORS configured

---

# 8 Monitoring (Recommended)

Add:

- Prometheus
- Grafana
- Uptime monitoring

Track:

- Response times
- Redis health
- Mongo latency
- Socket throughput

---

# 9 Future Production Upgrades

Recommended:

- CDN for static assets
- Kubernetes autoscaling
- Cloudflare WAF
- Managed object storage (S3)
- Background job workers

---

Deployment complete.

Snappy should now be live.